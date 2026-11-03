namespace TiendaApi.Endpoints;

// Tabla de talles estándar (la misma que src/fit/sizing.js del frontend). Se usa cuando la prenda
// todavía no tiene medidas reales cargadas en el panel.
public static class StandardSizes
{
    static readonly Dictionary<string, Dictionary<string, MeasureDto>> Tables = new()
    {
        ["remera"] = new() { ["S"] = new(50, 70, 19), ["M"] = new(53, 72, 20), ["L"] = new(56, 74, 21), ["XL"] = new(59, 76, 22), ["XXL"] = new(62, 78, 23) },
        ["oversize"] = new() { ["S"] = new(55, 70, 22), ["M"] = new(58, 72, 23), ["L"] = new(61, 74, 24), ["XL"] = new(64, 76, 25), ["XXL"] = new(67, 78, 26) },
        ["buzo"] = new() { ["S"] = new(56, 66, 60), ["M"] = new(59, 68, 62), ["L"] = new(62, 70, 64), ["XL"] = new(65, 72, 66), ["XXL"] = new(68, 74, 68) },
        ["camiseta"] = new() { ["S"] = new(49, 70, 20), ["M"] = new(52, 72, 21), ["L"] = new(55, 74, 22), ["XL"] = new(58, 76, 23), ["XXL"] = new(61, 78, 24) },
    };

    public static MeasureDto? Get(string fitType, string size) =>
        Tables.TryGetValue(fitType, out var t) && t.TryGetValue(size, out var m) ? m : null;
}
