namespace csharp.Models.Classes
{
    public class User
    {
        public int id { get; set; }
        public string email { get; set; } = string.Empty;
        public string passwordHash { get; set; } = string.Empty;
        public string? name { get; set; }
        public DateTime createdAt { get; set; }
        public DateTime updatedAt { get; set; }
        public List<Room> rooms { get; set; } = new List<Room>();
    }
}