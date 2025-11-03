namespace csharp.Models.Classes
{
    public class Room
    {
        public int id { get; set; }
        public int userId { get; set; }
        public string name { get; set; } = string.Empty;
        public string? shape { get; set; } // JSON representation of the room shape
        public DateTime createdAt { get; set; }
        public DateTime updatedAt { get; set; }
        public User user { get; set; } = null!;
        public List<Furniture> furniture { get; set; } = new List<Furniture>();
    }
}