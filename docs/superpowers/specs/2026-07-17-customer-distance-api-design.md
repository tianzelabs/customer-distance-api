# Customer Distance API — Design

## Cél

Kis, önálló REST szolgáltatás Postgres fölött, amely a `seed-customers.json`-ban lévő 15 ügyfelet betölti, lokális (bundle-olt) település→koordináta referencia alapján geokódolja, és Budapesthez viszonyított távolság szerint tudja visszaadni őket. Teljesen offline: nincs külső geokódoló API- vagy LLM-hívás futásidőben.

## Tech stack

- **Nyelv/futtatókörnyezet**: Node.js + TypeScript
- **HTTP réteg**: Express
- **DB kliens**: `pg` (node-postgres), raw SQL — nincs ORM
- **Migráció**: kézzel írt SQL fájl(ok) a `migrations/` mappában, saját script futtatja
- **Teszt**: Vitest (unit + integrációs), `supertest` az endpoint teszteléshez
- **Postgres futtatás fejlesztés közben**: Docker Compose (`postgres:16-alpine`)
- **Postgres MCP**: `@modelcontextprotocol/server-postgres` (npx-en keresztül), `.mcp.json`-ban a `DATABASE_URL`-lel bekötve — séma/adat közvetlenül lekérdezhető fejlesztés közben

## Projektstruktúra

```
customer-distance-api/
  README.md
  package.json / tsconfig.json
  docker-compose.yml        # postgres:16-alpine
  .env.example              # DATABASE_URL
  .mcp.json                 # Postgres MCP server config
  seed-customers.json       # meglévő seed adat
  migrations/
    001_init.sql            # CREATE TABLE IF NOT EXISTS customers (...)
  scripts/
    migrate.ts              # migrations/*.sql futtatása DATABASE_URL ellen
    seed.ts                 # idempotens seed betöltés + geokódolás
  src/
    db.ts                   # pg Pool DATABASE_URL-ből
    app.ts                  # express app factory (nem hív listen-t — tesztelhető)
    server.ts               # app.listen(PORT)
    routes/
      customers.ts          # GET /customers/count, GET /customers/by-distance
    services/
      distance.ts           # haversine + rendezés/formázás
    geocode/
      reference.ts          # telepules -> {lat, lon} map, BUDAPEST konstans
      normalize.ts           # ékezet/kis-nagybetű/whitespace-független normalizálás
  tests/
    unit/
      haversine.test.ts
    integration/
      customers.test.ts     # supertest az app.ts factory ellen, külön teszt DB
```

## Adatmodell

```sql
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  telepules TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  budget INTEGER,
  note TEXT,
  UNIQUE (name)
);
```

- `budget` és `note` tárolva van (megvan a seedben, olcsó hozzáadni), de nem kötelező üzleti logika épül rá.
- `countryCode` nem kerül be a táblába: a 15 seed-városban nincs névütközés különböző országok között, nincs szükség rá a település-egyeztetéshez, feleslegesen bővítené a modellt (YAGNI).
- `UNIQUE (name)` teszi lehetővé az idempotens seedelést: a seed script `INSERT ... ON CONFLICT (name) DO UPDATE` upsertet végez, így kétszeri futtatás frissíti (nem duplázza) a sorokat.

## Geokódolási referencia

`src/geocode/reference.ts`: statikus `Record<string, {lat: number, lon: number}>`, kulcsai a 15 seed-városra normalizált településnevek (Budapest, Vienna, Munich, Milan, Barcelona, Lyon, Kraków, Prague, Lisbon, Amsterdam, Stockholm, Ljubljana, Bucharest, Dublin, Copenhagen), ismert (nyilvánosan dokumentált) koordinátákkal.

A Budapest-koordináta egy megosztott `BUDAPEST` konstans, amit:
1. a referencia-táblában a "budapest" kulcs alatt használunk,
2. a `/customers/by-distance` távolságszámítás origójaként is használunk.

Ez garantálja, hogy a budapesti ügyfelek pontosan `distanceKm: 0.0`-t kapnak (nincs kerekítési eltérés a geokódolt és az origó-koordináta között).

### Normalizálás (`src/geocode/normalize.ts`)

`normalizeTownName(input: string): string`:
1. `trim()`
2. whitespace összevonás (`\s+` → egy szóköz)
3. lowercase
4. ékezet-eltávolítás (Unicode NFD normalize + diakritikus jelek eltávolítása, pl. `Kraków` → `krakow`)

