using backend.Models.Classes;
using Microsoft.EntityFrameworkCore;

namespace backend.Data.Repos
{
    public class FurnitureRepo
    {
        private readonly DataContext _context;

        public FurnitureRepo(DataContext context)
        {
            _context = context;
        }

        // CRUD - LOOMINE
        public async Task<Furniture> SaveFurnitureToDb(Furniture furniture)
        {
            _context.Furniture.Add(furniture);
            await _context.SaveChangesAsync();
            return furniture;
        }

        // CRUD - LUGEMINE
        public async Task<List<Furniture>> GetAllFurniture() => await _context.Furniture.ToListAsync();

        // CRUD - UUENDAMINE
        // public async Task<Furniture?> UpdateFurnitureById(int id, Furniture updatedFurniture)
        // {

        // }

        // CRUD - KUSTUTAMINE
        public async Task<bool> DeleteFurnitureById(int id)
        {
            var furniture = await _context.Furniture.FindAsync(id);
            if (furniture == null) return false;

            _context.Furniture.Remove(furniture);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
