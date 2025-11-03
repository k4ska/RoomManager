using backend.Models.Classes;
using Microsoft.EntityFrameworkCore;

namespace backend.Data.Repos
{
    public class RoomsRepo
    {
        private readonly DataContext _context;

        public RoomsRepo(DataContext context)
        {
            _context = context;
        }

        // CRUD - CREATE
        public async Task<Room> SaveRoomToDb(Room room)
        {
            _context.Rooms.Add(room);
            await _context.SaveChangesAsync();
            return room;
        }

        // CRUD - READ
        public async Task<List<Room>> GetAllRooms() => await _context.Rooms.ToListAsync();

        // CRUD - UPDATE
        // public async Task<Room?> UpdateRoomById(int id, Room updatedRoom)
        // {

        // }

        // CRUD - DELETE
        public async Task<bool> DeleteRoomById(int id)
        {
            var room = await _context.Rooms.FindAsync(id);
            if (room == null) return false;

            _context.Rooms.Remove(room);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}