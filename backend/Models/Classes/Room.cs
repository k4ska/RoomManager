namespace backend.Models.Classes
{
    public class Room
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Shape { get; set; } = string.Empty; // JSON
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public User User { get; set; } = null!;
        public List<Furniture> Furniture { get; set; } = new List<Furniture>();
    }
}