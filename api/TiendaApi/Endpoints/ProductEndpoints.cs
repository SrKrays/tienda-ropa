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
        app.MapGet("/api/images/{file}", async (string file, AppDb db, HttpContext http, CancellationToken ct) =>
        {
            var id = Path.GetFileNameWithoutExtension(file);
            var img = await db.Images.AsNoTracking().FirstOrDefaultAsync(i => i.Id == id, ct);
            if (img is null) return Results.NotFound();
            http.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
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
            var (input, front, back, error) = await ReadForm(req, ct);
            if (error is not null) return Bad(error);
            if (front is null) return Bad("Falta la foto de frente.");

            var p = new Product();
            var errors = ProductMap.Apply(input!, p);
            if (errors.Count > 0) return Results.BadRequest(new { errors });

            var slug = ProductMap.Slug(p.Name);
            p.Id = await db.Products.AnyAsync(x => x.Id == slug, ct) ? $"{slug}-{Guid.NewGuid().ToString("N")[..5]}" : slug;
            // las nuevas aparecen primero en el perchero
            p.SortOrder = (await db.Products.MinAsync(x => (int?)x.SortOrder, ct) ?? 1) - 1;
            p.FrontUrl = await store.SaveAsync(front.Value.data, front.Value.type, $"{slug}-frente", ct);
            if (back is not null) p.BackUrl = await store.SaveAsync(back.Value.data, back.Value.type, $"{slug}-espalda", ct);

            db.Products.Add(p);
            await db.SaveChangesAsync(ct);
            return Results.Ok(ProductMap.ToDto(p));
        }).DisableAntiforgery();

        admin.MapPut("/products/{id}", async (string id, HttpRequest req, AppDb db, IImageStore store, CancellationToken ct) =>
        {
            var p = await db.Products.FindAsync([id], ct);
            if (p is null) return Results.NotFound();
            var (input, front, back, error) = await ReadForm(req, ct);
            if (error is not null) return Bad(error);

            var errors = ProductMap.Apply(input!, p);
            if (errors.Count > 0) return Results.BadRequest(new { errors });

            var slug = ProductMap.Slug(p.Name);
            var oldFront = p.FrontUrl;
            var oldBack = p.BackUrl;
            if (front is not null) p.FrontUrl = await store.SaveAsync(front.Value.data, front.Value.type, $"{slug}-frente", ct);
            if (back is not null) p.BackUrl = await store.SaveAsync(back.Value.data, back.Value.type, $"{slug}-espalda", ct);
            else if (input!.RemoveBack == true) p.BackUrl = null;

            await db.SaveChangesAsync(ct);
            // las fotos viejas se borran recién cuando la prenda ya quedó guardada con las nuevas
            if (oldFront != p.FrontUrl) await store.DeleteAsync(oldFront, ct);
            if (oldBack != p.BackUrl) await store.DeleteAsync(oldBack, ct);
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
            await store.DeleteAsync(p.FrontUrl, ct);
            await store.DeleteAsync(p.BackUrl, ct);
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

    // multipart: "data" = JSON con los datos, "front" / "back" = fotos (WebP o PNG, ya recortadas por el admin)
    static async Task<(ProductInput? input, (byte[] data, string type)? front, (byte[] data, string type)? back, string? error)>
        ReadForm(HttpRequest req, CancellationToken ct)
    {
        if (!req.HasFormContentType) return (null, null, null, "Formato inválido.");
        var form = await req.ReadFormAsync(ct);
        ProductInput? input;
        try { input = JsonSerializer.Deserialize<ProductInput>(form["data"].ToString(), ProductMap.Json); }
        catch (JsonException) { return (null, null, null, "Datos inválidos."); }
        if (input is null) return (null, null, null, "Faltan los datos.");

        async Task<((byte[], string)? img, string? err)> File(string name, string label)
        {
            var f = form.Files[name];
            if (f is null || f.Length == 0) return (null, null);
            if (f.Length > ImageCheck.MaxBytes) return (null, $"La foto de {label} pesa demasiado (máximo 4 MB).");
            using var ms = new MemoryStream();
            await f.CopyToAsync(ms, ct);
            var data = ms.ToArray();
            var type = ImageCheck.Sniff(data);
            return type is null ? (null, $"La foto de {label} no es una imagen válida.") : ((data, type), null);
        }

        var (front, e1) = await File("front", "frente");
        if (e1 is not null) return (null, null, null, e1);
        var (back, e2) = await File("back", "espalda");
        if (e2 is not null) return (null, null, null, e2);
        return (input, front, back, null);
    }
}
