
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

Az alábbi parancsok POSIX shell-t (bash/zsh/WSL/git-bash) feltételeznek — natív Windows `cmd.exe`/PowerShell alatt néhány szintaxis (pl. `cp`, az inline env-változó-előtag forma) nem működik változtatás nélkül.

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

Várd meg (kb. 10-15 másodperc), amíg a konténer `healthy` állapotba kerül — szükség esetén futtasd többször:

```
docker compose ps
```

**Hibaelhárítás:**
- Ha a `docker compose up -d` azonnal hibázik: ellenőrizd, hogy a Docker daemon fut-e (`docker info`), és hogy az 5433-as host port nincs-e más folyamat által foglalva.
- Ha a konténer tartósan `unhealthy` marad (nem csak az induláskor várható néhány másodperc): a `customer_distance_test` adatbázist létrehozó inicializációs script (`docker/initdb/01-create-test-db.sql`) kizárólag **üres** volume mellett, első indításkor fut le. Ha egy korábbi, hibás állapotú volume maradt vissza, futtasd: `docker compose down -v && docker compose up -d` (ez törli az addigi adatot is — utána újra kell migrálni és seedelni, ld. 3–4. lépés).

### 3. Migráció futtatása (mindkét logikai adatbázison)

```
npm run migrate:up
npm run migrate:test:up
```

Az első a dev adatbázist (`customer_distance`, `DATABASE_URL`) migrálja, a második a teszt-adatbázist (`customer_distance_test`, `TEST_DATABASE_URL`). **Mindkettő szükséges** — az integrációs tesztek (lásd lentebb) a `customer_distance_test`-en futnak, migráció nélkül `relation "customers" does not exist` hibával elhasalnak.

A `node-pg-migrate` CLI-je saját maga hív `dotenv`-et induláskor, ezért a `.env` fájlból automatikusan betölti a `DATABASE_URL`-t — nincs szükség külön exportálásra. A teszt-adatbázishoz a `migrate:test:up` script a CLI saját `--database-url-var TEST_DATABASE_URL` kapcsolóját használja, ami a CLI-nek megmondja, hogy ezúttal a `TEST_DATABASE_URL` (nem a `DATABASE_URL`) értékét használja kapcsolatként — ez a helyes mechanizmus egy Node-folyamaton *belüli* env-változó-átirányításra (egy shell-szintű `DATABASE_URL=$TEST_DATABASE_URL ...` előtag ehelyett hibázna, mert a shell a `$TEST_DATABASE_URL`-t még azelőtt kiértékelné, hogy a `.env` egyáltalán betöltődne, és egy üres `DATABASE_URL`-t állítana be, amit a CLI saját `dotenv` hívása utólag már nem ír felül).

### 4. Adatbázis seedelése

```
npm run seed
```

A `seed-customers.json` 15 rekordját tölti be idempotens `UPSERT`-tel (kulcs: `name` + `telepules`) — **biztonságosan újrafuttatható**, nem hoz létre duplikátumokat, és egy már létező sort a friss adatokkal frissít. Ismeretlen település esetén a rekord `lat`/`lon` mezője `null` marad, a script folytatja a többi rekorddal (nem áll meg).

### 5. Szerver indítása

```
npm start
```

Ezzel gyakorlatilag azonos, közvetlen forma (ha nem szeretnéd az npm script-et használni): `npx tsx src/server.ts` — ma ugyanazt futtatja, bár az `npm start` emellett az npm saját életciklus-hookjait (pl. egy jövőbeli `prestart`-ot) és `.npmrc` konfigurációt is figyelembe venné, a közvetlen `npx` hívás nem. A szerver a `PORT` környezeti változót olvassa (`.env`-ben `3000`, opcionális — ha nincs beállítva, a kód is `3000`-re esik vissza). Sikeres indításkor a konzolon: `[api] Listening on port 3000`.

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

Csupasz JSON tömb; minden elem a teljes tárolt rekordot + a Budapesttől mért, 1 tizedesre kerekített `distanceKm`-et tartalmazza; a lista `distanceKm` szerint növekvő sorrendben. Az alábbi 3 elem (első kettő + utolsó) a valós, seedelt 15-elemű válaszból származik — a köztes 12 elem a rövidség kedvéért nincs feltüntetve, valódi végigfutáshoz futtasd magad a fenti `curl` parancsot:

