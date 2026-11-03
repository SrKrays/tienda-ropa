using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TiendaApi.Data;
using TiendaApi.Endpoints;
using TiendaApi.Images;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

// Render pasa el puerto en PORT
if (Environment.GetEnvironmentVariable("PORT") is { } port) builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
builder.WebHost.ConfigureKestrel(k => k.Limits.MaxRequestBodySize = 12 * 1024 * 1024);

builder.Services.AddAppDb(cfg);

if ((cfg["IMAGE_STORE"] ?? "db").Equals("ftp", StringComparison.OrdinalIgnoreCase))
    builder.Services.AddScoped<IImageStore, FtpImageStore>();
else
    builder.Services.AddScoped<IImageStore, DbImageStore>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = AuthEndpoints.Key(cfg),
        ClockSkew = TimeSpan.FromMinutes(1),
    };
});
builder.Services.AddAuthorization();

// CORS_ORIGINS = "https://tienda.vercel.app,http://localhost:5173" (vacío = cualquiera).
// El admin usa token en el header (no cookies), así que abrir los GET públicos no es riesgo.
var origins = (cfg["CORS_ORIGINS"] ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
{
    if (origins.Length == 0) p.AllowAnyOrigin(); else p.WithOrigins(origins);
    p.AllowAnyHeader().AllowAnyMethod();
}));

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "x",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));
    o.AddPolicy("orders", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "x",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(5) }));
});

builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

var app = builder.Build();

// Render atiende detrás de su proxy: así sabemos la IP real (para los límites) y que la dirección es https
var fwd = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost };
fwd.KnownIPNetworks.Clear();
fwd.KnownProxies.Clear();
app.UseForwardedHeaders(fwd);
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

// crea / actualiza las tablas al arrancar (migraciones de EF Core en Migrations/)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDb>();
    for (var i = 1; ; i++)
    {
        try { db.Database.Migrate(); break; }
        catch (Exception e) when (i < 6)
        {
            app.Logger.LogWarning("La base todavía no responde ({Msg}), reintento {I}/5…", e.Message, i);
            Thread.Sleep(3000 * i);
        }
    }
}

// para que Render no la duerma (cron-job.org cada 10 min) y para chequear que anda
app.MapGet("/health", () => Results.Ok(new { ok = true, time = DateTime.UtcNow }));
app.MapGet("/", () => Results.Text("Tienda API ✔"));

app.MapAuthEndpoints();
app.MapProductEndpoints();
app.MapOrderEndpoints();

app.Run();
