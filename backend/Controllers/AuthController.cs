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
        private readonly string _cookieName;
        private readonly string? _cookieDomain;

        public AuthController(UsersRepo usersRepo, ITokenService tokenService, IWebHostEnvironment env, IConfiguration cfg)
        {
            _usersRepo = usersRepo;
            _tokenService = tokenService;
            _env = env;
            _cookieName = cfg["SESSION_COOKIE_NAME"] ?? Environment.GetEnvironmentVariable("SESSION_COOKIE_NAME") ?? "rm_session";
            _cookieDomain = cfg["SESSION_COOKIE_DOMAIN"] ?? Environment.GetEnvironmentVariable("SESSION_COOKIE_DOMAIN");
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto? body)
        {
            try
            {
                if (body is null)
                    return BadRequest(new { ok = false, error = "Invalid JSON body" });
                var (success, token, user, error) = await _usersRepo.RegisterAsync(body.Email, body.Password, body.Name);
                if (!success) return Conflict(new { ok = false, error });
                AppendSessionCookie(token!);
                return StatusCode(201, new { ok = true, user = new { id = user!.Id, email = user.Email, name = user.Name } });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[auth.register] {ex}");
                return StatusCode(500, new { ok = false, error = "Server error" });
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto? body)
        {
            try
            {
                if (body is null)
                    return BadRequest(new { ok = false, error = "Invalid JSON body" });
                var (success, token, user, error) = await _usersRepo.LoginAsync(body.Email, body.Password);
                if (!success) return Unauthorized(new { ok = false, error });
                AppendSessionCookie(token!);
                return Ok(new { ok = true, user = new { id = user!.Id, email = user.Email, name = user.Name } });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[auth.login] {ex}");
                return StatusCode(500, new { ok = false, error = "Server error" });
            }
        }

        [HttpPost("logout")]
        public IActionResult Logout()
        {
            // Küpsise kustutamine: arenduses piisab SameSite=Lax (localhost:3000 ↔ 4000 on same-site)
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Path = "/",
                SameSite = _env.IsProduction() ? SameSiteMode.None : SameSiteMode.Lax,
                Secure = _env.IsProduction(),
                MaxAge = TimeSpan.Zero
            };
            if (!string.IsNullOrEmpty(_cookieDomain))
            {
                cookieOptions.Domain = _cookieDomain;
            }
            Response.Cookies.Append(_cookieName, "", cookieOptions);
            return Ok(new { ok = true });
        }

        [HttpGet("me")]
        public async Task<IActionResult> Me()
        {
            var cookie = Request.Cookies[_cookieName];
            if (string.IsNullOrEmpty(cookie)) return Ok(new { ok = true, user = (object?)null });

            var uid = _tokenService.ValidateTokenAndGetUserId(cookie);
            if (uid == null) return Ok(new { ok = true, user = (object?)null });

            var user = await _usersRepo.GetByIdAsync(uid.Value);
            if (user == null) return Ok(new { ok = true, user = (object?)null });

            return Ok(new { ok = true, user = new { id = user.Id, email = user.Email, name = user.Name } });
        }

        private void AppendSessionCookie(string token)
        {
            // Sessiooniküpsise seadmine: arenduses kasuta SameSite=Lax (localhost:3000 ↔ 4000 on same-site)
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Path = "/",
                SameSite = _env.IsProduction() ? SameSiteMode.None : SameSiteMode.Lax,
                Secure = _env.IsProduction(),
                MaxAge = TimeSpan.FromDays(7)
            };
            if (!string.IsNullOrEmpty(_cookieDomain))
            {
                cookieOptions.Domain = _cookieDomain;
            }
            Response.Cookies.Append(_cookieName, token, cookieOptions);
        }
    }

    public record RegisterDto(string Email, string Password, string? Name);
    public record LoginDto(string Email, string Password);
}
