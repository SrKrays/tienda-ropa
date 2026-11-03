using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TiendaApi.Data;
using TiendaApi.Images;

namespace TiendaApi.Endpoints;

// Pedidos: la tienda los crea justo antes de abrir WhatsApp. El mensaje lleva el link /o/{código}:
// WhatsApp muestra la vista previa con la imagen del pedido (las prendas, talles y total),
// y al tocarlo el local ve el detalle completo con fotos.
public static class OrderEndpoints
{
    public record OrderItemInput(string ProductId, string Size, string? Color, int Qty);
    public record OrderInput(string Name, string Phone, string? Delivery, string? Payment, string? Address, string? Note,
        string? CustomerMeasures, OrderItemInput[] Items);

    // lo que queda guardado de cada prenda (con el precio del momento, sacado de la base)
    public record OrderItem(string ProductId, string Name, string Image, string Size, string? Color, int Qty, int Price,
        MeasureDto? Measures);

    public record OrderDto(string Id, DateTime CreatedAt, string CustomerName, string Phone, string Delivery, string Payment,
        string? Address, string? Note, string? CustomerMeasures, OrderItem[] Items, int Total, string? Image, string Url, string Status);

    const string CodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I para que se lea bien

    static string NewCode() => string.Concat(Enumerable.Range(0, 6).Select(_ => CodeChars[RandomNumberGenerator.GetInt32(CodeChars.Length)]));

    public static string PublicBase(HttpRequest req, IConfiguration cfg) =>
        (cfg["PUBLIC_URL"] ?? $"{req.Scheme}://{req.Host}").TrimEnd('/');

    static string Abs(string? url, string baseUrl) => url is null ? "" : url.StartsWith("http") ? url : baseUrl + url;

    static OrderDto ToDto(Order o, string baseUrl) => new(o.Id, o.CreatedAt, o.CustomerName, o.Phone, o.Delivery, o.Payment,
        o.Address, o.Note, o.CustomerMeasures,
        JsonSerializer.Deserialize<OrderItem[]>(o.ItemsJson, ProductMap.Json) ?? [], o.Total,
        o.ImageUrl is null ? null : Abs(o.ImageUrl, baseUrl), $"{baseUrl}/o/{o.Id}", o.Status);

