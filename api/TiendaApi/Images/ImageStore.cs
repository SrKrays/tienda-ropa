using FluentFTP;
using Microsoft.EntityFrameworkCore;
using TiendaApi.Data;

namespace TiendaApi.Images;

// Dónde quedan las fotos de las prendas.
//   IMAGE_STORE=db  → en la base de datos (modo prueba: Render gratis no guarda archivos entre deploys)
//   IMAGE_STORE=ftp → en el hosting (Don Web / Ferozo) por FTP, igual que en Bruzz
public interface IImageStore
{
    /// <summary>Guarda la imagen y devuelve la URL pública (absoluta o "/api/images/...").</summary>
    Task<string> SaveAsync(byte[] data, string contentType, string baseName, CancellationToken ct);
    Task DeleteAsync(string? url, CancellationToken ct);
}

public static class ImageCheck
{
    public const int MaxBytes = 4 * 1024 * 1024;

    // Solo aceptamos WebP, PNG o JPG reales (se miran los primeros bytes, no la extensión)
    public static string? Sniff(byte[] d)
    {
        if (d.Length > 12 && d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F' && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P')
            return "image/webp";
        if (d.Length > 8 && d[0] == 0x89 && d[1] == 'P' && d[2] == 'N' && d[3] == 'G')
            return "image/png";
        if (d.Length > 3 && d[0] == 0xFF && d[1] == 0xD8 && d[2] == 0xFF)
            return "image/jpeg";
        return null;
    }

    public static string Ext(string contentType) => contentType switch { "image/png" => "png", "image/jpeg" => "jpg", _ => "webp" };

    // nombre de archivo legible y único: "remera-skull-frente-3f9a1c2b7d4e"
    public static string FileId(string baseName)
    {
        // baseName = "<slug>-frente" / "<slug>-espalda": se acorta el slug, nunca la parte final
        var cut = baseName.LastIndexOf('-');
        var (slug, side) = cut > 0 ? (baseName[..cut], baseName[cut..]) : (baseName, "");
        if (slug.Length > 18) slug = slug[..18].TrimEnd('-');
        return $"{slug}{side}-{Guid.NewGuid().ToString("N")[..10]}";
    }
}

public class DbImageStore(AppDb db) : IImageStore
{
    public async Task<string> SaveAsync(byte[] data, string contentType, string baseName, CancellationToken ct)
    {
        var id = ImageCheck.FileId(baseName);
        db.Images.Add(new ImageBlob { Id = id, ContentType = contentType, Data = data });
        await db.SaveChangesAsync(ct);
        return $"/api/images/{id}.{ImageCheck.Ext(contentType)}";
    }

    public async Task DeleteAsync(string? url, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(url) || !url.StartsWith("/api/images/")) return;
        var id = Path.GetFileNameWithoutExtension(url);
        await db.Images.Where(i => i.Id == id).ExecuteDeleteAsync(ct);
    }
}

// FTP_HOST, FTP_USER, FTP_PASS, FTP_DIR (ej: /public_html/img/productos),
// FTP_PUBLIC_URL (ej: https://www.tienda.com.ar/img/productos)
public class FtpImageStore(IConfiguration cfg, ILogger<FtpImageStore> log) : IImageStore
{
    string Dir => (cfg["FTP_DIR"] ?? "/public_html/img/productos").TrimEnd('/');
    string PublicUrl => (cfg["FTP_PUBLIC_URL"] ?? throw new InvalidOperationException("Falta FTP_PUBLIC_URL")).TrimEnd('/');

    async Task<AsyncFtpClient> Connect(CancellationToken ct)
    {
        var client = new AsyncFtpClient(cfg["FTP_HOST"], cfg["FTP_USER"], cfg["FTP_PASS"]);
        client.Config.EncryptionMode = FtpEncryptionMode.Auto;
        client.Config.ValidateAnyCertificate = true;
        await client.AutoConnect(ct);
        return client;
    }

    public async Task<string> SaveAsync(byte[] data, string contentType, string baseName, CancellationToken ct)
    {
        var file = ImageCheck.FileId(baseName) + "." + ImageCheck.Ext(contentType);
        await using var client = await Connect(ct);
        await client.UploadBytes(data, $"{Dir}/{file}", FtpRemoteExists.Overwrite, createRemoteDir: true, token: ct);
        return $"{PublicUrl}/{file}";
    }

    public async Task DeleteAsync(string? url, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(url) || !url.StartsWith(PublicUrl)) return;
        try
        {
            await using var client = await Connect(ct);
            await client.DeleteFile($"{Dir}/{url[(PublicUrl.Length + 1)..]}", ct);
        }
        catch (Exception e)
        {
            // si no se pudo borrar, queda un archivo suelto: no es motivo para fallar
            log.LogWarning(e, "No se pudo borrar {Url} del FTP", url);
        }
    }
}
