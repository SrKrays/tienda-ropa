using Microsoft.EntityFrameworkCore;

namespace TiendaApi.Data;

public class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ImageBlob> Images => Set<ImageBlob>();
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Product>(e =>
        {
            e.ToTable("products");
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).HasMaxLength(80);
            e.Property(p => p.Name).HasMaxLength(120);
            e.Property(p => p.Description).HasMaxLength(2000);
            e.Property(p => p.Tag).HasMaxLength(24);
            e.Property(p => p.FitType).HasMaxLength(24);
            e.Property(p => p.CategoriesJson).HasMaxLength(400);
            e.Property(p => p.ColorsJson).HasMaxLength(2000);
            e.Property(p => p.SizesJson).HasMaxLength(400);
            e.Property(p => p.MeasuresJson).HasMaxLength(2000);
            e.Property(p => p.FrontUrl).HasMaxLength(400);
            e.Property(p => p.BackUrl).HasMaxLength(400);
            e.HasIndex(p => p.SortOrder);
        });
        b.Entity<Order>(e =>
        {
            e.ToTable("orders");
            e.HasKey(o => o.Id);
            e.Property(o => o.Id).HasMaxLength(12);
            e.Property(o => o.CustomerName).HasMaxLength(80);
            e.Property(o => o.Phone).HasMaxLength(30);
            e.Property(o => o.Delivery).HasMaxLength(12);
            e.Property(o => o.Payment).HasMaxLength(20);
            e.Property(o => o.Address).HasMaxLength(200);
            e.Property(o => o.Note).HasMaxLength(300);
            e.Property(o => o.CustomerMeasures).HasMaxLength(200);
            e.Property(o => o.ItemsJson).HasMaxLength(6000);
            e.Property(o => o.ImageUrl).HasMaxLength(400);
            e.Property(o => o.Status).HasMaxLength(16);
            e.HasIndex(o => o.CreatedAt);
        });
        b.Entity<ImageBlob>(e =>
        {
            e.ToTable("images");
            e.HasKey(i => i.Id);
            e.Property(i => i.Id).HasMaxLength(40);
            e.Property(i => i.ContentType).HasMaxLength(40);
        });
    }
}
