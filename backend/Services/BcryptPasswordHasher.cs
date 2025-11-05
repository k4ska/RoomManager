using BCrypt.Net;

namespace backend.Services
{
    public class BcryptPasswordHasher : IPasswordHasher
    {
        private readonly int _workFactor;
        public BcryptPasswordHasher(int workFactor = 10) => _workFactor = workFactor;

        public string Hash(string password)
        {
            return BCrypt.Net.BCrypt.HashPassword(password, workFactor: _workFactor);
        }

        public bool Verify(string password, string hashed)
        {
            return BCrypt.Net.BCrypt.Verify(password, hashed);
        }
    }
}
