namespace backend.Services
{
    public interface ITokenService
    {
        string GenerateToken(int userId, string? email = null);
        int? ValidateTokenAndGetUserId(string token);
    }
}
