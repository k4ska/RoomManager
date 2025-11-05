using backend.Models.Enums;

namespace backend.Models.Classes
{
    public class Furniture
    {
        public int Id { get; set; }
        public int RoomId { get; set; }
        public StorageType Type { get; set; }
        public int X { get; set; }
        public int Y { get; set; }
        public int W { get; set; }
        public int H { get; set; }
        public int Rotation { get; set; }
        public string Emoji { get; set; } = string.Empty;
        public string? Name { get; set; }
        public Room Room { get; set; } = null!;
        public List<Item> Items { get; set; } = new List<Item>();
    }
}