    public static void MapOrderEndpoints(this WebApplication app)
    {
        app.MapPost("/api/orders", async (HttpRequest req, AppDb db, IImageStore store, IConfiguration cfg, CancellationToken ct) =>
        {
            if (!req.HasFormContentType) return Bad("Formato inválido.");
            var form = await req.ReadFormAsync(ct);
            OrderInput? input;
            try { input = JsonSerializer.Deserialize<OrderInput>(form["data"].ToString(), ProductMap.Json); }
            catch (JsonException) { return Bad("Datos inválidos."); }
            if (input is null || input.Items is not { Length: > 0 and <= 30 }) return Bad("El carrito está vacío.");

            var name = (input.Name ?? "").Trim();
            var phone = (input.Phone ?? "").Trim();
            if (name.Length is < 2 or > 80) return Bad("Escribí tu nombre.");
            if (phone.Count(char.IsDigit) < 8 || phone.Length > 30) return Bad("Escribí un teléfono válido.");

            // precios y nombres salen de la base, no de lo que manda el navegador
            var ids = input.Items.Select(i => i.ProductId).Distinct().ToList();
            var products = await db.Products.AsNoTracking().Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
            var items = new List<OrderItem>();
            foreach (var it in input.Items)
            {
                if (!products.TryGetValue(it.ProductId, out var p)) return Bad("Una de las prendas ya no está disponible. Actualizá la página.");
                var dto = ProductMap.ToDto(p);
                var size = (it.Size ?? "").ToUpperInvariant();
                if (!dto.Sizes.ContainsKey(size)) return Bad($"El talle {size} de {p.Name} ya no está disponible.");
                var qty = Math.Clamp(it.Qty, 1, 50);
                var color = dto.Colors.FirstOrDefault(c => c.Id == it.Color)?.Name;
                items.Add(new OrderItem(p.Id, p.Name, p.FrontUrl, size, color, qty, p.Price, MeasuresFor(dto, size)));
            }

            var order = new Order
            {
                Id = NewCode(),
                CustomerName = name,
                Phone = phone,
                Delivery = input.Delivery == "envio" ? "envio" : "retiro",
                Payment = input.Payment == "efectivo" ? "efectivo" : "transferencia",
                Address = Clip(input.Address, 200),
                Note = Clip(input.Note, 300),
                CustomerMeasures = Clip(input.CustomerMeasures, 200),
                ItemsJson = JsonSerializer.Serialize(items, ProductMap.Json),
                Total = items.Sum(i => i.Price * i.Qty),
            };
            while (await db.Orders.AnyAsync(o => o.Id == order.Id, ct)) order.Id = NewCode();

            // imagen del pedido (la arma la tienda en el navegador): JPG, chica
            var file = form.Files["image"];
            if (file is { Length: > 0 and <= 800 * 1024 })
            {
                using var ms = new MemoryStream();
                await file.CopyToAsync(ms, ct);
                var data = ms.ToArray();
                var type = ImageCheck.Sniff(data);
                if (type is not null) order.ImageUrl = await store.SaveAsync(data, type, $"pedido-{order.Id.ToLowerInvariant()}", ct);
            }

            db.Orders.Add(order);
            await db.SaveChangesAsync(ct);
            await PurgeOldImages(db, store, ct);
            return Results.Ok(ToDto(order, PublicBase(req, cfg)));
        }).RequireRateLimiting("orders").DisableAntiforgery();

        // Página del pedido (la que abre el local desde WhatsApp). Tiene las etiquetas og: para la vista previa.
        app.MapGet("/o/{code}", async (string code, HttpRequest req, AppDb db, IConfiguration cfg, CancellationToken ct) =>
        {
            var o = await db.Orders.AsNoTracking().FirstOrDefaultAsync(x => x.Id == code.ToUpperInvariant(), ct);
            if (o is null) return Results.Content(Page("Pedido no encontrado", "<p class=muted>Este pedido no existe o ya se borró.</p>", null, null), "text/html; charset=utf-8", statusCode: 404);
            return Results.Content(OrderPage(ToDto(o, PublicBase(req, cfg)), cfg), "text/html; charset=utf-8");
        });

        var admin = app.MapGroup("/api/admin").RequireAuthorization();
        admin.MapGet("/orders", async (HttpRequest req, AppDb db, IConfiguration cfg, CancellationToken ct) =>
        {
            var list = await db.Orders.AsNoTracking().OrderByDescending(o => o.CreatedAt).Take(100).ToListAsync(ct);
            var b = PublicBase(req, cfg);
            return Results.Ok(list.Select(o => ToDto(o, b)));
        });
        admin.MapPatch("/orders/{id}/status", async (string id, StatusInput body, HttpRequest req, AppDb db, IConfiguration cfg, CancellationToken ct) =>
        {
            var o = await db.Orders.FindAsync([id], ct);
            if (o is null) return Results.NotFound();
            o.Status = body.Status is "nuevo" or "confirmado" or "entregado" or "cancelado" ? body.Status : o.Status;
            await db.SaveChangesAsync(ct);
            return Results.Ok(ToDto(o, PublicBase(req, cfg)));
        });
    }

    public record StatusInput(string Status);

    static MeasureDto? MeasuresFor(ProductDto p, string size)
    {
        if (p.Measures is not null && p.Measures.TryGetValue(size, out var m)) return m;
        // sin medidas reales cargadas: la tabla estándar del tipo de prenda (la misma que usa la calculadora)
        return StandardSizes.Get(p.FitType, size);
    }

    static string? Clip(string? s, int max)
    {
        s = s?.Trim();
        return string.IsNullOrEmpty(s) ? null : s.Length > max ? s[..max] : s;
    }

    static IResult Bad(string msg) => Results.BadRequest(new { errors = new[] { msg } });

    // la imagen del pedido solo hace falta para la vista previa: a los 60 días se borra (la base de Clever es chica)
    static async Task PurgeOldImages(AppDb db, IImageStore store, CancellationToken ct)
    {
        var limit = DateTime.UtcNow.AddDays(-60);
        var old = await db.Orders.Where(o => o.CreatedAt < limit && o.ImageUrl != null).Take(20).ToListAsync(ct);
        foreach (var o in old)
        {
            await store.DeleteAsync(o.ImageUrl, ct);
            o.ImageUrl = null;
        }
        if (old.Count > 0) await db.SaveChangesAsync(ct);
    }

    static string H(string? s) => WebUtility.HtmlEncode(s ?? "");
    // "$ 19.900" (a mano: el servidor corre sin configuración regional)
    static string Money(int n) => "$ " + n.ToString("N0", System.Globalization.CultureInfo.InvariantCulture).Replace(",", ".");

