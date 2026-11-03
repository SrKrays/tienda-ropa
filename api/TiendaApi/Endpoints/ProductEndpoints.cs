using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TiendaApi.Data;
using TiendaApi.Images;

namespace TiendaApi.Endpoints;

public static class ProductEndpoints
{
    public static void MapProductEndpoints(this WebApplication app)
    {
        // ---------- público (la tienda) ----------
        app.MapGet("/api/products", async (AppDb db, HttpContext http, CancellationToken ct) =>
        {
            var list = await db.Products.AsNoTracking().Where(p => p.Active)
                .OrderBy(p => p.SortOrder).ThenByDescending(p => p.CreatedAt).ToListAsync(ct);
            http.Response.Headers.CacheControl = "public, max-age=30";
            return Results.Ok(list.Select(ProductMap.ToDto));
        });

        // fotos guardadas en la base (modo prueba). El nombre nunca se reusa: se cachean un año.
        // GET y HEAD: WhatsApp pregunta con HEAD antes de armar la vista previa
        app.MapMethods("/api/images/{file}", ["GET", "HEAD"], async (string file, AppDb db, HttpContext http, CancellationToken ct) =>
        {
            var id = Path.GetFileNameWithoutExtension(file);
            var img = await db.Images.AsNoTracking().FirstOrDefaultAsync(i => i.Id == id, ct);
            if (img is null) return Results.NotFound();
            http.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            // siempre con permiso CORS (aunque el pedido no lo pida): si el navegador guardó la foto sin este
            // encabezado, después el perchero / el probador / la imagen del pedido no la podrían usar
            http.Response.Headers.AccessControlAllowOrigin = "*";
            return Results.File(img.Data, img.ContentType);
        });

        // ---------- admin (con login) ----------
        var admin = app.MapGroup("/api/admin").RequireAuthorization();

        admin.MapGet("/products", async (AppDb db, CancellationToken ct) =>
        {
            var list = await db.Products.AsNoTracking()
                .OrderBy(p => p.SortOrder).ThenByDescending(p => p.CreatedAt).ToListAsync(ct);
            return Results.Ok(list.Select(ProductMap.ToDto));
        });

        admin.MapPost("/products", async (HttpRequest req, AppDb db, IImageStore store, CancellationToken ct) =>
        {
            var (input, files, error) = await ReadForm(req, ct);
            if (error is not null) return Bad(error);
            if (!files.ContainsKey("front")) return Bad("Falta la foto de frente.");

            var p = new Product();
            var errors = ProductMap.Apply(input!, p);
            if (errors.Count > 0) return Results.BadRequest(new { errors });

            var slug = ProductMap.Slug(p.Name);
            p.Id = await db.Products.AnyAsync(x => x.Id == slug, ct) ? $"{slug}-{Guid.NewGuid().ToString("N")[..5]}" : slug;
            // las nuevas aparecen primero en el perchero
            p.SortOrder = (await db.Products.MinAsync(x => (int?)x.SortOrder, ct) ?? 1) - 1;
            foreach (var (slot, img) in files) Set(p, slot, await store.SaveAsync(img.data, img.type, $"{slug}-{Names[slot]}", ct));

            db.Products.Add(p);
            await db.SaveChangesAsync(ct);
            return Results.Ok(ProductMap.ToDto(p));
        }).DisableAntiforgery();

        admin.MapPut("/products/{id}", async (string id, HttpRequest req, AppDb db, IImageStore store, CancellationToken ct) =>
        {
            var p = await db.Products.FindAsync([id], ct);
            if (p is null) return Results.NotFound();
            var (input, files, error) = await ReadForm(req, ct);
            if (error is not null) return Bad(error);

            var errors = ProductMap.Apply(input!, p);
            if (errors.Count > 0) return Results.BadRequest(new { errors });

            var slug = ProductMap.Slug(p.Name);
            var old = Names.Keys.ToDictionary(k => k, k => Get(p, k));
            foreach (var (slot, img) in files) Set(p, slot, await store.SaveAsync(img.data, img.type, $"{slug}-{Names[slot]}", ct));
            if (!files.ContainsKey("back") && input!.RemoveBack == true) p.BackUrl = null;
            if (!files.ContainsKey("worn") && input!.RemoveWorn == true) p.WornUrl = null;
            if (!files.ContainsKey("detail") && input!.RemoveDetail == true) p.DetailUrl = null;

            await db.SaveChangesAsync(ct);
            // las fotos viejas se borran recién cuando la prenda ya quedó guardada con las nuevas
            foreach (var (slot, url) in old) if (url != Get(p, slot)) await store.DeleteAsync(url, ct);
            return Results.Ok(ProductMap.ToDto(p));
        }).DisableAntiforgery();

        // prender / apagar sin tocar nada más (ej: "sin stock por ahora, la escondo")
        admin.MapPatch("/products/{id}/active", async (string id, ActiveInput body, AppDb db, CancellationToken ct) =>
        {
            var p = await db.Products.FindAsync([id], ct);
            if (p is null) return Results.NotFound();
            p.Active = body.Active;
            p.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            return Results.Ok(ProductMap.ToDto(p));
        });

        admin.MapDelete("/products/{id}", async (string id, AppDb db, IImageStore store, CancellationToken ct) =>
        {
            var p = await db.Products.FindAsync([id], ct);
            if (p is null) return Results.NotFound();
            db.Products.Remove(p);
            await db.SaveChangesAsync(ct);
            foreach (var slot in Names.Keys) await store.DeleteAsync(Get(p, slot), ct);
            return Results.NoContent();
        });

        // orden del perchero: la lista de ids en el orden nuevo
        admin.MapPut("/order", async (string[] ids, AppDb db, CancellationToken ct) =>
        {
            var all = await db.Products.ToListAsync(ct);
            for (var i = 0; i < ids.Length; i++)
            {
                var p = all.FirstOrDefault(x => x.Id == ids[i]);
                if (p is not null) p.SortOrder = i;
            }
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    public record ActiveInput(bool Active);

    static IResult Bad(string msg) => Results.BadRequest(new { errors = new[] { msg } });

    // las fotos de cada prenda: campo del formulario → nombre del archivo
    static readonly Dictionary<string, string> Names = new() { ["front"] = "frente", ["back"] = "espalda", ["worn"] = "puesta", ["detail"] = "detalle" };
    static string? Get(Product p, string slot) => slot switch { "front" => p.FrontUrl, "back" => p.BackUrl, "worn" => p.WornUrl, _ => p.DetailUrl };
    static void Set(Product p, string slot, string url)
    {
        switch (slot)
        {
            case "front": p.FrontUrl = url; break;
            case "back": p.BackUrl = url; break;
            case "worn": p.WornUrl = url; break;
            default: p.DetailUrl = url; break;
        }
    }

    // multipart: "data" = JSON con los datos; "front" / "back" / "worn" / "detail" = fotos (WebP, PNG o JPG)
    static async Task<(ProductInput? input, Dictionary<string, (byte[] data, string type)> files, string? error)> ReadForm(HttpRequest req, CancellationToken ct)
    {
        var files = new Dictionary<string, (byte[] data, string type)>();
        if (!req.HasFormContentType) return (null, files, "Formato inválido.");
        var form = await req.ReadFormAsync(ct);
        ProductInput? input;
        try { input = JsonSerializer.Deserialize<ProductInput>(form["data"].ToString(), ProductMap.Json); }
        catch (JsonException) { return (null, files, "Datos inválidos."); }
        if (input is null) return (null, files, "Faltan los datos.");

        foreach (var (slot, label) in Names)
        {
            var f = form.Files[slot];
            if (f is null || f.Length == 0) continue;
            if (f.Length > ImageCheck.MaxBytes) return (null, files, $"La foto de {label} pesa demasiado (máximo 4 MB).");
            using var ms = new MemoryStream();
            await f.CopyToAsync(ms, ct);
            var data = ms.ToArray();
            var type = ImageCheck.Sniff(data);
            if (type is null) return (null, files, $"La foto de {label} no es una imagen válida.");
            files[slot] = (data, type);
        }
        return (input, files, null);
    }
}
