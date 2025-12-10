using backend.Data;
using backend.Data.Repos;
using backend.Models.Classes;
using backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    [Route("api")]
    public class RoomsController : ControllerBase
    {
        private readonly DataContext _db;
        private readonly ITokenService _tokens;
        public RoomsController(DataContext db, ITokenService tokens)
        {
            _db = db; _tokens = tokens;
        }

        int? CurrentUserId()
        {
            var cookie = Request.Cookies[Environment.GetEnvironmentVariable("SESSION_COOKIE_NAME") ?? "rm_session"];
            return string.IsNullOrEmpty(cookie) ? null : _tokens.ValidateTokenAndGetUserId(cookie);
        }

        // GET /api/room-shape (toa kuju toomine)
        [HttpGet("room-shape")]
        public async Task<IActionResult> GetRoomShape()
        {
            var uid = CurrentUserId(); if (uid is null) return Unauthorized(new { ok = false, error = "Unauthorized" });
            var room = await _db.Rooms.FirstOrDefaultAsync(r => r.UserId == uid.Value);
            if (room == null)
            {
                room = new Room { UserId = uid.Value, Name = "Minu tuba", Shape = "[]", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
                _db.Rooms.Add(room); await _db.SaveChangesAsync();
                return Ok(new { ok = true, shape = (object?)null, roomId = room.Id });
            }
            var shape = string.IsNullOrWhiteSpace(room.Shape) ? null : System.Text.Json.JsonSerializer.Deserialize<object>(room.Shape);
            return Ok(new { ok = true, shape, roomId = room.Id });
        }

        public record ShapeDto(object? points, object? windows, object? doors);
        // PATCH /api/room-shape (toa kuju salvestamine)
        [HttpPatch("room-shape")]
        public async Task<IActionResult> PatchRoomShape([FromBody] ShapeDto dto)
        {
            var uid = CurrentUserId(); if (uid is null) return Unauthorized(new { ok = false, error = "Unauthorized" });
            if (dto?.points is null) return BadRequest(new { ok = false, error = "points required" });
            var room = await _db.Rooms.FirstOrDefaultAsync(r => r.UserId == uid.Value);
            if (room == null)
            {
                room = new Room { UserId = uid.Value, Name = "Minu tuba", Shape = "[]", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
                _db.Rooms.Add(room); await _db.SaveChangesAsync();
            }
            // Persist full shape object (points + windows + doors) so frontend can store additional geometry
            var shapeObj = new { points = dto.points, windows = dto.windows, doors = dto.doors };
            room.Shape = System.Text.Json.JsonSerializer.Serialize(shapeObj);
            room.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { ok = true, roomId = room.Id });
        }

        // GET /api/rooms (kasutaja toad)
        [HttpGet("rooms")]
        public async Task<IActionResult> GetRooms()
        {
            var uid = CurrentUserId(); if (uid is null) return Unauthorized(new { ok = false, error = "Unauthorized" });
            var rooms = await _db.Rooms.Where(r => r.UserId == uid.Value).OrderBy(r => r.Id).Select(r => new { id = r.Id, name = r.Name, createdAt = r.CreatedAt, updatedAt = r.UpdatedAt }).ToListAsync();
            return Ok(new { ok = true, rooms });
        }

        public record CreateRoomDto(string? name);
        // POST /api/rooms (loo uus tuba)
        [HttpPost("rooms")]
        public async Task<IActionResult> CreateRoom([FromBody] CreateRoomDto dto)
        {
            var uid = CurrentUserId(); if (uid is null) return Unauthorized(new { ok = false, error = "Unauthorized" });
            var room = new Room { UserId = uid.Value, Name = string.IsNullOrWhiteSpace(dto?.name) ? "Minu tuba" : dto!.name!, Shape = "[]", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            _db.Rooms.Add(room); await _db.SaveChangesAsync();
            return StatusCode(201, new { ok = true, room = new { id = room.Id, name = room.Name } });
        }

        // GET /api/rooms/{roomId}/units (toa üksused koos esemetega)
        [HttpGet("rooms/{roomId:int}/units")]
        public async Task<IActionResult> GetUnits(int roomId)
        {
            var uid = CurrentUserId(); if (uid is null) return Unauthorized(new { ok = false, error = "Unauthorized" });
            var room = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == roomId && r.UserId == uid.Value);
            if (room == null) return NotFound(new { ok = false, error = "Room not found" });
            var units = await _db.Furniture.Where(f => f.RoomId == roomId)
                .Include(f => f.Items)
                .OrderBy(f => f.Id)
                .Select(f => new { id = f.Id, type = f.Type.ToString(), x = f.X, y = f.Y, w = f.W, h = f.H, rotation = f.Rotation, emoji = f.Emoji, name = f.Name, items = f.Items.Select(i => new { id = i.Id, name = i.Name, quantity = i.Quantity }) })
                .ToListAsync();
            return Ok(new { ok = true, units });
        }

        public class CreateUnitDto { public string type { get; set; } = "box"; public int x { get; set; } public int y { get; set; } public int w { get; set; } public int h { get; set; } public int rotation { get; set; } public string emoji { get; set; } = string.Empty; public string? name { get; set; } }
        // POST /api/rooms/{roomId}/units (loo uus üksus)
        [HttpPost("rooms/{roomId:int}/units")]
        public async Task<IActionResult> CreateUnit(int roomId, [FromBody] CreateUnitDto dto)
        {
            var uid = CurrentUserId(); if (uid is null) return Unauthorized(new { ok = false, error = "Unauthorized" });
            var room = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == roomId && r.UserId == uid.Value);
            if (room == null) return NotFound(new { ok = false, error = "Room not found" });
            if (!Enum.TryParse<backend.Models.Enums.StorageType>(dto.type, true, out var st)) st = backend.Models.Enums.StorageType.box;
            var f = new Furniture { RoomId = roomId, Type = st, X = dto.x, Y = dto.y, W = dto.w, H = dto.h, Rotation = dto.rotation, Emoji = dto.emoji, Name = dto.name };
            _db.Furniture.Add(f); await _db.SaveChangesAsync();
            return StatusCode(201, new { ok = true, unit = new { id = f.Id, type = dto.type, x = f.X, y = f.Y, w = f.W, h = f.H, rotation = f.Rotation, emoji = f.Emoji, name = f.Name } });
        }

        public class PatchUnitDto { public int? x { get; set; } public int? y { get; set; } public int? w { get; set; } public int? h { get; set; } public int? rotation { get; set; } public string? emoji { get; set; } public string? name { get; set; } public string? type { get; set; } }
        // PATCH /api/units/{unitId} (uuenda üksust)
        [HttpPatch("units/{unitId:int}")]
        public async Task<IActionResult> PatchUnit(int unitId, [FromBody] PatchUnitDto dto)
        {
            var uid = CurrentUserId(); if (uid is null) return Unauthorized(new { ok = false, error = "Unauthorized" });
            var f = await _db.Furniture.Include(x => x.Room).FirstOrDefaultAsync(x => x.Id == unitId);
            if (f == null || f.Room.UserId != uid.Value) return NotFound(new { ok = false, error = "Unit not found" });
            if (dto.x.HasValue) f.X = dto.x.Value; if (dto.y.HasValue) f.Y = dto.y.Value; if (dto.w.HasValue) f.W = dto.w.Value; if (dto.h.HasValue) f.H = dto.h.Value; if (dto.rotation.HasValue) f.Rotation = dto.rotation.Value; if (dto.emoji != null) f.Emoji = dto.emoji; if (dto.name != null) f.Name = dto.name; if (dto.type != null && Enum.TryParse<backend.Models.Enums.StorageType>(dto.type, true, out var nt)) f.Type = nt;
            await _db.SaveChangesAsync();
            return Ok(new { ok = true, unit = new { id = f.Id } });
        }

        // DELETE /api/units/{unitId} (kustuta üksus)
        [HttpDelete("units/{unitId:int}")]
        public async Task<IActionResult> DeleteUnit(int unitId)
        {
            var uid = CurrentUserId(); if (uid is null) return Unauthorized(new { ok = false, error = "Unauthorized" });
            var f = await _db.Furniture.Include(x => x.Room).FirstOrDefaultAsync(x => x.Id == unitId);
            if (f == null || f.Room.UserId != uid.Value) return NotFound(new { ok = false, error = "Unit not found" });
            _db.Furniture.Remove(f); await _db.SaveChangesAsync();
            return Ok(new { ok = true });
        }

        // PUT /api/rooms/{roomId}/layout  (paigutuse atomaarselt täielik asendus)
        // Paigutuse DTO-d: üksuse sisu, üksus ja kogu paigutus
        public class LayoutItemDto { public string name { get; set; } = "Ese"; public int quantity { get; set; } }
        public class LayoutUnitDto { public string type { get; set; } = "box"; public int x { get; set; } public int y { get; set; } public int w { get; set; } public int h { get; set; } public int rotation { get; set; } public string emoji { get; set; } = string.Empty; public string? name { get; set; } public List<LayoutItemDto>? contents { get; set; } }
        public class LayoutDto { public List<LayoutUnitDto>? units { get; set; } }
        [HttpPut("rooms/{roomId:int}/layout")]
        public async Task<IActionResult> PutLayout(int roomId, [FromBody] LayoutDto dto)
        {
            Console.WriteLine($"[layout] PUT rooms/{roomId}/layout payloadUnits={dto?.units?.Count ?? 0}");
            var uid = CurrentUserId(); if (uid is null) return Unauthorized(new { ok = false, error = "Unauthorized" });
            var room = await _db.Rooms.FirstOrDefaultAsync(r => r.Id == roomId && r.UserId == uid.Value);
            if (room == null) return NotFound(new { ok = false, error = "Room not found" });

            using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                // Kustuta olemasolevad üksused ja esemed
                var existing = await _db.Furniture.Where(f => f.RoomId == roomId).ToListAsync();
                if (existing.Count > 0)
                {
                    var unitIds = existing.Select(f => f.Id).ToList();
                    var oldItems = _db.Items.Where(i => unitIds.Contains(i.FurnitureId));
                    _db.Items.RemoveRange(oldItems);
                    _db.Furniture.RemoveRange(existing);
                    await _db.SaveChangesAsync();
                }

                // Loo uued üksused ja nende esemed
                foreach (var u in dto.units ?? new List<LayoutUnitDto>())
                {
                    if (!Enum.TryParse<backend.Models.Enums.StorageType>(u.type, true, out var st)) st = backend.Models.Enums.StorageType.box;
                    var f = new Furniture { RoomId = roomId, Type = st, X = u.x, Y = u.y, W = u.w, H = u.h, Rotation = u.rotation, Emoji = u.emoji, Name = u.name };
                    _db.Furniture.Add(f);
                    await _db.SaveChangesAsync();
                    if (u.contents != null)
                    {
                        foreach (var it in u.contents)
                        {
                            _db.Items.Add(new Item { FurnitureId = f.Id, Name = it.name ?? "Ese", Quantity = Math.Max(1, it.quantity) });
                        }
                        await _db.SaveChangesAsync();
                    }
                }

                await tx.CommitAsync();
                Console.WriteLine($"[layout] saved units={dto?.units?.Count ?? 0} for room={roomId} user={uid.Value}");
                return Ok(new { ok = true });
            }
            catch
            {
                Console.WriteLine("[layout] ERROR saving layout");
                await tx.RollbackAsync();
                return StatusCode(500, new { ok = false, error = "Failed to save layout" });
            }
        }

        // Klientidele, kes eelistavad PUT asemel POST-i
        [HttpPost("rooms/{roomId:int}/layout")]
        public Task<IActionResult> PostLayout(int roomId, [FromBody] LayoutDto dto)
            => PutLayout(roomId, dto);

        // POST /api/layout (kasutab või loob kasutaja toa automaatselt)
        [HttpPost("layout")]
        public async Task<IActionResult> PostLayoutImplicit([FromBody] LayoutDto dto)
        {
            var uid = CurrentUserId(); if (uid is null) return Unauthorized(new { ok = false, error = "Unauthorized" });
            var room = await _db.Rooms.FirstOrDefaultAsync(r => r.UserId == uid.Value);
            if (room == null)
            {
                room = new Room { UserId = uid.Value, Name = "Minu tuba", Shape = "[]", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
                _db.Rooms.Add(room); await _db.SaveChangesAsync();
            }
            return await PutLayout(room.Id, dto);
        }
    }
}
