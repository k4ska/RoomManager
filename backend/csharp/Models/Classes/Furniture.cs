using csharp.Models.Enums;

namespace csharp.Models.Classes
{
    public class Furniture
    {
        public int id { get; set; }
        public int roomId { get; set; }
        public StorageType storageType { get; set; }
        public int x { get; set; }
        public int y { get; set; }
        public int w { get; set; }
        public int h { get; set; }
        public int rotations { get; set; }
        public string emoji { get; set; } = string.Empty;
        public string? name { get; set; }
        public Room room { get; set; } = null!;
        public List<Item> items { get; set; } = new List<Item>();
    }
}