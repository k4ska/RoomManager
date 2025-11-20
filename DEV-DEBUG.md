## Development Debug Checklist

This file collects concise, copy-pasteable commands and tips to diagnose and fix common problems when running the project locally (Docker Compose, Nuxt frontend, ASP.NET backend, Postgres).

All commands assume you're in the repository root on Windows PowerShell unless noted.

---

### 1) Quick health checks

- Show services status

```powershell
docker compose ps
```

- Tail backend logs

```powershell
docker compose logs -f backend
```

- Show latest backend logs

```powershell
docker logs rm_backend --tail 200
```

- Show docker events / inspect container state (exit code / restart count)

```powershell
docker inspect rm_backend --format '{{json .State}}' | ConvertFrom-Json
```

---

### 2) Test HTTP endpoints (host vs container)

- From host (Windows): prefer `curl.exe` or PowerShell `Invoke-RestMethod`

```powershell
# curl.exe (if available)
curl.exe -v http://localhost:4000/api/health

# or PowerShell (less verbose)
(Invoke-WebRequest -Uri http://localhost:4000/api/health -UseBasicParsing).Content

# Test login (PowerShell JSON-safe):
$body = @{ email = 'test@example.com'; password = 'pass' } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:4000/api/auth/login -Method POST -Body $body -ContentType 'application/json' -Verbose
```

- From inside a container (tests SSR container network and DNS resolution):

```powershell
docker compose exec frontend sh -c "apk add --no-cache curl >/dev/null 2>&1 || true; curl -v http://backend:4000/api/auth/me"
```

If host request fails but in-container succeeds, then the service is reachable inside compose network but port mapping or host binding is wrong.

---

### 3) Common docker/network issues & fixes

- If backend logs show `Now listening on: http://[::]:8080` but `docker-compose.yml` exposes `4000:4000`, ensure the app listens on container port 4000.

  - Preferred: set `ASPNETCORE_URLS` in `docker-compose.yml` for backend:

  ```yaml
  environment:
    ASPNETCORE_URLS: http://0.0.0.0:4000
  ```

  then rebuild: `docker compose up -d --build backend`.

- If `Name does not resolve` when backend connects to Postgres, ensure backend is on same Compose network as `db` and `DATABASE_URL` points to `db` service (e.g. `postgres://postgres:postgres@db:5432/room_manager`).

- If image references fail because `REGISTRY` arg is empty and produces `/node:...`, prefer the safe pattern in Dockerfile:

```dockerfile
ARG REGISTRY=""
ARG NODE_IMAGE=node:24.11-alpine3.21
FROM ${REGISTRY}${NODE_IMAGE} AS builder
```

---

### 4) Debugging fetch / ERR_EMPTY_RESPONSE / stalled res.json()

- If `fetch(...).json()` never resolves, do diagnostics on the response before calling `.json()`:

```ts
console.log("status", res.status);
console.log("content-type", res.headers.get("content-type"));
const text = await res.text();
console.log("body", text);
```

- This shows whether the server closed the connection, returned non-JSON, or returned an error HTML page.

---

### 5) CORS & Cookies

- Browser errors like `No 'Access-Control-Allow-Origin' header` mean backend's CORS policy doesn't include the frontend origin.

  - For development, set backend env `FRONTEND_ORIGIN: http://localhost:3000` and ensure Program.cs uses that to configure CORS, allowing credentials.
  - Verify response headers in browser Network tab: should include `Access-Control-Allow-Origin: http://localhost:3000` and `Access-Control-Allow-Credentials: true`.

- Cookie tips for auth cookies across domains:
  - In production (cross-site) set `SameSite=None` and `Secure=true`. For local dev (same origin) `SameSite=Lax` is OK.
  - If using subdomains/other domain, set `cookieOptions.Domain` appropriately when appending cookies.

---

### 6) Database checks

- Connect to Postgres container

```powershell
docker compose exec db psql -U postgres -d room_manager
# In psql:
\dt    -- list tables
SELECT table_schema,table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema','pg_catalog');
```

- If DB is empty (no tables), run migrations or allow app to create tables. This project uses a minimal SQL `CREATE TABLE IF NOT EXISTS` block during startup — check backend logs for related messages.

---

### 7) Nuxt runtime config & envs (client vs server)

- Nuxt exposes only `runtimeConfig.public` to the client. Server-only keys (like `API_INTERNAL_BASE`) are not available in client code and will trigger warnings.

- Recommended env layout:

  - `NUXT_PUBLIC_API_BASE` — client-visible API base (e.g. `http://localhost:4000` for dev browser)
  - `API_INTERNAL_BASE` — server-only base used by SSR inside Docker (e.g. `http://backend:4000`)

- Compose example for frontend service:

```yaml
environment:
  NUXT_PUBLIC_API_BASE: http://localhost:4000
  API_INTERNAL_BASE: http://backend:4000
```

And in code, only read `API_INTERNAL_BASE` when `typeof window === 'undefined'`.

---

### 8) Useful diagnostic command summary

- Show service status: `docker compose ps`
- Tail logs: `docker compose logs -f backend`
- Inspect container state: `docker inspect rm_backend --format '{{json .State}}' | ConvertFrom-Json`
- Test from host: `curl.exe -v http://localhost:4000/api/health`
- Test inside container: `docker compose exec frontend sh -c "curl -v http://backend:4000/api/auth/me"`
- Check DB tables: `docker compose exec db psql -U postgres -d room_manager` then `\dt`
- Check listening ports inside container: `docker compose exec backend sh -c "ss -lntp || netstat -lntp"`

---

### 9) When to ask for help — what to paste here

If you open an issue or ask for help, paste these items:

- `docker compose ps` output
- `docker logs rm_backend --tail 200` (or `docker compose logs backend --tail 200`)
- The exact curl/Invoke-RestMethod command you used and its output
- Relevant browser Console/Network errors (CORS headers, request URL, response status)
- `docker inspect rm_backend` env block if you suspect wrong environment values

---

Keep this file updated with any new troubleshooting steps you find useful.

Good luck — ping me if you want this saved as `docs/DEV-DEBUG.md` instead or to add per-service checklists.
