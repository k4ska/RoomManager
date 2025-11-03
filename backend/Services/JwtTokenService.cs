using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace backend.Services
{
    public class JwtTokenService : ITokenService
    {
        private readonly IConfiguration _config;

        public JwtTokenService(IConfiguration config)
        {
            _config = config;
        }

        public string GenerateToken(int userId, string? email = null)
        {
            var secret = _config["JWT_SECRET"] ?? _config["Jwt:Key"] ?? throw new InvalidOperationException("Missing JWT secret");
            var issuer = _config["JWT_ISSUER"] ?? _config["Jwt:Issuer"] ?? "rm_backend";
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim> { new Claim("uid", userId.ToString()) };
            if (!string.IsNullOrEmpty(email)) claims.Add(new Claim("email", email));

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: issuer,
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public int? ValidateTokenAndGetUserId(string token)
        {
            if (string.IsNullOrEmpty(token)) return null;

            var secret = _config["JWT_SECRET"] ?? _config["Jwt:Key"];
            if (string.IsNullOrEmpty(secret)) return null;

            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(secret);
            try
            {
                var principal = tokenHandler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ClockSkew = TimeSpan.FromMinutes(1)
                }, out var validatedToken);

                var uidClaim = principal.FindFirst("uid")?.Value;
                if (int.TryParse(uidClaim, out var uid)) return uid;
                return null;
            }
            catch
            {
                return null;
            }
        }
    }
}
