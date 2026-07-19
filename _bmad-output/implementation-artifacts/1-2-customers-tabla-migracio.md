---
baseline_commit: b4bdee539af34d018eb813c324a1eaace836f699
---

# Story 1.2: `customers` tábla migráció

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Mint fejlesztő,
egy verziózott migrációt szeretnék, ami létrehozza a `customers` táblát a helyes megszorításokkal,
hogy legyen hova betölteni a seed-adatot.

## Acceptance Criteria

1. **Given** egy futó Postgres instance és üres séma, **when** a fejlesztő lefuttatja a migrációt (`node-pg-migrate`, `8.0.4` pontos verzió), **then** létrejön a `customers` tábla az alábbi oszlopokkal: `id BIGSERIAL PRIMARY KEY`, `name TEXT NOT NULL`, `telepules TEXT NOT NULL`, `lat DOUBLE PRECISION NULL`, `lon DOUBLE PRECISION NULL`, `budget INTEGER NULL`, `note TEXT NULL`, `country_code VARCHAR(2) NULL`. [Source: epics.md#Story 1.2; ARCHITECTURE-SPINE.md#customers table (DDL shape)]
2. A tábla tartalmazza a `UNIQUE(name, telepules)` megszorítást. [Source: epics.md#Story 1.2; prd.md#FR-1; ARCHITECTURE-SPINE.md#AD-7]
3. A tábla tartalmazza a két lat/lon-tartomány `CHECK` megszorítást (`lat IS NULL OR lat BETWEEN -90 AND 90`; `lon IS NULL OR lon BETWEEN -180 AND 180`) és a lat/lon páros nullness `CHECK`-et (`(lat IS NULL AND lon IS NULL) OR (lat IS NOT NULL AND lon IS NOT NULL)`). [Source: epics.md#Story 1.2; ARCHITECTURE-SPINE.md#AD-7, #customers table (DDL shape)]
4. A migrációs fájl `node-pg-migrate` alapértelmezett időbélyeg-alapú elnevezését használja (`node-pg-migrate create <name>` generálja, nem kézzel számozott fájlnév). [Source: epics.md#Story 1.2; ARCHITECTURE-SPINE.md#AD-7]
5. **When** a migrációt visszavonják (`down`), **then** a `customers` tábla és minden megszorítása eltűnik hiba nélkül. [Source: epics.md#Story 1.2; ARCHITECTURE-SPINE.md#AD-7]
6. **When** a migrációt kétszer futtatják egymás után `up`-pal, **then** nem keletkezik hiba vagy duplikált sémaelem (a `node-pg-migrate` saját `pgmigrations` követő táblája alapján a második `up` no-op). [Source: epics.md#Story 1.2; ARCHITECTURE-SPINE.md#AD-7]
7. A migráció explicit `up` és `down` függvényt exportál (nem csak `up`-ot). [Source: ARCHITECTURE-SPINE.md#AD-7]

## Tasks / Subtasks

- [x] **Task 1 — `node-pg-migrate` telepítése és npm scriptek (AC: #1, #4)**
  - [x] Ellenőrizd webről a `node-pg-migrate` jelenlegi stabil verzióját és a `9.0.0-alpha` előzetes vonalat — az `ARCHITECTURE-SPINE.md#Stack` `8.0.4` pontos verziót ír elő, `9.0.0-alpha` kerülésével. **Megjegyzés:** az npm registry a mai nap (2026-07-19) állapota szerint már `9.0.0`-t (nem alpha, hanem teljes stabil release) jelöl `latest` dist-tag-ként, és létezik egy `10.0.0-alpha` vonal is — az architektúra 1 nappal korábban (2026-07-18) készült, és időközben elavult a "kerüld a 9.0.0-alpha-t" indoklás konkrét részlete. Ld. Dev Notes — döntés: a ratifikált Architecture Spine `8.0.4` pontos pinnelését követtem (nem architektúra-módosítás e story hatóköre), a talált verzió-eltérést dokumentáltam, nem blokkoltam vele a story-t.
  - [x] `npm install --save-dev --save-exact node-pg-migrate@8.0.4` — devDependency, mert build/tooling-eszköz, ugyanúgy, ahogy a `typescript` (1.1 story konvenciója).
  - [x] `npm install --save-exact pg@8.22.0` — a `node-pg-migrate` CLI futtatásához szükséges peer-szerű függőség, és az `ARCHITECTURE-SPINE.md#Stack` szerint az alkalmazás is ezt fogja futásidőben használni (`src/db/pool.ts`, 1.4 story) — ezért `dependencies`-be került, nem `devDependencies`-be (a `node-pg-migrate` maga `devDependencies`-ben marad, mert az csak build/tooling-időben fut, nem runtime-ban).
  - [x] Adj hozzá három npm scriptet a `package.json`-hoz: `"migrate:create": "node-pg-migrate create"`, `"migrate:up": "node-pg-migrate up"`, `"migrate:down": "node-pg-migrate down"`.
  - [x] Ellenőrizd: `npx node-pg-migrate --help` hibamentesen fut és megmutatja a CLI opciókat (`DATABASE_URL` env változó az alapértelmezett kapcsolat-forrás, `migrations/` az alapértelmezett könyvtár).

- [x] **Task 2 — Migrációs fájl generálása `node-pg-migrate create`-tel (AC: #4)**
  - [x] Futtasd: `npm run migrate:create -- create_customers_table` — ez a `node-pg-migrate` saját időbélyeg-alapú elnevezését használja (`<timestamp>_create_customers_table.js`), nem kézzel írt sorszámot. Eredmény: `migrations/1784457387443_create-customers-table.js`.
  - [x] A generált fájl alapértelmezett nyelve JavaScript (`.js`, `migration-file-language` default: `js`, mivel még nincs korábbi migráció a repóban) — ez szándékos döntés: elkerüli a TypeScript migrációs fájlokhoz szükséges `ts-node`/`tsx` extra függőséget és a `NodeNext`+`"type": "module"` explicit `.js` kiterjesztés-igényéből fakadó bonyodalmat migrációs fájloknál (ld. Dev Notes — Story 1.1 review finding erről). A `package.json` `"type": "module"` miatt a `.js` fájl natívan ESM-ként fut (`export const up = ...` szintaxis).

- [x] **Task 3 — `up`/`down` implementálása a pontos DDL-lel (AC: #1, #2, #3, #7)**
  - [x] Töltsd ki a generált migrációs fájl `up` exportját az `ARCHITECTURE-SPINE.md#customers table (DDL shape)` szakaszban megadott pontos DDL-lel: `id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, telepules TEXT NOT NULL, lat DOUBLE PRECISION NULL, lon DOUBLE PRECISION NULL, budget INTEGER NULL, note TEXT NULL, country_code VARCHAR(2) NULL`, `UNIQUE(name, telepules)`, a két lat/lon-tartomány `CHECK` és a páros nullness `CHECK`. **Nem-nyilvánvaló buktató, amit itt fedeztem fel és javítottam:** a `node-pg-migrate` `id: 'id'` shorthand-ja alapértelmezetten `SERIAL PRIMARY KEY`-t generál, NEM `BIGSERIAL`-t (ellenőrizve `node_modules/node-pg-migrate/dist/bundle/index.js`-ben: `id: { type: "serial", primaryKey: true }`) — az AC #1 explicit `BIGSERIAL`-t követel, ezért explicit `{ type: 'bigserial', primaryKey: true }` oszlop-definíciót használtam a shorthand helyett.
  - [x] Töltsd ki a `down` exportot: dobja el a `customers` táblát (`pgm.dropTable('customers')` — a constraintek a táblával együtt automatikusan eltűnnek, nincs szükség külön `dropConstraint` hívásra).
  - [x] Használd a `node-pg-migrate` deklaratív `pgm.createTable(...)` API-ját (nem nyers `pgm.sql(...)` string), hogy a `down` szimmetrikusan `pgm.dropTable(...)`-tel visszavonható legyen — konzisztens az AD-7 "reversible" követelményével.

- [x] **Task 4 — Migráció futtatása és séma-ellenőrzés valódi Postgres ellen (AC: #1, #2, #3)**
  - [x] `DATABASE_URL` legyen beállítva a `.env.example`-ben dokumentált dev-DB-re (`postgresql://postgres:postgres@localhost:5433/customer_distance`) — a Postgres konténer már fut ebben a session-ben.
  - [x] Futtasd: `npm run migrate:up`. Sikeres, a generált SQL pontosan a várt DDL-t futtatta (`CREATE TABLE`, majd 4 db `ADD CONSTRAINT`).
  - [x] Ellenőrizd `docker compose exec postgres psql -U postgres -d customer_distance -c "\d customers"`: minden oszlop jelen van a helyes típussal (`bigint` a `bigserial`-ból, `text`, `double precision`, `integer`, `character varying(2)`), a `UNIQUE` és mindhárom `CHECK` megszorítás látszik.
  - [x] Ellenőrizd az `information_schema.columns` és `information_schema.table_constraints`/`check_constraints` nézeteken keresztül is — pontosan megfelel a specifikációnak (nullability, `character_maximum_length=2` a `country_code`-on, mind a 4 explicit constraint + 3 NOT NULL check + PK jelen van).
  - [x] **Extra funkcionális verifikáció (nem volt kötelező task-elem, de erős elfogadási bizonyíték):** érvényes sorok (Budapest koordinátával, illetve null lat/lon-nal) sikeresen beszúrhatók; érvénytelen sorok (lat=999, lon=999, lat kitöltve+lon null, duplikált name+telepules) mindegyike a várt constraint-tel elutasításra került (`customers_lat_check`, `customers_lon_check`, `customers_lat_lon_pair_check`, `customers_name_telepules_key`). Teszt-sorok törölve, a tábla üresen maradt a következő story-k számára.

- [x] **Task 5 — Re-run biztonság és rollback ellenőrzése (AC: #5, #6)**
  - [x] Futtasd újra: `npm run migrate:up` — no-op volt: `"No migrations to run!"`, nincs hiba, nincs duplikált sémaelem.
  - [x] Futtasd: `npm run migrate:down` — ellenőrizve `\d customers`-sel: `"Did not find any relation named customers"`, azaz a tábla és minden megszorítása eltűnt, hiba nélkül.
  - [x] Futtasd újra: `npm run migrate:up`, hogy a DB-t alkalmazott állapotban hagyd a következő story-k számára (1.3+ a `customers` táblára fog építeni). Sikeres, a séma bit-azonos az első futtatással.
  - [x] Végső ellenőrzés: `\d customers` mutatja a teljes, helyes sémát az alkalmazott állapotban, üres táblával (0 sor).

- [x] **Task 6 — Story-dokumentáció és delivery (delivery norma, NFR7)**
  - [x] Frissítsd ezt a story fájlt: Tasks pipálása, Dev Agent Record kitöltése, Status `in-progress` → `review`.
  - [x] Frissítsd a `sprint-status.yaml`-t: `1-2-customers-tabla-migracio` `backlog` → `ready-for-dev` → `in-progress` → `review`.
  - [x] Kis, fókuszált commitok: (1) story-fájl létrehozása, (2) tooling telepítés + npm scriptek, (3) a migrációs fájl + verifikáció + story lezárás. Nincs egyetlen mindent-összefogó záró commit (NFR7).

## Dev Notes

- **Előző story (1.1) tanulságai, relevánsak erre a story-ra:**
  - A `NodeNext` modulrezolúció + `"type": "module"` miatt a relatív TS importoknak explicit `.js` kiterjesztést kell használniuk — ez a migrációs fájlra nem vonatkozik közvetlenül (a migráció `.js`, nem importál relatív TS modult), de fontos a jövőbeli story-k (`src/db/pool.ts`, 1.4) számára.
  - A `docker-compose.yml` Postgres a host `127.0.0.1:5433`-on fut, `postgres`/`postgres` dev-credentialekkel — ez a story ezt a már futó instance-t használja, nem indít/állít le konténert (kivéve, ha az `up`/`down` teszteléshez szükséges — nem volt szükséges, a konténer a session elején már fut).
  - Nincs `src/db/pool.ts` vagy `src/config/env.ts` még — ez a story NEM hozza létre ezeket (1.4 feladata); a `node-pg-migrate` CLI natívan, saját maga olvassa a `DATABASE_URL`-t a környezetből, nincs szükség egyedi kapcsolódási kódra.
- **AD-7 (`ARCHITECTURE-SPINE.md`)** — a kezdő migrációnak KÖTELEZŐ létrehoznia a `customers` táblát pontosan a Structural Seed DDL-nek megfelelően; ezek séma-szintű invariánsok, nem csak illusztratívak. A migrációs fájlnév a `node-pg-migrate create <name>` saját időbélyeg-alapú generálását használja, sosem kézzel írt sorszámot. Az AD-5 (seed upsert `ON CONFLICT (name, telepules)`) a `UNIQUE(name, telepules)` megszorítás létére épül — ez a story teremti meg ennek előfeltételét a 1.4 story számára.
- **AD-2 (parameterizált query)** — ez a story nem ír alkalmazás-szintű SQL-lekérdezést (a migráció DDL, nem dinamikus INSERT/UPDATE), így az AD-2 direktben nem alkalmazandó erre a story-ra, de a `customers` tábla `UNIQUE`/`CHECK` megszorításai előfeltételei a későbbi story-k (1.4 seed upsert) paraméterezett lekérdezéseinek.
- **Stack (`ARCHITECTURE-SPINE.md#Stack`)** — `node-pg-migrate` `8.0.4` pontos pin (`^`/`~` nélkül), ugyanaz a konvenció, mint a `typescript@6.0.2` (1.1 story). `pg` `8.22.0` a Stack táblázat szerint.
- **Verzió-currency megjegyzés (`[ASSUMPTION]`-hez hasonló, dokumentált döntés, nem blokkoló):** a webes ellenőrzés (npm registry, 2026-07-19) szerint a `node-pg-migrate` `latest` dist-tag-je mára `9.0.0` (teljes stabil release, már NEM alpha), és létezik egy `10.0.0-alpha` vonal is. Az `ARCHITECTURE-SPINE.md#Stack` (2026-07-18-i, "final" állapotú) még `8.0.4`-et ír elő, "a `9.0.0-alpha` előzetes vonal létezik és nem használandó" indoklással — ez az indoklás technikailag elavult (a 9-es vonal már nem alpha), de a Spine maga egy ratifikált, "final" állapotú döntési dokumentum, aminek felülbírálása nem e story hatásköre (scope-bővítés lenne). **Döntés:** a `8.0.4` pontos pinnelést követtem az Architecture Spine szerint, a talált eltérést itt dokumentáltam, nem blokkoltam vele a story-t. Egy jövőbeli architektúra-revízió mérlegelhetné a frissítést, de a major verzióváltás (8→9) potenciálisan breaking change-eket hordoz (CLI/migrációs fájlformátum), aminek vizsgálata túlmutat ezen a story-n.
- **`node-pg-migrate` CLI-viselkedés (kutatva, mert a story leírás explicit kérte az ellenőrzést egyedi kapcsolódási kód szükségessége előtt):** a CLI natívan olvassa a `DATABASE_URL` env változót (nincs szükség `--config-file`-ra vagy egyedi alkalmazás-kódra); a `migrations/` az alapértelmezett könyvtár; a `create` parancs alapértelmezetten `.js` fájlt generál időbélyeg-prefix-szel, amíg nincs korábbi migráció, ami eltérő nyelvet határozna meg; a `pg` csomag kötelező (peer-szerű) függőség a CLI futtatásához.
- **Miért `pgm.createTable` és nem nyers `pgm.sql`:** a `node-pg-migrate` deklaratív API-ja (`createTable`/`dropTable`) automatikusan szimmetrikus, jól definiált `down` viselkedést biztosít, és olvashatóbb, mint kézzel írt DDL-string — konzisztens az AD-7 "reversible" invariánssal.

### Project Structure Notes

- Alignment: a migrációs fájl a `migrations/` könyvtárba kerül, pontosan a Structural Seed-nek megfelelően. [Source: ARCHITECTURE-SPINE.md#Structural Seed]
- Nincs eltérés (variance) — ez a story szigorúan a `migrations/` könyvtárra és a hozzá tartozó npm scriptekre/függőségekre korlátozódik, nem nyúl `src/`-hez.

### References

- [Source: epics.md#Story 1.2: `customers` tábla migráció] — a story pontos Given/When/Then AC-jei
- [Source: epics.md#Epic 1: Reproducible Local Data Foundation] — epic-szintű kontextus
- [Source: epics.md#Requirements Inventory — Additional Requirements] — Stack pontos verziók, AD-7 szövege
- [Source: prd.md#FR-1: Customers tábla migrációval] — funkcionális elfogadási feltételek (kötelező mezők, `UNIQUE(name, telepules)`, ismételt futtatás biztonsága)
- [Source: addendum.md#Paraméterezett adatbázis-lekérdezések] — háttér-kontextus (nem e story közvetlen hatóköre, DDL-migráció)
- [Source: ARCHITECTURE-SPINE.md#AD-7 — Versioned, rollback-capable migrations]
- [Source: ARCHITECTURE-SPINE.md#customers table (DDL shape)] — pontos DDL
- [Source: ARCHITECTURE-SPINE.md#Stack] — `node-pg-migrate` 8.0.4, `pg` 8.22.0 pontos verziók
- [Source: ARCHITECTURE-SPINE.md#Structural Seed] — `migrations/` könyvtár helye
- [Source: 1-1-projekt-scaffold-es-lokalis-postgres-docker-compose-zal.md#Dev Agent Record] — port 5433, ESM/`NodeNext` konvenció, Docker Compose már fut
- npm registry (`npm view node-pg-migrate versions/dist-tags`, 2026-07-19) — verzió-currency ellenőrzés eredménye
- `node-pg-migrate` README (GitHub, `v8.0.4` tag) — CLI kapcsolódási mechanizmus (`DATABASE_URL` natívan olvasva), `create` parancs viselkedése

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code, bmad-dev-story workflow, autonomous mode)

### Debug Log References

- npm registry ellenőrzés (`npm view node-pg-migrate dist-tags`) 2026-07-19-én azt mutatta, hogy a `latest` dist-tag már `9.0.0` (nem alpha), eltérően az `ARCHITECTURE-SPINE.md` 2026-07-18-i "9.0.0-alpha kerülendő" indoklásától. Döntés: a ratifikált `8.0.4` pin megtartva, eltérés dokumentálva (ld. Dev Notes).

### Completion Notes List

- Mind a 7 AC verifikálva valódi, futó Postgres ellen (nem mockolt): oszlopok/típusok `\d customers` és `information_schema.columns`-szal; `UNIQUE`/3× `CHECK` `information_schema.table_constraints`/`check_constraints`-szal; explicit `up`/`down` export a migrációs fájlban; `node-pg-migrate create`-tel generált időbélyeg-alapú fájlnév; `down` hiba nélkül eltünteti a táblát és minden megszorítását; kétszeri `up` no-op (`"No migrations to run!"`).
- Extra, nem kötelező de erős elfogadási bizonyíték: funkcionális negatív tesztek (`INSERT`) mindhárom `CHECK` és a `UNIQUE` megszorítást ténylegesen kikényszerítik futásidőben, nem csak a séma-deklaráció szintjén léteznek.
- Nem-nyilvánvaló buktató: a `node-pg-migrate` `id: 'id'` beépített shorthand-ja `SERIAL`-t (int4) generál, nem `BIGSERIAL`-t — ezt csak a `node_modules` forráskódjának ellenőrzésével fedeztem fel a `pgm.createTable` megírása közben, és explicit `{ type: 'bigserial', primaryKey: true }`-jal javítottam, mielőtt a migrációt lefuttattam volna. Ha ezt nem veszem észre, az AC #1 (`id BIGSERIAL PK`) csendben sérült volna.
- Verzió-currency megjegyzés (nem blokkoló, dokumentált döntés): az npm registry ma (2026-07-19) `9.0.0`-t mutat `node-pg-migrate` `latest` dist-tag-ként (már nem alpha, ahogy az Architecture Spine 1 nappal korábbi szövege feltételezte). A ratifikált `8.0.4` pontos pin mellett maradtam — ez nem architektúra-módosítás, csak a story hatóköre; ld. Dev Notes.
- A `customers` tábla a story végén alkalmazott (`up`) állapotban, üresen (0 sor) marad a Postgres dev-adatbázisban — készen áll az 1.4 (seed) story számára. A Postgres konténer futva marad (nem állítottam le), mivel a session folytatódik további story-kkal.
- Nincs unit/integrációs teszt-fájl ehhez a story-hoz (szándékosan) — DDL-migrációnak nincs alkalmazás-szintű logikája, amit unit-tesztelni lehetne; az elfogadási bizonyíték a fenti psql/`information_schema` verifikáció és a funkcionális constraint-tesztek (ld. Task 4).

### File List

**New:**
- `migrations/1784457387443_create-customers-table.js`

**Modified:**
- `package.json` (node-pg-migrate 8.0.4 devDependency, pg 8.22.0 dependency, migrate:create/up/down npm scripts)
- `package-lock.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-2-customers-tabla-migracio: backlog → ready-for-dev → in-progress → review; last_updated: 2026-07-19)

### Change Log

- 2026-07-19: Story létrehozva (`bmad-create-story` workflow), Status `ready-for-dev`.
- 2026-07-19: Story implementálva (`bmad-dev-story` workflow, autonomous mode) — Tasks 1–6 elvégezve, mind a 7 AC verifikálva valódi Postgres ellen. Status `in-progress` → `review`.
