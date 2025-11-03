using System;
using System.Threading.Tasks;
using backend.Data.Repos;
using backend.Models.Classes;
using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly UsersRepo _usersRepo;
        private readonly ITokenService _tokenService;
        private readonly IWebHostEnvironment _env;

        public AuthController(UsersRepo usersRepo, ITokenService tokenService, IWebHostEnvironment env)
        {
            _usersRepo = usersRepo;
            _tokenService = tokenService;
            _env = env;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto body)
        {
            var (success, token, user, error) = await _usersRepo.RegisterAsync(body.Email, body.Password, body.Name);
            if (!success) return Conflict(new { ok = false, error });

            AppendSessionCookie(token!);

            return StatusCode(201, new { ok = true, user = new { id = user!.Id, email = user.Email, name = user.Name } });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto body)
        {
            var (success, token, user, error) = await _usersRepo.LoginAsync(body.Email, body.Password);
            if (!success) return Unauthorized(new { ok = false, error });

            AppendSessionCookie(token!);
            return Ok(new { ok = true, user = new { id = user!.Id, email = user.Email, name = user.Name } });
        }

        [HttpPost("logout")]
        public IActionResult Logout()
        {
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Path = "/",
                SameSite = SameSiteMode.Lax,
                Secure = _env.IsProduction(),
                MaxAge = TimeSpan.Zero
            };
            Response.Cookies.Append("rm_session", "", cookieOptions);
            return Ok(new { ok = true });
        }

        [HttpGet("me")]
        public async Task<IActionResult> Me()
        {
            var cookie = Request.Cookies["rm_session"];
            if (string.IsNullOrEmpty(cookie)) return Ok(new { ok = true, user = (object?)null });

            var uid = _tokenService.ValidateTokenAndGetUserId(cookie);
            if (uid == null) return Ok(new { ok = true, user = (object?)null });

            var user = await _usersRepo.GetByIdAsync(uid.Value);
            if (user == null) return Ok(new { ok = true, user = (object?)null });

            return Ok(new { ok = true, user = new { id = user.Id, email = user.Email, name = user.Name } });
        }

        private void AppendSessionCookie(string token)
        {
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Path = "/",
                SameSite = SameSiteMode.Lax,
                Secure = _env.IsProduction(),
                MaxAge = TimeSpan.FromDays(7)
            };
            Response.Cookies.Append("rm_session", token, cookieOptions);
        }
    }

    public record RegisterDto(string Email, string Password, string? Name);
    public record LoginDto(string Email, string Password);
}
