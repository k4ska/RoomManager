Room Manager – Docker Setup

Services
- Frontend: Nuxt 4 app in `frontend/` (port 3000)
- Backend: Node + Prisma in `backend/` (port 4000)
- Database: Postgres 16 (port 5432)

Quick start (Docker)
1) Copy env templates if needed (defaults already work for local compose):
   - `backend/.env.docker.example` → `backend/.env`
   - `frontend/.env.example` → `frontend/.env`
   - `.env.example` → `.env` (optional)
2) Build and run:
   - `docker compose up -d db backend frontend`
3) Open:
   - Frontend: http://localhost:3000
   - Backend health: http://localhost:4000/api/health

Local development (pnpm, without Docker)
1) Postgres: `docker compose up -d db`
2) Backend:
   - `cd backend && pnpm install`
   - `pnpm prisma:generate`
   - `pnpm prisma:migrate:deploy`
   - `pnpm start` (http://localhost:4000)
3) Frontend:
   - `cd frontend && pnpm install`
   - `pnpm dev` (http://localhost:3000)

Auth & Data
- Login/Register pages: `/login`, `/register`
- Session stored as HttpOnly cookie; frontend calls `/api/auth/me` to hydrate state
- Per-user rooms/units/items via backend Prisma + Postgres
