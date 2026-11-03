using Microsoft.EntityFrameworkCore;

namespace TiendaApi.Data;

public class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ImageBlob> Images => Set<ImageBlob>();

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
        b.Entity<ImageBlob>(e =>
        {
            e.ToTable("images");
            e.HasKey(i => i.Id);
            e.Property(i => i.Id).HasMaxLength(40);
            e.Property(i => i.ContentType).HasMaxLength(40);
        });
    }
}
