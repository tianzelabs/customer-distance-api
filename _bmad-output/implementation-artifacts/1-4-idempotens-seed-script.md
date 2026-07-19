---
baseline_commit: 661945304e489f3803686fa1a3c2f9ba11d4896f
---

# Story 1.4: Idempotens seed script

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Mint fejlesztő,
a `seed-customers.json`-t idempotensen szeretném betölteni a `customers` táblába geokódolt koordinátákkal,
hogy reprodukálható induló adatom legyen.

## Acceptance Criteria

1. **Given** ez a story hozza létre a `src/config/env.ts`-t (minimálisan `DATABASE_URL`-t olvasva és validálva, fail-fast hibaüzenettel hiányzó/érvénytelen érték esetén) és a `src/db/pool.ts`-t (az egyetlen megosztott `pg` `Pool` modul, ami az `env.ts`-ből olvassa a kapcsolatot) — ezeket a 2.2 story bővíti tovább (`TEST_DATABASE_URL` fail-stop haszálata, `PORT`), nem hozza létre újra. [Source: epics.md#Story 1.4; ARCHITECTURE-SPINE.md#AD-9]
2. **Given** egy futó, migrált Postgres és a `seed-customers.json` forrásfájl, **when** a fejlesztő lefuttatja a seed scriptet (`src/seed.ts`, a megosztott `src/db/pool.ts` Pool-on keresztül), **then** mind a 15 ügyfél bekerül a `customers` táblába, `normalizeTown()`+`townReference.ts` alapján geokódolva. [Source: epics.md#Story 1.4; prd.md#FR-2, FR-3]
3. Minden beszúrás/upsert paraméterezett lekérdezésen keresztül történik (nincs string-konkatenáció) — konkrét bizonyíték: a `Niamh O'Brien` név (aposztróffal) hibamentesen és helyesen kerül be. [Source: epics.md#Story 1.4; addendum.md; ARCHITECTURE-SPINE.md#AD-2]
4. **When** a seed scriptet másodszor is lefuttatják, **then** a `customers` táblában nem keletkezik duplikátum (upsert `ON CONFLICT (name, telepules) DO UPDATE`, sosem `DO NOTHING`). [Source: epics.md#Story 1.4; prd.md#FR-2; ARCHITECTURE-SPINE.md#AD-5]
5. **Given** egy dedikált teszt-fixture, amely egy ismeretlen települést tartalmaz (nem a valódi 15 seed-városok egyike), **when** a seed script feldolgozza ezt a rekordot, **then** a rekord `lat`/`lon` értéke `null` lesz, egy `[seed] Unknown town: "..."` figyelmeztető log íródik, és a folyamat a többi rekordot változatlanul feldolgozva sikeresen befejeződik. [Source: epics.md#Story 1.4; prd.md#FR-5, FR-10]
6. A `Customer` TS típus pontosan egyszer van definiálva, a `src/repositories/customersRepository.ts`-ben. [Source: ARCHITECTURE-SPINE.md#AD-14]
7. A repository réteg kizárólag DB I/O-t és sor→domain leképezést végez, üzleti logikát nem tartalmaz. [Source: ARCHITECTURE-SPINE.md#AD-1]
8. Integrációs teszt (`test/integration/seed.test.ts`) valódi, nem mockolt Postgres (`TEST_DATABASE_URL`, `customer_distance_test`) ellen igazolja az idempotenciát (kétszeri futtatás után nincs duplikáció) és a dedikált ismeretlen-település fixture-ágat; a teszt `TEST_DATABASE_URL` hiánya esetén fail-stop hibát dob, sosem esik vissza `DATABASE_URL`-re. [Source: epics.md#Story 1.4; prd.md#FR-11 (Epic 1 kontextusban); ARCHITECTURE-SPINE.md#AD-9]

## Tasks / Subtasks

- [x] **Task 1 — `src/config/env.ts`: fail-fast konfiguráció (AC: #1)**
  - [x] Telepítsd a `dotenv`-et (`npm install --save-exact dotenv@17.4.2`) — futásidejű függőség, mert az `env.ts` ezzel tölti be a `.env` fájlt fejlesztői/seed/teszt futtatáskor; dokumentáld a döntést a Dev Notes-ban (nincs explicit előírás az architektúrában erre, `[ASSUMPTION]`).
  - [x] Hozd létre a `src/config/env.ts`-t: `requireEnv()` helper, ami hiányzó/üres `DATABASE_URL` esetén világos, `[config]`-prefixű hibaüzenettel azonnal dob; egy `validatePostgresUrl()` helper, ami `postgres://`/`postgresql://` protokollt követel; egy `parsePort()` helper `PORT`-hoz (opcionális, alapértelmezett `3000`, validálva 1–65535 tartományra, ha meg van adva).
  - [x] Exportálj egy `env` objektumot: `{ databaseUrl: string, testDatabaseUrl: string | undefined, port: number }` — `DATABASE_URL` kötelező és validált a modul betöltésekor (fail-fast import-időben); `TEST_DATABASE_URL` NEM kötelező itt (ne törje el a sima seed/app futtatást, ha nincs beállítva).
  - [x] Exportálj egy `requireTestDatabaseUrl(): string` függvényt, ami `TEST_DATABASE_URL` hiánya esetén explicit, `[config]`-prefixű hibát dob ("sosem esik vissza `DATABASE_URL`-re") — ezt kizárólag integrációs teszt setup hívja.

- [x] **Task 2 — `src/db/pool.ts`: egyetlen megosztott Pool-modul (AC: #1)**
  - [x] Exportálj egy `createPool(connectionString, overrides?)` factory függvényt, ami `new Pool({ connectionString, ...overrides })`-t ad vissza — ez az EGYETLEN hely a repóban, ahol `new Pool(...)` hívás történik (AD-3); minden más fogyasztó (seed, jövőbeli integrációs tesztek) ezen a factory-n keresztül kap Pool-t, sosem hív közvetlenül `new Pool(...)`-t.
  - [x] Exportálj egy `pool: Pool` singletont, ami `createPool(env.databaseUrl)`-lel épül — ez a megosztott dev/seed Pool.

- [x] **Task 3 — `src/repositories/customersRepository.ts`: `Customer` típus + `upsertCustomer()` (AC: #3, #6, #7)**
  - [x] Definiáld a `Customer` interfészt (AD-14 — egyetlen definíció): `id`, `name`, `telepules`, `lat: number | null`, `lon: number | null`, opcionális `budget`, `note`, `countryCode` (a `country_code` DB-oszlop → `countryCode` TS-mező leképezési konvenció).
  - [x] Definiáld az `UpsertCustomerInput` típust (a beszúráshoz szükséges mezők, `id` nélkül).
  - [x] Implementáld az `upsertCustomer(db: Pool | PoolClient, input: UpsertCustomerInput): Promise<void>`-t — a `db` paraméter dependency-injection célja: a seed a megosztott `pool`-t adja át, a jövőbeli tesztek egy teszt-DB-re mutató Pool-t. Kizárólag paraméterezett lekérdezés (`$1`, `$2`, ...), `INSERT ... ON CONFLICT (name, telepules) DO UPDATE SET lat = EXCLUDED.lat, lon = EXCLUDED.lon, budget = EXCLUDED.budget, note = EXCLUDED.note, country_code = EXCLUDED.country_code`.
  - [x] NE tegyél bele Haversine-t, rendezést vagy bármilyen üzleti logikát (AD-1) — ez a story csak az upsertet vezeti be, a `findAll`/`count` a 2.3/2.4 story feladata.

- [x] **Task 4 — `src/seed.ts`: önálló seed entrypoint (AC: #2, #4, #5)**
  - [x] Definiáld a `SeedRecord` típust (`name`, opcionális `budget`, `location: { city, countryCode? }`, opcionális `note`) — a `seed-customers.json` alakjának megfelelően.
  - [x] Implementáld a `resolveCoordinates(city: string): { lat: number | null; lon: number | null }` tiszta-ish függvényt: `normalizeTown(city)` → `lookupTownCoordinate()`; találat esetén a koordináták, egyébként `{ lat: null, lon: null }` + `console.warn('[seed] Unknown town: "' + city + '"')`. **Fontos strukturális döntés:** ez a függvény és a `seedCustomers()` NEM importálja statikusan a `db/pool.ts`-t/`env.ts`-t (csak a `db` paramétert kapja) — így unit-tesztelhető `DATABASE_URL` nélkül is.
  - [x] Implementáld a `seedCustomers(db: Pool | PoolClient, records: SeedRecord[]): Promise<number>`-t: rekordonként `resolveCoordinates()` + `upsertCustomer()`, a hurok SOSEM áll le egy ismeretlen település miatt (mert az csak `null` koordinátát eredményez, nem dob).
  - [x] Implementáld a `main()`-t: dinamikusan importálja a `./db/pool.js`-t (ekkor validálódik/épül a megosztott Pool `DATABASE_URL`-ből), beolvassa a `seed-customers.json`-t (`fs/promises` `readFile` + `JSON.parse`, elérési út `new URL('../seed-customers.json', import.meta.url)`-lel), meghívja a `seedCustomers(pool, records)`-t, logol egy összegzést, majd `pool.end()`.
  - [x] Az entrypoint-védelem (`if (import.meta.url === pathToFileURL(process.argv[1]).href)`) biztosítja, hogy `main()` csak közvetlen futtatáskor induljon el, importáláskor (pl. tesztből) ne.

- [x] **Task 5 — npm scriptek (AC: #2)**
  - [x] Telepítsd a `tsx`-et (`npm install --save-exact tsx@4.23.1`) — futásidejű függőség (a `seed` script ezen keresztül fut), dokumentáld a `tsx` vs. `node --experimental-strip-types` döntést a Dev Notes-ban.
  - [x] Adj hozzá egy `"seed": "tsx src/seed.ts"` npm scriptet.
  - [x] Adj hozzá `"test:unit": "vitest run test/unit"` és `"test:integration": "vitest run test/integration"` scripteket; a meglévő `"test": "vitest run"` marad változatlan (mindkettőt lefuttatja) — dokumentáld, hogy ehhez futó Postgres (`DATABASE_URL` ÉS `TEST_DATABASE_URL`) szükséges.

- [x] **Task 6 — Tesztek (AC: #3, #4, #5, #8)**
  - [x] `test/unit/seed.test.ts`: unit teszt a `resolveCoordinates()`-re — ismert település (ékezet/kis-nagybetű variánssal) helyes koordinátát ad; ismeretlen település `{ lat: null, lon: null }`-t ad ÉS `console.warn`-t hív a pontos `[seed] Unknown town: "..."` szöveggel (spy-olva, nem dob kivételt).
  - [x] `test/integration/seed.test.ts`: valódi `TEST_DATABASE_URL` ellen (a `requireTestDatabaseUrl()`-en és a `db/pool.ts` `createPool()` factory-ján keresztül, SOSEM `DATABASE_URL`-en) — (a) idempotencia teszt: a valódi 15 `seed-customers.json` rekordot kétszer seedeli, mindkétszer pontosan 15 sort vár (`SELECT COUNT(*)`); mivel a valódi seed tartalmazza a `Niamh O'Brien`-t, ez egyúttal az AC #3 (aposztróf-biztonság) bizonyítéka is; (b) dedikált ismeretlen-település fixture teszt: egy kitalált, a valódi seedben NEM szereplő város (`"Nonexistentville"`) + utána egy ismert várost tartalmazó rekord — ellenőrzi, hogy az ismeretlen település sora `lat=null,lon=null`, ÉS hogy a feldolgozás folytatódott a következő rekordra (annak lat/lon-ja helyesen kitöltött).
  - [x] Minden teszt-suite `beforeEach`-ben `TRUNCATE TABLE customers RESTART IDENTITY`-t futtat a teszt-DB-n (izoláció, ismételhetőség), `afterAll`-ban `pool.end()`-et hív.
  - [x] Futtasd ténylegesen: `npm run test:unit`, majd `npm run test:integration` — rögzítsd a valódi pass-számokat a Dev Agent Record-ban.

- [x] **Task 7 — Valódi dev-DB seedelés és verifikáció (AC: #2, #3, #4, #5)**
  - [x] `.env` létrehozása lokálisan (git-ignorált, az `.env.example` alapján, ugyanazokkal a nem-titkos dev-credential-ökkel) — szükséges a `dotenv` betöltéshez.
  - [x] Futtasd: `npm run seed` a valódi dev DB-n (`customer_distance`) — ellenőrizd `docker compose exec postgres psql`-lel, hogy mind a 15 sor bekerült.
  - [x] Futtasd újra: `npm run seed` — ellenőrizd, hogy továbbra is pontosan 15 sor van (nincs duplikáció).
  - [x] Spot-check: Anna Kovács (Budapest) lat/lon egyezik a `BUDAPEST_REF`-fel; `Niamh O'Brien` sértetlenül bekerült (aposztróf nem törte el a lekérdezést).

- [x] **Task 8 — Story-dokumentáció és delivery (delivery norma, NFR7)**
  - [x] Frissítsd ezt a story fájlt: Tasks pipálása, Dev Agent Record kitöltése, Status `ready-for-dev` → `in-progress` → `review`.
  - [x] Frissítsd a `sprint-status.yaml`-t: `1-4-idempotens-seed-script` `backlog` → `ready-for-dev` → `in-progress` → `review`.
  - [x] Kis, fókuszált commitok (pl.: story-fájl; env.ts+pool.ts; repository; seed.ts+npm scriptek; tesztek), nem egyetlen mindent-összefogó záró commit (NFR7).

## Dev Notes

- **Előző story-k (1.1–1.3) tanulságai, relevánsak erre a story-ra:**
  - ESM (`"type": "module"`) + `NodeNext` — minden relatív TS import explicit `.js` kiterjesztést használ (pl. `from '../db/pool.js'`), még akkor is, ha a forrás `.ts`.
  - `Object.create(null)`-alapú, fagyasztott `TOWN_REFERENCE` és `normalizeTown()` non-throwing garanciája (1.3 code review) — ez a story ezekre épít változtatás nélkül.
  - A `customers` tábla már migrálva van a dev DB-n (1.2), jelenleg 0 sorral — kész a seedelésre.
  - A `node-pg-migrate` verzió-currency mintát (1.2) és a Vitest verzió-ellenőrzési mintát (1.3) itt is követem: web-ellenőrzés + a ratifikált Architecture Spine pin megtartása, eltérés dokumentálva, ha van.
- **`[ASSUMPTION]` `tsx` vs. `node --experimental-strip-types`.** Ellenőriztem mindkettőt ezen a gépen (Node v23.5.0): a `--experimental-strip-types` flag natívan működik EGYSZERŰ fájlokra, de ELROMLIK a projekt saját `NodeNext`+`.js`-kiterjesztéses relatív import konvencióján (Story 1.1 döntése) — egy `.ts` fájlból `.js` kiterjesztéssel importált másik `.ts` fájlt `ERR_MODULE_NOT_FOUND`-dal utasítja el, mert a natív type-stripping mód a tényleges `.ts` kiterjesztésű specifikátort várja, nem a `NodeNext`-konvenció szerinti `.js`-t. Ezt ténylegesen leteszteltem egy minimális repróval (két `.ts` fájl, `.js`-re mutató relatív import) — hibázott. A `tsx@4.23.1` ugyanezt a mintát hibamentesen futtatta. **Döntés: `tsx`-et használok**, mert kompatibilis a már ratifikált `NodeNext`/`.js`-import konvencióval, és nem kényszerít a story hatókörén kívüli import-stílus-váltásra a meglévő `src/geocoding/*.ts` fájlokban.
- **`[ASSUMPTION]` `dotenv` bevezetése.** Az Architecture Spine nem nevez meg env-betöltő könyvtárat, csak azt írja elő, hogy `env.ts` az egyetlen hely, ahol env-változókat OLVASNAK (AD-9) — ez nem zárja ki, hogy `env.ts` maga egy könnyű, jól ismert loader-t (`dotenv`) használjon a `.env` fájl `process.env`-be töltésére, mielőtt olvasna belőle. Alternatíva lett volna a natív `node --env-file=.env` flag, de az nem terjed át konzisztensen minden futtatási módra ebben a projektben (`tsx src/seed.ts`, `vitest run`, jövőbeli `node dist/server.js`) anélkül, hogy minden egyes npm scriptet külön flaggel kellene ellátni — a `dotenv.config()` hívás az `env.ts` tetején egyetlen helyen oldja meg mindhárom futtatási módra, konzisztensen az AD-9 "env.ts az egyetlen hely" elvével (a betöltés helye is `env.ts`, nem szóródik szét). Futásidejű (`dependencies`) függőségként telepítve, mert minden entrypoint (seed, jövőbeli app/server, integrációs tesztek) rajta keresztül kap konfigurációt.
- **`tsx`/`dotenv` `dependencies`-ben, nem `devDependencies`-ben** — ugyanaz az indoklás, mint a `node-pg-migrate` 1.2 story code review-jában: az `npm run seed` egy dokumentált, "production"-szerű (nem csak fejlesztői) parancs lesz a README-ben (3.1), aminek működnie kell akkor is, ha valaki `--omit=dev`-vel telepítene (bár a jelen projekt konvenciója szerint mindig teljes `npm ci` fut — ld. Story 1.1 — a kategorizálás így inkább szemantikai konzisztencia, mint tényleges blokkoló kockázat).
- **`resolveCoordinates()`/`seedCustomers()` szándékosan NEM importálja statikusan a `db/pool.ts`-t/`env.ts`-t** — a `main()` függvényen belüli dinamikus (`await import(...)`) importtal késleltetem a `DATABASE_URL` validációt a tényleges CLI-futtatásig. Enélkül a `test/unit/seed.test.ts` (ami a `resolveCoordinates`-t teszteli) is megkövetelné a `DATABASE_URL` beállítását pusztán a modul betöltéséhez — ez szükségtelen csatolás lenne egy valódi unit teszt és a DB-konfiguráció között. Ez a döntés nem sérti az AD-3-at (a Pool konstrukció továbbra is kizárólag a `db/pool.ts`-en keresztül történik), csak azt biztosítja, hogy MIKOR történik.
- **AD-3 (egyetlen Pool-modul) és a teszt-DB-izoláció összeegyeztetése:** `db/pool.ts` egy `createPool(connectionString)` factory-t exportál (amit KIZÁRÓLAG ez a modul hív `new Pool(...)`-lel) plusz egy `pool` singletont a `DATABASE_URL`-hez. A `test/integration/seed.test.ts` ugyanezt a factory-t hívja `requireTestDatabaseUrl()`-lel kapott connection stringgel — így sosem jön létre `new Pool(...)` hívás a `db/pool.ts`-en kívül, miközben a teszt-DB izolált a dev DB-től (AD-9).
- **AD-1 (rétegzés)** — `customersRepository.ts` kizárólag DB I/O-t és sor→domain leképezést tartalmaz (`upsertCustomer`), semmi Haversine/rendezés/üzleti logika; `seed.ts` a standalone entrypoint, ami újrahasznosítja a repository-t és a geocoding réteget, de megkerüli a HTTP/service réteget (ami egyelőre nem is létezik).
- **AD-2/addendum.md (paraméterezett lekérdezés)** — az `upsertCustomer()` kizárólag `$1..$7` placeholder-eket használ, sosem string-konkatenációt; a `Niamh O'Brien` (aposztróf) az integrációs idempotencia-teszten keresztül bizonyítja ezt élesben (a valódi 15 seed-rekord tartalmazza).
- **AD-5 (seed upsert szemantika)** — `ON CONFLICT (name, telepules) DO UPDATE SET lat=EXCLUDED.lat, lon=EXCLUDED.lon, budget=EXCLUDED.budget, note=EXCLUDED.note, country_code=EXCLUDED.country_code` — pontosan az Architecture Spine szövege szerint, sosem `DO NOTHING`.
- **AD-9 (config fail-fast; teszt-DB izoláció)** — `env.ts` `DATABASE_URL`-t kötelezővé és validálttá teszi modul-betöltéskor; `TEST_DATABASE_URL` NEM kötelező az `env`-objektum betöltéséhez (nehogy a sima seed/app-futtatás összeomoljon, ha nincs beállítva), de a dedikált `requireTestDatabaseUrl()` fail-stop hibát dob, ha hiányzik — ezt kizárólag az integrációs teszt setup hívja, sosem esik vissza `DATABASE_URL`-re.
- **Kizárt ebből a story-ból (más story-k felelőssége):** `src/app.ts`, `src/server.ts`, bármilyen route/service/middleware kód, `GET` végpontok, `PORT` tényleges felhasználása (csak validálva van, nincs `.listen()` még), `.mcp.json` (1.5), `findAll`/`count` repository-függvények (2.3/2.4).

### Project Structure Notes

- Alignment: `src/config/env.ts`, `src/db/pool.ts`, `src/repositories/customersRepository.ts`, `src/seed.ts` pontosan megfelelnek az `ARCHITECTURE-SPINE.md#Structural Seed` bejegyzéseinek. [Source: ARCHITECTURE-SPINE.md#Structural Seed]
- Alignment: `test/unit/seed.test.ts` és `test/integration/seed.test.ts` a Structural Seed `test/unit/` és `test/integration/` könyvtárainak felel meg.
- A most már feleslegessé váló `.gitkeep` fájlok (`src/config/.gitkeep`, `src/db/.gitkeep`, `src/repositories/.gitkeep`) törlésre kerülnek, ugyanazt a mintát követve, mint az 1.3 story `test/unit/.gitkeep` törlése.
- Nincs eltérés (variance) a Structural Seed-től.

### References

- [Source: epics.md#Story 1.4: Idempotens seed script] — a story pontos Given/When/Then AC-jei
- [Source: epics.md#Epic 1: Reproducible Local Data Foundation] — epic-szintű kontextus
- [Source: prd.md#FR-2, FR-3, FR-5, FR-10] — funkcionális elfogadási feltételek, dedikált ismeretlen-település fixture követelménye
- [Source: addendum.md#Paraméterezett adatbázis-lekérdezések] — kötelező paraméterezés, `Niamh O'Brien` indoklás
- [Source: ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-3, AD-5, AD-9, AD-14] — rétegzés, paraméterezés, Pool-modul, upsert szemantika, config fail-fast, `Customer` típus
- [Source: ARCHITECTURE-SPINE.md#Structural Seed, #customers table (DDL shape), #Runtime data flow — seed]
- [Source: 1-1-projekt-scaffold-es-lokalis-postgres-docker-compose-zal.md#Dev Notes] — ESM/`NodeNext` `.js`-import konvenció, host port 5433
- [Source: 1-2-customers-tabla-migracio.md#Dev Notes] — verzió-currency dokumentálási minta, `UNIQUE(name, telepules)` már alkalmazva
- [Source: 1-3-offline-telepules-koordinata-referencia-es-normalizetown.md#Dev Agent Record] — `normalizeTown()`/`lookupTownCoordinate()` non-throwing garancia, `Object.create(null)` védelem
- `seed-customers.json` (repo gyökér) — a 15 valódi seed-rekord pontos alakja (`name`, `budget`, `location.city`, `location.countryCode`, `note`), beleértve a `Niamh O'Brien` aposztrófos nevet
- npm registry (`npm view tsx dist-tags`, `npm view dotenv dist-tags`) — verzió-currency ellenőrzés a jelen session-ben
- Lokális repró-teszt (jelen session) — `node --experimental-strip-types` `ERR_MODULE_NOT_FOUND` hibája `.js`-re mutató relatív `.ts`→`.ts` importon; `tsx` ugyanazon a reprón hibamentes

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code, bmad-dev-story workflow, autonomous mode)

### Debug Log References

- `node --experimental-strip-types` repro (this session): a minimal two-file `.ts`→`.ts` (via `.js`-suffixed relative import, the repo's NodeNext convention) case failed with `ERR_MODULE_NOT_FOUND` under Node's native type-stripping. The identical repro ran clean under `npx tsx@4.23.1`. This confirmed the `tsx` decision documented in Dev Notes.
- `test/integration/seed.test.ts` initially failed with `error: relation "customers" does not exist` — the `customer_distance_test` DB had never been migrated (Story 1.2 only migrated the dev DB). Fixed by running `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/customer_distance_test npx node-pg-migrate up` once in this session (not a story code change — a one-time local environment step; README, Story 3.1, should document that both DBs need migrating).
- `npx tsc --noEmit` initially failed with `TS7016` on `pg` imports (`Could not find a declaration file for module 'pg'`) — fixed by installing `@types/pg@8.20.0` as an exact-pinned devDependency.
- Fail-fast paths manually exercised for real, not just claimed: (1) `.env` temporarily moved aside, `node --import tsx -e "import('./src/config/env.js')"` → `Error: [config] Missing required environment variable: DATABASE_URL...` (`.env` restored immediately after); (2) `PORT=notanumber` → `Error: [config] PORT must be an integer between 1 and 65535, got "notanumber"`; (3) `TEST_DATABASE_URL="" node ... requireTestDatabaseUrl()` → `Error: [config] Missing required environment variable: TEST_DATABASE_URL. Integration tests must never fall back to DATABASE_URL (AD-9)...`.

### Completion Notes List

- All 8 ACs verified end-to-end against real, running Postgres (not mocked): AC #1 (`env.ts`/`pool.ts` created, fail-fast manually verified for `DATABASE_URL` missing, `PORT` invalid, and `TEST_DATABASE_URL` missing — see Debug Log), AC #2/#4 (real `npm run seed` run twice against the dev DB, `customer_distance`), AC #3 (`Niamh O'Brien` present, correct, unmangled after two upserts), AC #5 (dedicated fixture integration test), AC #6/#7 (`Customer`/`UpsertCustomerInput` types + parameterized-only `upsertCustomer`), AC #8 (`test/integration/seed.test.ts` against `TEST_DATABASE_URL`, `requireTestDatabaseUrl()` fail-stop, never falls back to `DATABASE_URL`).
- `npm run test:unit` (`vitest run test/unit`): **3 test files, 38 tests passed**, run with `DATABASE_URL`/`TEST_DATABASE_URL` explicitly unset (`env -u DATABASE_URL -u TEST_DATABASE_URL`) to prove `resolveCoordinates()`'s unit test needs no DB config at all — confirms the deliberate `main()`-only dynamic import of `db/pool.js` in `seed.ts` actually decouples unit-testability from DB config, not just in theory.
- `npm run test:integration` (`vitest run test/integration`, against `TEST_DATABASE_URL` / `customer_distance_test`): **1 test file, 2 tests passed** — idempotency (15 rows after 2 runs, `Niamh O'Brien` intact) and dedicated unknown-town fixture (null lat/lon + processing continued to the next record).
- `npm test` (`vitest run`, both suites together): **4 test files, 40 tests passed**, ~230ms.
- Real dev-DB seed run (`npm run seed`, `customer_distance`), executed twice: first run inserted 15 rows, second run left the table at exactly 15 rows (`SELECT COUNT(*)` verified via `docker compose exec postgres psql`) — `id`s stayed `1..15` (upsert, not insert-then-conflict-skip). Anna Kovács (Budapest) row: `lat=47.4979, lon=19.0402`, bit-for-bit equal to `BUDAPEST_REF`. Niamh O'Brien (Dublin) row present exactly once, name/apostrophe intact, `lat=53.3498, lon=-6.2603`. All 15 real seed towns matched the reference — no `[seed] Unknown town` warnings were logged for real data, as expected (PRD FR-5/FR-10 note-for-PM).
- Scope discipline: did not create `src/app.ts`/`src/server.ts`/routes/services/middleware; did not implement any `GET` endpoint; did not add `findAll()`/`count()` to the repository (2.3/2.4's job); did not touch `.mcp.json` (1.5).
- `dotenv`/`tsx`/`@types/pg` — decisions and rationale documented in Dev Notes (`[ASSUMPTION]` tags), including the concrete `node --experimental-strip-types` failure repro that ruled it out.

### File List

**New:**
- `src/config/env.ts`
- `src/db/pool.ts`
- `src/repositories/customersRepository.ts`
- `src/seed.ts`
- `test/unit/seed.test.ts`
- `test/integration/seed.test.ts`

**Modified:**
- `package.json` (added `dotenv@17.4.2`, `tsx@4.23.1` dependencies; `@types/pg@8.20.0` devDependency; `seed`/`test:unit`/`test:integration` npm scripts)
- `package-lock.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (`1-4-idempotens-seed-script`: `backlog` → `ready-for-dev` → `in-progress` → `review`; `last_updated: 2026-07-19`)

**Removed:**
- `src/config/.gitkeep`, `src/db/.gitkeep`, `src/repositories/.gitkeep` (superseded by real source files)
- `test/integration/.gitkeep` (superseded by `test/integration/seed.test.ts`)

### Change Log

- 2026-07-19: Story created (`bmad-create-story` workflow), Status `ready-for-dev`.
- 2026-07-19: Story implemented (`bmad-dev-story` workflow, autonomous mode) — Tasks 1–8 completed. `env.ts`/`pool.ts`/`customersRepository.ts`/`seed.ts` implemented; 38 unit + 2 integration tests written and run for real (40/40 passing); real dev-DB seed run twice, verified 15 rows via psql, apostrophe/Budapest spot-checks passed. Status `in-progress` → `review`.
