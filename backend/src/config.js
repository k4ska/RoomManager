// Loads environment variables with simple defaults
export async function loadConfig() {
  // Optional: try to load .env if dotenv is available
  try {
    const dotenv = await import('dotenv')
    dotenv.config?.()
  } catch (_) {
    // dotenv not installed; ignore and rely on process.env
  }

  const PORT = parseInt(process.env.PORT || '4000', 10)
  const NODE_ENV = process.env.NODE_ENV || 'development'
  const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-prod'
  const DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/room_manager'
  const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000'

  return { PORT, NODE_ENV, JWT_SECRET, DATABASE_URL, CORS_ORIGIN }
}

