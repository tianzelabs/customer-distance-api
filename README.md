
# Customer Distance API

Ez a házi feladat ugyanazon PostgreSQL REST API feladaton keresztül hasonlítja össze a Superpowers és a BMAD-METHOD módszertant.

## Előfeltételek

- Node.js 20+
- Docker és Docker Compose

## Indítás

1. Postgres indítása:

   ```bash
   docker compose up -d
   ```

2. Függőségek telepítése:

   ```bash
   npm install
   ```

3. Környezeti változók beállítása:

   ```bash
   cp .env.example .env
   ```

4. Séma migrálása:

   ```bash
   npm run migrate
   ```

5. Seed adat betöltése (idempotens — többször is futtatható, nem duplikál):

   ```bash
   npm run seed
   ```

6. Szerver indítása:

   ```bash
   npm run dev
   ```

   Az API a `http://localhost:3000` címen érhető el.

## Végpontok

- `GET /customers/count` — `{ "count": <int> }`
- `GET /customers/by-distance` — ügyfélek listája, Budapesthez viszonyított `distanceKm` szerint növekvő sorrendben

## Tesztek futtatása

```bash
npm test
```

A tesztek (unit + integrációs) futtatásához a Postgres-nek futnia kell (`docker compose up -d`). Az integrációs tesztek egy külön `customer_distance_test` adatbázist hoznak létre és seedelnek automatikusan, a fejlesztői adatbázist nem érintik.

## Postgres MCP

A repo tartalmaz egy `.mcp.json` konfigurációt, amely a helyi Postgres-hez köti a `@modelcontextprotocol/server-postgres` MCP szervert. Az MCP-klienst (pl. Claude Code-ot) újraindítva/a szervereket újratöltve a séma és az adat közvetlenül lekérdezhető fejlesztés közben.

