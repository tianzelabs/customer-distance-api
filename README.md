
# Customer Distance API

Ez a házi feladat ugyanazon PostgreSQL REST API feladaton keresztül hasonlítja össze a Superpowers és a BMAD-METHOD módszertant.

Ez a README egy tiszta gépen (Node.js, Docker, npm megléte esetén), kizárólag a lentebb leírt parancsok alapján, más kontextus nélkül reprodukálja a teljes rendszert: Postgres indítása, migráció, seedelés, szerverindítás, végpont-ellenőrzés, tesztfuttatás, majd leállítás.

## Előfeltételek

| Eszköz | Elvárt verzió |
| --- | --- |
| Node.js | 24 (Active LTS) |
| Docker (Docker Compose v2 `docker compose` alparancs) | bármely aktuális, Compose v2-t tartalmazó kiadás |
| npm | a Node.js 24-gyel együtt települ |

Nincs szükség egyéb külső szolgáltatásra (nincs külső geokódoló API, nincs felhő-DB) — a teljes lánc lokálisan, offline fut.

## Gyors indítás (teljes végigfutás)

Az alábbi lépések sorban, egymás után futtatandók egy tiszta klónból.

### 1. Függőségek telepítése és `.env` létrehozása

```
npm ci
cp .env.example .env
```

`npm ci` (nem `npm install`) — a committolt `package-lock.json` alapján, reprodukálhatóan telepít; ez a projekt következetesen ezt a konvenciót használja mindenhol (lásd lentebb is). A `.env` a `.env.example` alapján jön létre, valódi titok nélkül (a benne lévő credentialok kizárólag a lenti Docker Compose lokális dev-adatbázisához tartozó, nem-titkos alapértékek).

### 2. Postgres indítása

```
docker compose up -d
```

Egy `postgres:18` konténer indul, két logikai adatbázissal ugyanazon instance-en: `customer_distance` (dev) és `customer_distance_test` (integrációs tesztekhez). A konténer a host **5433**-as portján érhető el (nem az alapértelmezett 5432-n) — ez azért, hogy elkerülje az ütközést egy másik, ehhez a projekthez nem tartozó, esetlegesen már az 5432-t foglaló lokális Postgres instance-szal. A belső, konténeren belüli port változatlanul 5432 marad, csak a host-oldali leképezés más.

Várd meg, amíg a konténer `healthy` állapotba kerül:

```
docker compose ps
```

### 3. Migráció futtatása (mindkét logikai adatbázison)

```
npm run migrate:up
npm run migrate:test:up
```

Az első a dev adatbázist (`customer_distance`, `DATABASE_URL`) migrálja, a második a teszt-adatbázist (`customer_distance_test`, `TEST_DATABASE_URL`). **Mindkettő szükséges** — az integrációs tesztek (lásd lentebb) a `customer_distance_test`-en futnak, migráció nélkül `relation "customers" does not exist` hibával elhasalnak.

A `node-pg-migrate` a shell környezetéből olvassa a `DATABASE_URL`-t (nincs beépített `.env` auto-load), de a projekt `dotenv`-et injektál a scripteken keresztül, így a fenti két parancs közvetlenül, külön exportálás nélkül is működik egy `.env` fájllal rendelkező gyökérkönyvtárból.

### 4. Adatbázis seedelése

```
npm run seed
```

A `seed-customers.json` 15 rekordját tölti be idempotens `UPSERT`-tel (kulcs: `name` + `telepules`) — **biztonságosan újrafuttatható**, nem hoz létre duplikátumokat, és egy már létező sort a friss adatokkal frissít. Ismeretlen település esetén a rekord `lat`/`lon` mezője `null` marad, a script folytatja a többi rekorddal (nem áll meg).

### 5. Szerver indítása

```
npm start
```

Ezzel ekvivalens, közvetlen forma (ha nem szeretnéd az npm script-et használni): `npx tsx src/server.ts`. A szerver a `PORT` környezeti változót olvassa (`.env`-ben `3000`, opcionális — ha nincs beállítva, a kód is `3000`-re esik vissza). Sikeres indításkor a konzolon: `[api] Listening on port 3000`.

### 6. Végpontok ellenőrzése

Egy másik terminálban, a szerver futása közben:

```
curl -s http://localhost:3000/customers/count
```

Valódi, seedelt dev-adatbázis elleni példaválasz:

```json
{"count":15}
```

```
curl -s http://localhost:3000/customers/by-distance
```

