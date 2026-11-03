using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using TiendaApi.Data;

namespace TiendaApi.Endpoints;

public record ColorDto(string Id, string Name, string Hex);
public record MeasureDto(int Ancho, int Largo, int Manga);

// Lo que ve la tienda (mismos nombres que el catálogo del frontend)
public record ProductDto(
    string Id, string Name, string Description, int Price, int? OldPrice, string? Tag,
    string[] Categories, string FitType, bool TryOn, ColorDto[] Colors, Dictionary<string, int> Sizes,
    Dictionary<string, MeasureDto>? Measures, string Front, string? Back, bool Active, int Order);

// Lo que manda el formulario del admin (campo "data" del multipart)
public record ProductInput(
    string Name, string? Description, int Price, int? OldPrice, string? Tag, string[]? Categories,
    string? FitType, bool? TryOn, ColorDto[]? Colors, Dictionary<string, int>? Sizes,
    Dictionary<string, MeasureDto>? Measures, bool? Active, bool? RemoveBack);

public static partial class ProductMap
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static readonly string[] SizeOrder = ["S", "M", "L", "XL", "XXL"];
    public static readonly string[] Categories = ["mujer", "hombre", "basicos", "ofertas"];
    public static readonly string[] FitTypes = ["remera", "oversize", "buzo", "camiseta"];

    public static ProductDto ToDto(Product p) => new(
        p.Id, p.Name, p.Description, p.Price, p.OldPrice, p.Tag,
        JsonSerializer.Deserialize<string[]>(p.CategoriesJson, Json) ?? [],
        p.FitType, p.TryOn,
        JsonSerializer.Deserialize<ColorDto[]>(p.ColorsJson, Json) ?? [],
        JsonSerializer.Deserialize<Dictionary<string, int>>(p.SizesJson, Json) ?? [],
        p.MeasuresJson is null ? null : JsonSerializer.Deserialize<Dictionary<string, MeasureDto>>(p.MeasuresJson, Json),
        p.FrontUrl, p.BackUrl, p.Active, p.SortOrder);

    // Valida y copia los datos del formulario a la prenda. Devuelve los errores en castellano simple.
    public static List<string> Apply(ProductInput i, Product p)
    {
        var err = new List<string>();
        var name = (i.Name ?? "").Trim();
        if (name.Length < 2) err.Add("Poné el nombre de la prenda.");
        if (name.Length > 120) err.Add("El nombre es muy largo (máximo 120 letras).");
        var desc = (i.Description ?? "").Trim();
        if (desc.Length > 2000) err.Add("La descripción es muy larga (máximo 2000 letras).");
        if (i.Price <= 0 || i.Price > 50_000_000) err.Add("Revisá el precio.");
        if (i.OldPrice is { } op && (op <= i.Price || op > 50_000_000)) err.Add("El precio anterior tiene que ser mayor al precio actual.");

        var sizes = new Dictionary<string, int>();
        foreach (var (k, v) in i.Sizes ?? [])
        {
            var key = k.Trim().ToUpperInvariant();
            if (!SizeOrder.Contains(key)) { err.Add($"Talle desconocido: {k}."); continue; }
            if (v < 0 || v > 9999) { err.Add($"Revisá el stock del talle {key}."); continue; }
            sizes[key] = v;
        }
        if (sizes.Count == 0) err.Add("Cargá al menos un talle.");

        var colors = (i.Colors ?? [])
            .Where(c => !string.IsNullOrWhiteSpace(c.Name))
            .Take(8)
            .Select(c => new ColorDto(Slug(c.Name, 24), c.Name.Trim()[..Math.Min(40, c.Name.Trim().Length)],
                HexRx().IsMatch(c.Hex ?? "") ? c.Hex!.ToLowerInvariant() : "#888888"))
            .ToArray();

        Dictionary<string, MeasureDto>? measures = null;
        if (i.Measures is { Count: > 0 })
        {
            measures = [];
            foreach (var (k, m) in i.Measures)
            {
                var key = k.Trim().ToUpperInvariant();
                if (!SizeOrder.Contains(key) || m.Ancho <= 0) continue;
                if (m.Ancho > 120 || m.Largo is < 0 or > 150 || m.Manga is < 0 or > 100) { err.Add($"Revisá las medidas del talle {key}."); continue; }
                measures[key] = m;
            }
            if (measures.Count == 0) measures = null;
        }

        if (err.Count > 0) return err;

        p.Name = name;
        p.Description = desc;
        p.Price = i.Price;
        p.OldPrice = i.OldPrice;
        p.Tag = string.IsNullOrWhiteSpace(i.Tag) ? null : i.Tag.Trim().ToUpperInvariant()[..Math.Min(24, i.Tag.Trim().Length)];
        p.CategoriesJson = JsonSerializer.Serialize((i.Categories ?? []).Select(c => c.ToLowerInvariant()).Where(Categories.Contains).Distinct(), Json);
        p.FitType = FitTypes.Contains(i.FitType) ? i.FitType! : "remera";
        p.TryOn = i.TryOn ?? p.FitType != "buzo";
        p.ColorsJson = JsonSerializer.Serialize(colors, Json);
        p.SizesJson = JsonSerializer.Serialize(SizeOrder.Where(sizes.ContainsKey).ToDictionary(s => s, s => sizes[s]), Json);
        p.MeasuresJson = measures is null ? null : JsonSerializer.Serialize(measures, Json);
        if (i.Active is { } a) p.Active = a;
        p.UpdatedAt = DateTime.UtcNow;
        return err;
    }

    // "Remera Básica Blanca" → "remera-basica-blanca"
    public static string Slug(string text, int max = 40)
    {
        // (sin depender de la configuración regional del servidor)
        const string from = "áàäâãéèëêíìïîóòöôõúùüûñç";
        const string to = "aaaaaeeeeiiiiooooouuuunc";
        var sb = new StringBuilder();
        foreach (var c in text.Trim().ToLowerInvariant())
        {
            var k = from.IndexOf(c);
            var ch = k >= 0 ? to[k] : c;
            sb.Append(char.IsAsciiLetterOrDigit(ch) ? ch : '-');
        }
        var slug = DashRx().Replace(sb.ToString(), "-").Trim('-');
        if (slug.Length > max) slug = slug[..max].TrimEnd('-');
        return slug.Length == 0 ? "prenda" : slug;
    }

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")] private static partial Regex HexRx();
    [GeneratedRegex("-+")] private static partial Regex DashRx();
}
