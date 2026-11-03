using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace TiendaApi.Endpoints;

public static class AuthEndpoints
{
    public record LoginInput(string Password);

    public static SymmetricSecurityKey Key(IConfiguration cfg)
    {
        var k = cfg["JWT_KEY"];
        if (string.IsNullOrEmpty(k) || k.Length < 32) throw new InvalidOperationException("JWT_KEY tiene que tener al menos 32 caracteres");
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(k));
    }

    public static void MapAuthEndpoints(this WebApplication app)
    {
        // Un solo usuario: la contraseña del local (ADMIN_PASSWORD). Máximo 5 intentos por minuto.
        app.MapPost("/api/auth/login", (LoginInput body, IConfiguration cfg) =>
        {
            var expected = cfg["ADMIN_PASSWORD"] ?? "";
            if (expected.Length < 8) return Results.Problem("ADMIN_PASSWORD no está configurada", statusCode: 500);
            var ok = CryptographicOperations.FixedTimeEquals(
                SHA256.HashData(Encoding.UTF8.GetBytes(body.Password ?? "")),
                SHA256.HashData(Encoding.UTF8.GetBytes(expected)));
            if (!ok) return Results.Json(new { errors = new[] { "Contraseña incorrecta." } }, statusCode: 401);

            var expires = DateTime.UtcNow.AddHours(12);
            var token = new JwtSecurityToken(
                claims: [new Claim(ClaimTypes.Role, "admin")],
                expires: expires,
                signingCredentials: new SigningCredentials(Key(cfg), SecurityAlgorithms.HmacSha256));
            return Results.Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token), expires });
        }).RequireRateLimiting("login");
    }
}