Valódi példaválasz (csupasz JSON tömb, minden elem a teljes tárolt rekordot + a Budapesttől mért, 1 tizedesre kerekített `distanceKm`-et tartalmazza; `NULL` oszlopok, pl. hiányzó `budget`, a kulcs teljes elhagyásával, nem explicit `null` értékkel jelennek meg; a lista `distanceKm` szerint növekvő sorrendben, ismeretlen település (`distanceKm: null`) a lista végén):

```json
[
  {
    "id": 1,
    "name": "Anna Kovács",
    "telepules": "Budapest",
    "lat": 47.4979,
    "lon": 19.0402,
    "budget": 850,
    "note": "Loves lush, jungle-style rooms...",
    "countryCode": "HU",
    "distanceKm": 0
  },
  {
    "id": 2,
    "name": "Lena Fischer",
    "telepules": "Vienna",
    "lat": 48.2082,
    "lon": 16.3738,
    "budget": 950,
    "note": "Prefers architectural, sculptural plants...",
    "countryCode": "AT",
    "distanceKm": 214
  },
  { "...": "további 12 elem, növekvő distanceKm szerint..." },
  {
    "id": 9,
    "name": "Isabella Silva",
    "telepules": "Lisbon",
    "lat": 38.7223,
    "lon": -9.1393,
    "budget": 560,
    "note": "Tropical, warm vibe for a small balcony...",
    "countryCode": "PT",
    "distanceKm": 2469.4
  }
]
```

Összesen 15 elem — Anna Kovács (Budapest) `distanceKm: 0`-val az elején, Isabella Silva (Lisbon) a legtávolabbi városként a lista végén.

### 7. Tesztek futtatása

```
npm test
```

A teljes suite (unit + integrációs), mindkét adatbázis migrálva szükséges hozzá (lásd 3. lépés). Valódi végigfutáson: **11 teszt-fájl, 108 teszt, mind zöld**.

```
npm run test:unit
```

Csak az unit tesztek — nem igényel futó/elérhető adatbázist (tiszta függvénylogika: Haversine, `normalizeTown`, kerekítés, rendezés, stb.). Valódi végigfutáson: **7 fájl, 89 teszt, mind zöld**.

```
npm run test:integration
```

Csak az integrációs tesztek — valódi Postgres ellen futnak, a `TEST_DATABASE_URL`-en (soha nem esnek vissza a dev adatbázisra). Valódi végigfutáson: **4 fájl, 19 teszt, mind zöld**.

### 8. Leállítás

```
docker compose down
```

Leállítja és eltávolítja a konténert, de a `pgdata` named volume-ot (és így az adatot) megtartja — a következő `docker compose up -d` ugyanazzal az állapottal folytatja.

Ha teljesen tiszta állapotra van szükség (pl. az adatbázis-inicializáló script újrafuttatásához, mert az csak üres volume mellett fut le):

```
docker compose down -v
```

Ez törli a `pgdata` volume-ot is — utána a `docker compose up -d` egy teljesen üres Postgres-t hoz létre, amit újra migrálni (3. lépés) és seedelni (4. lépés) kell.

## Fejlesztői eszközök: PostgreSQL MCP séma- és adatellenőrzés

A repo gyökerében lévő [`.mcp.json`](./.mcp.json) egy Postgres MCP szervert (`@modelcontextprotocol/server-postgres`) konfigurál, amivel kód írása nélkül, közvetlenül ellenőrizhető a `customers` tábla sémája és a seedelt adat.

**Előfeltétel:** egy futó és migrált (opcionálisan seedelt) lokális Postgres — ld. fentebb a „Gyors indítás” szakasz 1–4. lépését.

