using backend.Data;
using backend.Models.Classes;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    [Route("api")]
    public class ItemsController : ControllerBase
    {
        private readonly DataContext _db;
        private readonly ITokenService _tokens;
        public ItemsController(DataContext db, ITokenService tokens)
        { _db = db; _tokens = tokens; }

        int? CurrentUserId()
        {
            var cookie = Request.Cookies[Environment.GetEnvironmentVariable("SESSION_COOKIE_NAME") ?? "rm_session"];
            return string.IsNullOrEmpty(cookie) ? null : _tokens.ValidateTokenAndGetUserId(cookie);
        }

        // GET /api/units/{unitId}/items (üksuse esemete loetelu)
        [HttpGet("units/{unitId:int}/items")]
        public async Task<IActionResult> GetItems(int unitId)
        {
            var uid = CurrentUserId(); if (uid is null) return Unauthorized(new { ok = false, error = "Unauthorized" });
            var unit = await _db.Furniture.Include(f => f.Room).FirstOrDefaultAsync(f => f.Id == unitId);
            if (unit == null || unit.Room.UserId != uid.Value) return NotFound(new { ok = false, error = "Unit not found" });
            var items = await _db.Items.Where(i => i.FurnitureId == unitId).OrderBy(i => i.Id).Select(i => new { id = i.Id, name = i.Name, quantity = i.Quantity }).ToListAsync();
            return Ok(new { ok = true, items });
        }

        public record CreateItemDto(string name, int quantity);
        // POST /api/units/{unitId}/items (loo uus ese üksuses)
        [HttpPost("units/{unitId:int}/items")]
        public async Task<IActionResult> CreateItem(int unitId, [FromBody] CreateItemDto dto)
        {
            var uid = CurrentUserId(); if (uid is null) return Unauthorized(new { ok = false, error = "Unauthorized" });
            var unit = await _db.Furniture.Include(f => f.Room).FirstOrDefaultAsync(f => f.Id == unitId);
            if (unit == null || unit.Room.UserId != uid.Value) return NotFound(new { ok = false, error = "Unit not found" });
            var it = new Item { FurnitureId = unitId, Name = dto.name ?? "Ese", Quantity = Math.Max(1, dto.quantity) };
            _db.Items.Add(it); await _db.SaveChangesAsync();
            return StatusCode(201, new { ok = true, item = new { id = it.Id, name = it.Name, quantity = it.Quantity } });
        }

        // DELETE /api/items/{itemId} (kustuta ese)
        [HttpDelete("items/{itemId:int}")]
        public async Task<IActionResult> DeleteItem(int itemId)
        {
            var uid = CurrentUserId(); if (uid is null) return Unauthorized(new { ok = false, error = "Unauthorized" });
            var it = await _db.Items.Include(x => x.Furniture).ThenInclude(f => f.Room).FirstOrDefaultAsync(i => i.Id == itemId);
            if (it == null || it.Furniture.Room.UserId != uid.Value) return NotFound(new { ok = false, error = "Item not found" });
            _db.Items.Remove(it); await _db.SaveChangesAsync();
            return Ok(new { ok = true });
        }
    }
}
