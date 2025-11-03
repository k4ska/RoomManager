using backend.Models.Classes;
using Microsoft.EntityFrameworkCore;

namespace backend.Data
{
    public class DataContext : DbContext
    {
        public DataContext(DbContextOptions<DataContext> options) : base(options)
        {
        }

        public DbSet<Room> Rooms { get; set; } = null!;
        public DbSet<User> Users { get; set; } = null!;
        public DbSet<Furniture> Furniture { get; set; } = null!;
        public DbSet<Item> Items { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Additional model configuration (indexes, relationships, conversions) can go here.
        }
    }
}