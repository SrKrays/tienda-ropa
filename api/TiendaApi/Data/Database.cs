using Microsoft.EntityFrameworkCore;

namespace TiendaApi.Data;

public static class Database
{
    // Base de datos MySQL en Clever Cloud.
    //   DATABASE_URL = la "Connection URI" del add-on (mysql://user:pass@host:3306/db)
    //                  o una cadena de conexión normal (Server=...;Database=...;Uid=...;Pwd=...).
    //   Si no está, se usa MYSQL_ADDON_URI (la variable que crea Clever Cloud).
    public static string ConnectionString(IConfiguration cfg)
    {
        var url = cfg["DATABASE_URL"] ?? cfg["MYSQL_ADDON_URI"] ?? cfg.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Falta DATABASE_URL (la Connection URI de la base en Clever Cloud)");
        return ToMySql(url);
    }

    public static void AddAppDb(this IServiceCollection services, IConfiguration cfg)
    {
        var cs = ConnectionString(cfg);
        services.AddDbContext<AppDb>(o => o.UseMySQL(cs, m => m.EnableRetryOnFailure(3)));
    }

    static string ToMySql(string url)
    {
        if (!url.StartsWith("mysql://")) return url;
        var u = new Uri(url);
        var userInfo = u.UserInfo.Split(':', 2);
        var port = u.Port > 0 ? u.Port : 3306;
        // Clever Cloud DEV permite 5 conexiones a la vez: el pool se queda en 4
        return $"Server={u.Host};Port={port};Database={u.AbsolutePath.TrimStart('/')};" +
               $"Uid={Uri.UnescapeDataString(userInfo[0])};Pwd={Uri.UnescapeDataString(userInfo.ElementAtOrDefault(1) ?? "")};" +
               "Maximum Pool Size=4;";
    }
}

// Para "dotnet ef migrations add ..." (usa una base local o la de prueba)
public class AppDbFactory : Microsoft.EntityFrameworkCore.Design.IDesignTimeDbContextFactory<AppDb>
{
    public AppDb CreateDbContext(string[] args)
    {
        var cfg = new ConfigurationBuilder().AddEnvironmentVariables().Build();
        var cs = cfg["DATABASE_URL"] is null && cfg["MYSQL_ADDON_URI"] is null
            ? "Server=localhost;Port=3306;Database=tienda;Uid=root;Pwd=;"
            : Database.ConnectionString(cfg);
        var o = new DbContextOptionsBuilder<AppDb>().UseMySQL(cs);
        return new AppDb(o.Options);
    }
}