**Hogyan működik a kapcsolat titkosítás nélkül:** a `.mcp.json` a kapcsolatot NEM tartalmazza hardcode-olva — az `args` tömb `${DATABASE_URL}` hivatkozást tartalmaz, amit a Claude Code a saját [MCP env-var expanziós mechanizmusával](https://code.claude.com/docs/en/mcp) (a `command`/`args`/`env`/`url`/`headers` mezőkben támogatott `${VAR}`/`${VAR:-default}` szintaxis) a szerver indításakor old fel a ténylegesen futó shell/`.env` környezetből. Ha a `DATABASE_URL` nincs beállítva, a szerver nem indul el érvényes kapcsolattal — nincs beégetett fallback jelszó vagy connection string a committolt fájlban.

**Használat lépései:**

1. Győződj meg róla, hogy a `DATABASE_URL` be van állítva a shell környezetedben (pl. `set -a && source .env && set +a`, a `.env` fájl a fenti 1. lépésben jön létre a `.env.example` alapján).
2. Indítsd a Claude Code-ot a repo gyökeréből (`claude`). Első alkalommal jóvá kell hagyni a projekt-szintű `.mcp.json`-ban definiált `postgres` szervert (workspace trust / MCP approval dialógus).
3. A `/mcp` paranccsal ellenőrizhető, hogy a `postgres` szerver csatlakozott-e.
4. Kérd meg az agentet, hogy listázza ki a `customers` tábla oszlopait és megszorításait (a szerver `resources/list` + `resources/read` képessége az `information_schema.columns`-t adja vissza; a megszorítások — `UNIQUE(name, telepules)`, lat/lon `CHECK`-ek — egy `pg_constraint`-re irányuló, a szerver `query` eszközén keresztüli SQL-lekérdezéssel kérhetők le, pl.: `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'customers'::regclass`).
5. Kérdezz le néhány sort a spot-check-hez, pl.: `SELECT name, telepules, lat, lon FROM customers ORDER BY name LIMIT 5;` — a szerver a `query` eszközén keresztül csak olvasási (`BEGIN TRANSACTION READ ONLY`) módban futtatja a megadott SQL-t, minden írási kísérletet (pl. `DELETE`/`UPDATE`/`INSERT`) elutasít tranzakció-szinten, majd `ROLLBACK`-el zár.

**Megjegyzés a csomagról:** a `@modelcontextprotocol/server-postgres` az npm registry-n `DEPRECATED — Package no longer supported` jelzéssel szerepel; ennek ellenére ténylegesen telepíthető és működik, és ez a hivatalos, az architektúra-dokumentumban (AD-11) explicit megnevezett csomag erre a fejlesztői-eszköz célra. A `.mcp.json` a `@0.6.2` verzióra van pontosan pinnelve (a projekt más függőségeihez hasonlóan, ld. `package.json`), hogy egy jövőbeli `latest`-váltás ne változtassa meg csendben a viselkedést. Ha a csomag idővel teljesen eltűnne az npm-ről, egy alternatív Postgres MCP szerver kereshető az npm-en — ezt a README-t megelőzően nem vizsgáltunk meg konkrét, ellenőrzött alternatívát, ezért itt nem nevezünk meg egyet sem, hogy ne állítsunk ellenőrizetlen csomagról "karbantartott" státuszt.

**Ismert korlát:** a `${DATABASE_URL}` a `npx` gyermekfolyamat parancssori argumentumaként adódik át, ami azt jelenti, hogy a teljes connection string (a jelszóval együtt) rövid ideig látható a helyi gép folyamatlistájában (pl. `ps aux`) a szerver indítása közben. Ez a csomag natív viselkedése (a connection stringet argv-ként várja, nem env változóként) — lokális, nem-titkos fejlesztői adatbázis esetén elfogadott kompromisszum, éles/titkos adatbázisra nem javasolt.

## Projekt struktúra és tech stack (összefoglaló)

| Réteg / eszköz | Választás |
| --- | --- |
| Futásidő | Node.js 24 |
| Nyelv | TypeScript 6.0.2 (pontosan pinnelve) |
| HTTP keretrendszer | Express 5.2.1 |
| Adatbázis | PostgreSQL 18 (`postgres:18`, Docker Compose) |
| DB kliens | `pg` 8.22.0 (`Pool`, nyers paraméterezett SQL, nincs ORM) |
| Migráció | `node-pg-migrate` 8.0.4 (pontosan pinnelve) |
| Tesztfuttató | Vitest 4.1.10 |
| Dev-time DB ellenőrzés | PostgreSQL MCP (`@modelcontextprotocol/server-postgres`) |

Réteg-elrendezés (`src/`): `routes/` (HTTP I/O) → `services/` (üzleti logika: Haversine-összeállítás, kerekítés, rendezés) → `repositories/` (SQL + sor→domain leképezés) → PostgreSQL, plusz egy önálló `seed.ts` belépési pont, amely a repository- és geocoding-réteget újrahasználva, a HTTP/service rétegek megkerülésével tölti be az adatot. Konfiguráció egyetlen helyen (`src/config/env.ts`, fail-fast validáció), megosztott `Pool` egyetlen helyen (`src/db/pool.ts`), központi hibakezelő middleware (`src/middleware/errorHandler.ts`).

Két végpont van: `GET /customers/count` (`{"count": N}`) és `GET /customers/by-distance` (csupasz JSON tömb, Budapesttől mért távolság szerint rendezve).
