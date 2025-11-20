Room Manager — kehvade juhiste värskendus

See repo sisaldab Nuxt 4 frontend'i, ASP.NET Core backend'i ja Postgres andmebaasi. Alljärgnevad juhised on ajakohased arendus‑keskkonna jaoks (Docker Compose).

Teenused

- Frontend: Nuxt 4 (`frontend/`) — vaikimisi port `3000`
- Backend: ASP.NET Core (.NET 9) (`backend/`) — vaikimisi port `4000`
- Database: Postgres 16 (`db`) — vaikimisi port `5432`

Kiirkäivitus (Docker Compose)

1. Käivita teenused (repo juurest):

```powershell
docker compose up -d db backend frontend pgadmin4
```

2. Kontrolli olekut:

```powershell
docker compose ps
```

3. Ava:

- Frontend: http://localhost:3000
- Backend health: http://localhost:4000/api/health
- pgAdmin: http://localhost:8081 (login: `room@manager.com` / `parool` — vaata `PGADMIN-README.md`)

Keskkonnamuutujad (olulised)

- `DATABASE_URL` — Postgres ühendus (compose kasutab `postgres://postgres:postgres@db:5432/room_manager` vaikimisi)
- `JWT_SECRET` — tugev saladus tokenite jaoks (ei tohiks olla versioonihalduses)
- `NUXT_PUBLIC_API_BASE` — brauseri poolt kasutatav API base (dev: `http://localhost:4000`)
- `API_INTERNAL_BASE` — SSR/konteineri sisene base (nt `http://backend:4000`)
- `FRONTEND_ORIGIN` / `CORS_ORIGIN` — backend CORS jaoks (nt `https://app.sinu-domeen.ee`)
- `ASPNETCORE_URLS` — backend Kestrel kuulab (dev compose seadistuses `http://0.0.0.0:4000`)
- `SESSION_COOKIE_NAME`, `SESSION_COOKIE_DOMAIN` — sessiooni küpsise nimi ja valikuline domeen

Local arendus

- Frontend (nuxt dev):
  ```powershell
  cd frontend
  pnpm install
  pnpm dev
  ```
- Backend (kohalik .NET käivitamine):
  ```powershell
  cd backend
  dotnet restore
  dotnet build
  dotnet run --urls http://0.0.0.0:4000
  ```
  Backend loob minimalseid tabelid käivituse ajal (vt `Program.cs`).

Andmebaas ja pgAdmin

- Repo sisaldab `PGADMIN-README.md` ja `DEV-DEBUG.md` juhendeid — vaata neid kui vajate samm-sammult juhiseid pgAdmini või veaotsingu jaoks.
- Kui soovite käsitsi ühendada DB terminalist:
  ```powershell
  docker compose exec db psql -U postgres -d room_manager
  # psql sees: \dt
  ```

Autentimine ja ligipääs

- Sessioon: HttpOnly cookie (`rm_session` vaikimisi). Frontend kasutab `credentials: 'include'` ja teeb `GET /api/auth/me` kasutaja hydrate'iks.
- CORS peab lubama `FRONTEND_ORIGIN` ja `AllowCredentials` peab olema `true` — muidu brauser ei saada küpsiseid.

Turva- ja tootmisnäpunäited

- Ärge hoidke saladusi (`JWT_SECRET`, DB paroolid) Git repo's — kasutage CI/CD secret store'i või hosti env muutujaid.
- Ärge eksponeerige Postgres pordi 5432 avalikult tootmises.
- Kui kasutate reverse‑proxy't (NGINX/Traefik), seadistage `UseForwardedHeaders` ASP.NET'is ja kasutage TLS‑terminatsiooni.

Lisad

- Veaotsingu sammud: `DEV-DEBUG.md` (repo juures)
- pgAdmin juhend: `PGADMIN-README.md` (repo juures)

Kui soovite, värskendan README-d veelgi (nt lisada CI hoovad, build‑käsud või arendus‑workflow). Palun ütle, kas soovid ingliskeelset versiooni ka lisada.
