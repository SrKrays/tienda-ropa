namespace TiendaApi.Data;

// Una prenda del perchero. Las listas (talles, colores, categorías, medidas) se guardan como JSON
// en columnas de texto: así la misma tabla funciona igual en PostgreSQL y en MySQL.
public class Product
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public int Price { get; set; }
    public int? OldPrice { get; set; }
    public string? Tag { get; set; }
    public string CategoriesJson { get; set; } = "[]";
    public string FitType { get; set; } = "remera";
    public bool TryOn { get; set; } = true;
    public string ColorsJson { get; set; } = "[]";
    public string SizesJson { get; set; } = "{}";
    public string? MeasuresJson { get; set; }
    public string FrontUrl { get; set; } = "";
    public string? BackUrl { get; set; }
    public int SortOrder { get; set; }
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

// Foto guardada en la base (solo cuando IMAGE_STORE=db, el modo de prueba).
public class ImageBlob
{
    public string Id { get; set; } = "";
    public string ContentType { get; set; } = "image/webp";
    public byte[] Data { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
