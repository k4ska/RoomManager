using backend.Models.Classes;
using Microsoft.EntityFrameworkCore;

namespace backend.Data.Repos
{
    public class ItemsRepo
    {
        private readonly DataContext _context;

        public ItemsRepo(DataContext context)
        {
            _context = context;
        }

        // CRUD - CREATE
        public async Task<Item> SaveItemToDb(Item item)
        {
            _context.Items.Add(item);
            await _context.SaveChangesAsync();
            return item;
        }

        // CRUD - READ
        public async Task<List<Item>> GetAllItems() => await _context.Items.ToListAsync();

        // CRUD - UPDATE
        // public async Task<Item?> UpdateItemById(int id, Item updatedItem)
        // {

        // }

        // CRUD - DELETE
        public async Task<bool> DeleteItemById(int id)
        {
            var item = await _context.Items.FindAsync(id);
            if (item == null) return false;

            _context.Items.Remove(item);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}