    static string OrderPage(OrderDto o, IConfiguration cfg)
    {
        var store = cfg["STORE_NAME"] ?? "[MARCA]";
        var count = o.Items.Sum(i => i.Qty);
        var desc = string.Join(" · ", o.Items.Select(i => $"{i.Qty}x {i.Name} (talle {i.Size})")) + $" · Total {Money(o.Total)}";
        var sb = new StringBuilder();
        sb.Append($"<p class=kicker>Pedido <b>#{H(o.Id)}</b> · {o.CreatedAt.AddHours(-3):dd/MM HH:mm}</p>");
        sb.Append($"<h1>{H(o.CustomerName)}</h1><p class=muted><a href=\"tel:{H(new string(o.Phone.Where(c => char.IsDigit(c) || c == '+').ToArray()))}\">{H(o.Phone)}</a> · ");
        sb.Append(o.Delivery == "envio" ? $"Envío a domicilio{(o.Address is null ? " (dirección a coordinar)" : ": " + H(o.Address))}" : "Retira en el local");
        sb.Append($" · Paga con {H(o.Payment)}</p>");
        if (o.CustomerMeasures is not null) sb.Append($"<p class=meas>Sus medidas: {H(o.CustomerMeasures)}</p>");
        sb.Append("<ul>");
        foreach (var i in o.Items)
        {
            var m = i.Measures is null ? "" : $"<small>Prenda: ancho {i.Measures.Ancho} cm · largo {i.Measures.Largo} cm{(i.Measures.Manga > 0 ? $" · manga {i.Measures.Manga} cm" : "")}</small>";
            sb.Append($"<li><img src=\"{H(Abs(i.Image, o.Url[..o.Url.IndexOf("/o/")]))}\" alt=\"\"><div><b>{i.Qty}x {H(i.Name)}</b>");
            sb.Append($"<span>Talle <b>{H(i.Size)}</b>{(i.Color is null ? "" : " · " + H(i.Color))}</span>{m}</div><strong>{Money(i.Price * i.Qty)}</strong></li>");
        }
        sb.Append("</ul>");
        if (o.Note is not null) sb.Append($"<p class=note>Nota: {H(o.Note)}</p>");
        sb.Append($"<p class=total><span>Total ({count} {(count == 1 ? "prenda" : "prendas")})</span><b>{Money(o.Total)}</b></p>");
        if (o.Delivery == "envio") sb.Append("<p class=muted>+ envío a coordinar</p>");
        return Page($"Pedido #{o.Id} · {store}", sb.ToString(), desc, o.Image, o.Url);
    }

    static string Page(string title, string body, string? desc, string? image, string? url = null) => $$"""
        <!doctype html>
        <html lang="es"><head>
        <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="noindex">
        <title>{{H(title)}}</title>
        <meta property="og:type" content="website">
        <meta property="og:title" content="{{H(title)}}">
        {{(desc is null ? "" : $"<meta property=\"og:description\" content=\"{H(desc)}\"><meta name=\"description\" content=\"{H(desc)}\">")}}
        {{(image is null ? "" : $"<meta property=\"og:image\" content=\"{H(image)}\"><meta property=\"og:image:width\" content=\"1200\"><meta property=\"og:image:height\" content=\"630\"><meta name=\"twitter:card\" content=\"summary_large_image\">")}}
        {{(url is null ? "" : $"<meta property=\"og:url\" content=\"{H(url)}\">")}}
        <style>
        body{margin:0;background:#0f0e0b;color:#ede6d6;font:18px/1.5 system-ui,sans-serif}
        main{max-width:640px;margin:0 auto;padding:24px 16px 48px}
        h1{font-size:30px;margin:2px 0 4px}.kicker{margin:0;color:#d8c7a0;letter-spacing:.08em;text-transform:uppercase;font-size:14px}
        .muted{color:#b9b09d}a{color:#eedfc1}.meas{padding:10px 14px;border-radius:12px;background:#232119;border:1px solid #3b372d}
        ul{list-style:none;padding:0;margin:18px 0;display:grid;gap:10px}
        li{display:grid;grid-template-columns:84px 1fr auto;gap:14px;align-items:center;padding:10px;border-radius:16px;background:#191813;border:1px solid #3b372d}
        li img{width:84px;height:92px;object-fit:contain;background:linear-gradient(#2a2820,#15140f);border-radius:10px}
        li div{display:grid}li small{color:#b9b09d}.note{color:#f0a77e}
        .total{display:flex;justify-content:space-between;font-size:22px;border-top:1px solid #3b372d;padding-top:14px;margin-bottom:0}
        .hero{width:100%;border-radius:16px;margin-bottom:16px;display:block}
        </style></head>
        <body><main>{{(image is null ? "" : $"<img class=hero src=\"{H(image)}\" alt=\"\">")}}{{body}}</main></body></html>
        """;
}