```json
[
  {
    "id": 1,
    "name": "Anna Kovács",
    "telepules": "Budapest",
    "lat": 47.4979,
    "lon": 19.0402,
    "budget": 850,
    "note": "Loves lush, jungle-style rooms and asks for a large ficus in every project. Prefers deep green foliage over anything with flowers.",
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
    "note": "Prefers architectural, sculptural plants that match her modernist furniture. Big fan of monstera and bird-of-paradise.",
    "countryCode": "AT",
    "distanceKm": 214
  }
]
```

...(12 további elem, `distanceKm` szerint tovább növekedve)...

```json
[
  {
    "id": 9,
    "name": "Isabella Silva",
    "telepules": "Lisbon",
    "lat": 38.7223,
    "lon": -9.1393,
    "budget": 560,
    "note": "Tropical, warm vibe for a small balcony. Loves calathea for the patterned leaves but knows they need humidity and care.",
    "countryCode": "PT",
    "distanceKm": 2469.4
  }
]
```

Összesen 15 elem — Anna Kovács (Budapest) `distanceKm: 0`-val az elején, Isabella Silva (Lisbon) a legtávolabbi városként a lista végén.

**A shippelt 15 valós ügyfél mindegyike ismert városban van** — egyikük sem gyakorolja az `distanceKm: null` (ismeretlen település) vagy a hiányzó opcionális mező (`budget`/`note`/`countryCode` kulcs teljes elhagyása) ágat, ezért ezt a két, ténylegesen implementált viselkedést a fenti valós példa nem mutatja be. Mindkettő automatizált teszttel bizonyított dedikált fixture-adaton (`test/integration/customersByDistance.test.ts`, `test/unit/customersService.test.ts`) — API-szerződésként ugyanúgy érvényesek, csak a jelenlegi seed-adat nem véletlenül nem hozza felszínre őket.

### 7. Tesztek futtatása

```
npm test
```

A teljes suite (unit + integrációs), mindkét adatbázis migrálva szükséges hozzá (lásd 3. lépés). Valódi végigfutáson, ennek a commitnak az állapotában: **11 teszt-fájl, 108 teszt, mind zöld** (a pontos szám a projekt fejlődésével nőni fog — a fontos jel a "mind zöld", nem a konkrét darabszám).

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
| Nyelv | TypeScript 6.0.2 |
| HTTP keretrendszer | Express 5.2.1 |
| Adatbázis | PostgreSQL 18 (`postgres:18`, Docker Compose) |
| DB kliens | `pg` 8.22.0 (`Pool`, nyers paraméterezett SQL, nincs ORM) |
| Migráció | `node-pg-migrate` 8.0.4 |
| Tesztfuttató | Vitest 4.1.10 |
| Dev-time DB ellenőrzés | PostgreSQL MCP (`@modelcontextprotocol/server-postgres@0.6.2`) |

Minden fenti verzió pontosan pinnelve van a `package.json`-ban (nincs `^`/`~` prefix) — nem csak a korábban kiemelt TypeScript/`node-pg-migrate`, hanem mindegyik: ez a projekt következetes, végig alkalmazott konvenciója.

Réteg-elrendezés (`src/`): `routes/` (HTTP I/O) → `services/` (üzleti logika: Haversine-összeállítás, kerekítés, rendezés) → `repositories/` (SQL + sor→domain leképezés) → PostgreSQL, plusz egy önálló `seed.ts` belépési pont, amely a repository- és geocoding-réteget újrahasználva, a HTTP/service rétegek megkerülésével tölti be az adatot. Konfiguráció egyetlen helyen (`src/config/env.ts`, fail-fast validáció), megosztott `Pool` egyetlen helyen (`src/db/pool.ts`), központi hibakezelő middleware (`src/middleware/errorHandler.ts`).

Két végpont van: `GET /customers/count` (`{"count": N}`) és `GET /customers/by-distance` (csupasz JSON tömb, Budapesttől mért távolság szerint rendezve).
