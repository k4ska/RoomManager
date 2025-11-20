# pgAdmin — kiire juhend (Windows + Docker Compose)

See juhend näitab, kuidas käivitada pgAdmin ja ühendada see projekti Postgres andmebaasiga.

Asukoht: repo juur

1. Käivita vajalikud teenused

Avage PowerShell ja käivitage (repo juurest):

```powershell
# käivita ainult andmebaas ja pgAdmin
docker compose up -d db pgadmin4

# või kogu arendusstack
docker compose up -d db backend frontend pgadmin4
```

Kontrolli, et teenused on käivitatud:

```powershell
docker compose ps
```

Otsige ridu `db` ja `pgadmin4` ning staatust `Up`.

2. Ava pgAdmin veebiliides

Ava brauser ja mine aadressile: http://localhost:8081

Sisselogimine (vaikimisi docker-compose.yml järgi):

- Email: `room@manager.com`
- Password: `parool`

Muuda parool kohe, kui oled sisse saanud.

3. Registreeri PostgreSQL server pgAdminis

- Klõpsa `Add New Server` (või paremklõps `Servers` → `Register` → `Server...`).
- General tab: `Name` = `room_manager` (või muu nimevalik)
- Connection tab täida:
  - `Host name/address`: `db` (soovitatav, kui kasutad compose'i sama võrgu sees)
    - Kui pgAdmin töötab väljaspool compose (näiteks lokaalne install), kasuta `localhost` või `host.docker.internal`.
  - `Port`: `5432`
  - `Maintenance database`: `room_manager`
  - `Username`: `postgres`
  - `Password`: `postgres`
  - Märgi `Save password` kui soovid

Salvesta ühendus — nüüd saad sirvida `Databases → room_manager → Schemas → public → Tables`.

4. Kui soovid terminalit kasutada (alternatiiv)

```powershell
docker compose exec db psql -U postgres -d room_manager
# psql sees:
\dt
SELECT * FROM "Users" LIMIT 10;
```

5. Turvanõuanded

- Ärge hoidke reaalse keskkonna paroole või saladusi otse `docker-compose.yml` failis.
- Kui teete andmebaasi ligipääsu avalikuks, piirake bind‑addressi ja kasutage tulemüüri.
- Vahetage vaikimisi paroolid (`postgres` / `postgres`, `parool`) arendus‑ või tootmiskeskkonnale sobivate vastu.

Kui soovid, võin lisada selle juhendi ka `docs/` kausta või linkida `README.md` sisse.
