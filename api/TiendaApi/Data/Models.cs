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

// Pedido que arma la persona en el carrito. No se paga acá: sirve para el link con fotos
// que va en el mensaje de WhatsApp (y para que el local vea la lista en el panel).
public class Order
{
    public string Id { get; set; } = ""; // código corto: "K7P2QX"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string CustomerName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Delivery { get; set; } = "retiro";
    public string Payment { get; set; } = "transferencia";
    public string? Address { get; set; }
    public string? Note { get; set; }
    public string? CustomerMeasures { get; set; } // "1,78 m · 75 kg · pecho ~96 cm · le gusta regular"
    public string ItemsJson { get; set; } = "[]";
    public int Total { get; set; }
    public string? ImageUrl { get; set; } // imagen del pedido (la que muestra WhatsApp en la vista previa)
    public string Status { get; set; } = "nuevo";
}
