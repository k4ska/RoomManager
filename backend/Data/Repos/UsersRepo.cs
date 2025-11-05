using System;
using System.Threading.Tasks;
using backend.Models.Classes;
using backend.Services;
using Microsoft.EntityFrameworkCore;

namespace backend.Data.Repos
{
    public class UsersRepo
    {
        private readonly DataContext _context;
        private readonly IPasswordHasher _hasher;
        private readonly ITokenService _tokenService;

        public UsersRepo(DataContext context, IPasswordHasher hasher, ITokenService tokenService)
        {
            _context = context;
            _hasher = hasher;
            _tokenService = tokenService;
        }

        public async Task<User?> GetByIdAsync(int id)
        {
            return await _context.Users.FindAsync(id);
        }

        public async Task<(bool Success, string? Token, User? User, string? Error)> LoginAsync(string email, string password)
        {
            var normalized = email?.Trim().ToLowerInvariant();
            var dbUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == normalized);
            if (dbUser == null) return (false, null, null, "Invalid credentials");

            var ok = _hasher.Verify(password, dbUser.PasswordHash);
            if (!ok) return (false, null, null, "Invalid credentials");

            var token = _tokenService.GenerateToken(dbUser.Id, dbUser.Email);
            return (true, token, dbUser, null);
        }

        public async Task<(bool Success, string? Token, User? User, string? Error)> RegisterAsync(string email, string password, string? name = null)
        {
            var normalized = email?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(normalized) || string.IsNullOrEmpty(password))
            {
                return (false, null, null, "Email and password required");
            }

            var exists = await _context.Users.AnyAsync(u => u.Email == normalized);
            if (exists) return (false, null, null, "User already exists");

            var hash = _hasher.Hash(password);
            var user = new User
            {
                Email = normalized,
                PasswordHash = hash,
                Name = string.IsNullOrWhiteSpace(name) ? null : name,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var token = _tokenService.GenerateToken(user.Id, user.Email);
            return (true, token, user, null);
        }
    }
}