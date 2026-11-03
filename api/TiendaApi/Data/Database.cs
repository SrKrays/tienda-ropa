using Microsoft.EntityFrameworkCore;

namespace TiendaApi.Data;

public static class Database
{
    // DB_PROVIDER = postgres (Render, por defecto) | mysql (Don Web / Ferozo / Clever Cloud)
    // DATABASE_URL = la "External/Internal Database URL" de Render (postgres://user:pass@host:5432/db)
    //                o una cadena de conexión normal (Host=...;Database=...  /  Server=...;Database=...).
    public static void AddAppDb(this IServiceCollection services, IConfiguration cfg)
    {
        var provider = (cfg["DB_PROVIDER"] ?? "postgres").ToLowerInvariant();
        var url = cfg["DATABASE_URL"] ?? cfg.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Falta DATABASE_URL");

        services.AddDbContext<AppDb>(o =>
        {
            if (provider == "mysql") o.UseMySQL(ToMySql(url));
            else o.UseNpgsql(ToNpgsql(url));
        });
    }

    static string ToNpgsql(string url)
    {
        if (!url.StartsWith("postgres://") && !url.StartsWith("postgresql://")) return url;
        var u = new Uri(url);
        var userInfo = u.UserInfo.Split(':', 2);
        var port = u.Port > 0 ? u.Port : 5432;
        var ssl = u.Host.Contains('.') ? "SSL Mode=Require;" : ""; // la URL interna de Render no lleva SSL
        return $"Host={u.Host};Port={port};Database={u.AbsolutePath.TrimStart('/')};" +
               $"Username={Uri.UnescapeDataString(userInfo[0])};Password={Uri.UnescapeDataString(userInfo.ElementAtOrDefault(1) ?? "")};{ssl}";
    }

    static string ToMySql(string url)
    {
        if (!url.StartsWith("mysql://")) return url;
        var u = new Uri(url);
        var userInfo = u.UserInfo.Split(':', 2);
        var port = u.Port > 0 ? u.Port : 3306;
        return $"Server={u.Host};Port={port};Database={u.AbsolutePath.TrimStart('/')};" +
               $"Uid={Uri.UnescapeDataString(userInfo[0])};Pwd={Uri.UnescapeDataString(userInfo.ElementAtOrDefault(1) ?? "")};";
    }
}