**Budapest kerület kezelés (opcionális, de implementálva)**: normalizálás után, ha a kulcs `"budapest"`-tel kezdődik (pl. `"budapest xiii. kerulet"`), a fővárosi kulcsra képződik le.

### Ismeretlen település

Ha a normalizált kulcs nincs a referenciában: `lat = null`, `lon = null`. A seed script `console.warn`-nal logolja a települést és folytatja — **nem dob hibát, nem állítja le a folyamatot**.

## Betöltés (idempotens seed)

`scripts/seed.ts`:
1. Beolvassa a `seed-customers.json`-t.
2. Minden ügyfélhez: normalizálja a `location.city`-t, kikeresi a referenciából a koordinátát (vagy null + log, ha nincs találat).
3. `INSERT INTO customers (name, telepules, lat, lon, budget, note) VALUES (...) ON CONFLICT (name) DO UPDATE SET telepules = EXCLUDED.telepules, lat = EXCLUDED.lat, lon = EXCLUDED.lon, budget = EXCLUDED.budget, note = EXCLUDED.note`.
4. Kétszeri futtatás nem duplázza a sorokat (upsert `name` alapján).

## Végpontok

### `GET /customers/count`

```json
{ "count": 15 }
```

`SELECT COUNT(*) FROM customers` eredménye.

### `GET /customers/by-distance`

Tömb, minden elem a teljes customer rekord + `distanceKm`:

```json
{
  "id": 1,
  "name": "Anna Kovács",
  "telepules": "Budapest",
  "lat": 47.4979,
  "lon": 19.0402,
  "budget": 850,
  "note": "...",
  "distanceKm": 0.0
}
```

**Számítás és rendezés** (`src/services/distance.ts`):
- `SELECT * FROM customers` — 15 rekordnál a haversine-t és a rendezést alkalmazásban végezzük, nincs szükség Postgres `earthdistance`/`cube` extension-re.
- `distanceKm`: haversine(customer.lat/lon, BUDAPEST) km-ben, egy tizedesre kerekítve (`Math.round(km * 10) / 10`); `null`, ha a customer `lat`/`lon`-ja null.
- **Rendezés**: nem-null `distanceKm` szerint növekvő; holtverseny esetén `name.localeCompare(other.name, 'hu')`. Null-koordinátájú ügyfelek a lista végén, egymás között is név szerint rendezve.

## Tesztelés

### Unit tesztek (`tests/unit/haversine.test.ts`, Vitest)

- Budapest → Bécs: ~214 km (toleranciával, pl. ±2 km)
- Budapest → Budapest: 0 km
- Null koordináta: a distance-service `null`-t ad vissza, nem dob hibát

### Integrációs tesztek (`tests/integration/customers.test.ts`, Vitest + supertest)

- Külön `customer_distance_test` adatbázis ellen fut (ugyanaz a docker-compose Postgres, külön DB-név).
- Teszt előtt (`beforeAll`) lefut a migráció + seed a teszt DB-n.
- Az `app.ts` factory-n keresztül hívjuk a végpontokat (nem kell futó HTTP szerver).
- Ellenőrzi: `/customers/count` == 15; `/customers/by-distance` helyes sorrendben adja vissza az ügyfeleket, Budapest elöl 0 km-rel, `distanceKm` mezők jelen vannak és helyesek.

## Docker Compose

`postgres:16-alpine`, `POSTGRES_DB=customer_distance`, `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`, port `5432:5432`, named volume a perzisztenciához.

## Postgres MCP

`.mcp.json`-ben bekötve a `@modelcontextprotocol/server-postgres` szerver (npx-en keresztül), a `DATABASE_URL` env-vel a helyi docker-compose Postgresre mutatva. Így fejlesztés közben a séma és az adat közvetlenül lekérdezhető a beszélgetésből.

## README tartalma

1. Előfeltételek (Docker telepítve)
2. `docker compose up -d` — Postgres indítása
3. `npm install`
4. `npm run migrate` — séma létrehozása
5. `npm run seed` — idempotens seed betöltés
6. `npm run dev` / `npm start` — szerver indítása
7. `npm test` — unit + integrációs tesztek

## Commit-bontás

Kis, fókuszált commitok, hogy a folyamat is látszódjon:
1. package/tsconfig/docker-compose scaffold
2. migráció + `db.ts`
3. geokódolási referencia + normalize
4. seed script
5. haversine + distance service
6. route-ok (`/customers/count`, `/customers/by-distance`)
7. unit tesztek
8. integrációs tesztek
9. README
10. MCP config (`.mcp.json`)
