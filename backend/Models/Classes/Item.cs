namespace backend.Models.Classes
{
    public class Item
    {
        public int Id { get; set; }
        public int FurnitureId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public bool IsTaken { get; set; }
        public Furniture Furniture { get; set; } = null!;
    }
}