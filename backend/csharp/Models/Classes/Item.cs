namespace csharp.Models.Classes
{
    public class Item
    {
        public int id { get; set; }
        public int furnitureId { get; set; }
        public string name { get; set; } = string.Empty;
        public int quantity { get; set; }
        public Furniture furniture { get; set; } = null!;
    }
}