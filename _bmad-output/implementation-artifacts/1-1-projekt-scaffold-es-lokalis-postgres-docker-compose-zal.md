# Story 1.1: Projekt-scaffold és lokális Postgres Docker Compose-zal

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Mint fejlesztő,
inicializált Node/TypeScript projektet és egy Docker Compose-szal indítható lokális Postgres-t szeretnék,
hogy legyen hova migrálni és seedelni.

## Acceptance Criteria

1. `docker compose up -d` egy `postgres:18` konténert indít el (Docker Compose a hivatalos indítási mechanizmus). [Source: epics.md#Story 1.1; prd.md#FR-12]
2. A futó konténer két logikai adatbázist tartalmaz ugyanazon Postgres instance-en: `customer_distance` és `customer_distance_test`. [Source: epics.md#Story 1.1; ARCHITECTURE-SPINE.md#AD-9]
3. A `package.json` a `typescript` csomagot pontosan `6.0.2`-re pinneli — nincs `^` vagy `~` prefix a verziószámon. [Source: epics.md#Story 1.1; ARCHITECTURE-SPINE.md#Stack]
4. A függőségek telepítése `npm ci`-vel történik, és ez reprodukálható: a `package-lock.json` jelen van, verzió-konzisztens a `package.json`-nal, és be van committolva. [Source: epics.md#Story 1.1; ARCHITECTURE-SPINE.md#Stack]
5. A projekt forrásfa-váza megfelel az `ARCHITECTURE-SPINE.md` Structural Seed szakaszának: `src/config`, `src/db`, `src/geocoding`, `src/repositories`, `src/services`, `src/routes`, `src/middleware` könyvtárak léteznek a repóban (tartalom nélkül — a bennük lévő fájlok későbbi story-k feladata). [Source: epics.md#Story 1.1; ARCHITECTURE-SPINE.md#Structural Seed]
6. Egy `.env.example` fájl a repo gyökerében dokumentálja a `DATABASE_URL`, `TEST_DATABASE_URL` és `PORT` környezeti változókat. [Source: epics.md#Story 1.1; ARCHITECTURE-SPINE.md#AD-9]
7. Az `.env.example`-ben nincs valódi titok — a benne szereplő credential-ok kizárólag a lokális Docker Compose dev-adatbázishoz tartozó, nem-titkos alapértékek, amelyek megegyeznek a `docker-compose.yml`-ben definiáltakkal. [Source: epics.md#Story 1.1; ARCHITECTURE-SPINE.md#AD-9]

## Tasks / Subtasks

- [ ] **Task 1 — Projekt forrásfa-váz létrehozása (AC: #5)**
  - [ ] Hozd létre az alábbi könyvtárakat a repo gyökeréből: `src/config`, `src/db`, `src/geocoding`, `src/repositories`, `src/services`, `src/routes`, `src/middleware`.
  - [ ] Hozd létre a `migrations/`, `test/unit/`, `test/integration/` könyvtárakat is (ezek szintén szerepelnek a Structural Seed-ben; tartalmukat a 1.2, 2.1, 2.4 story-k töltik fel — itt csak a váz jön létre).
  - [ ] Mivel git nem követ üres könyvtárakat, tegyél egy üres `.gitkeep` fájlt minden fenti könyvtárba, hogy azok committolhatók legyenek üresen.
  - [ ] **NE** hozz létre `src/app.ts`-t, `src/server.ts`-t, `src/seed.ts`-t, `src/config/env.ts`-t vagy `src/db/pool.ts`-t ebben a story-ban — ezek tartalmát a 1.4 (seed.ts, env.ts, pool.ts) és a 2.2 (app.ts, server.ts) story hozza létre. Az AC #5 kizárólag a 7 réteg-könyvtárat követeli meg, nem ezeket a fájlokat; placeholder stub fájlok létrehozása felesleges duplikációs/felülírási kockázatot jelentene a későbbi story-kban (AD-10 — ne over-engineeringelj).
  - [ ] **NE** hozz létre semmilyen migrációs fájlt a `migrations/`-ben — az a 1.2 story feladata.

- [ ] **Task 2 — Node/TypeScript projekt inicializálása pontos `typescript` pinneléssel (AC: #3, #4)**
  - [ ] `npm init -y` a repo gyökerében, majd szerkeszd a generált `package.json`-t: `"name": "customer-distance-api"`, `"private": true`, `"type": "module"` (ld. Dev Notes — ESM döntés), `"engines": { "node": ">=24" }`.
  - [ ] `npm install --save-dev --save-exact typescript@6.0.2` — a `--save-exact` biztosítja, hogy a `package.json`-ban `"typescript": "6.0.2"` szerepeljen `^`/`~` nélkül. Ellenőrizd a `package.json`-t utána: a `typescript` bejegyzésnek pontosan `"6.0.2"`-nek kell lennie.
  - [ ] `npm install --save-dev @types/node@24` (a Node 24 típusdefiníciói; nem igényel pontos pinnelést, csak a `typescript`/`node-pg-migrate` igényel az Architecture Spine Stack táblája szerint).
  - [ ] Hozz létre egy `tsconfig.json`-t a repo gyökerében (lásd Dev Notes — pontos tartalom).
  - [ ] Adj hozzá egy minimális `"scripts": { "build": "tsc" }` bejegyzést a `package.json`-hoz. Ne adj hozzá más npm scriptet (pl. `dev`, `test`, `migrate`, `seed`) — ezek pontos elnevezése az Architecture Spine szerint deferred, a döntést az adott funkciót bevezető story hozza (1.2, 1.4, 2.x).
  - [ ] Committold a `package-lock.json`-t.
  - [ ] Ellenőrizd a reprodukálhatóságot: `rm -rf node_modules && npm ci` — hibamentesen kell lefutnia, és a `node_modules/typescript/package.json`-ban a verziónak `6.0.2`-nek kell lennie.
  - [ ] Megjegyzés: mivel ez a story még nem hoz létre egyetlen `.ts` forrásfájlt sem a `src/`-ben, az `npm run build` ebben a fázisban "No inputs were found" hibát fog jelezni — ez ELVÁRT és nem hiba; ne próbáld ezt üres/placeholder `.ts` fájlok hozzáadásával elkerülni (ld. Task 1 tiltása).

- [ ] **Task 3 — Docker Compose: `postgres:18`, két logikai adatbázissal (AC: #1, #2)**
  - [ ] Hozd létre a `docker-compose.yml`-t a repo gyökerében a Dev Notes-ban megadott pontos tartalommal.
  - [ ] Hozd létre a `docker/initdb/01-create-test-db.sql` fájlt egyetlen `CREATE DATABASE customer_distance_test;` utasítással — ez a hivatalos `postgres` image inicializációs mechanizmusa második logikai adatbázis létrehozására (a `POSTGRES_DB` env változó csak egyetlen adatbázist hoz létre alapból).
  - [ ] Indítsd el: `docker compose up -d`, várd meg amíg a healthcheck `healthy`-re vált (`docker compose ps`).
  - [ ] Ellenőrizd mindkét adatbázis létét: `docker compose exec postgres psql -U postgres -c "\l"` — a kimenetnek tartalmaznia kell `customer_distance` és `customer_distance_test` sorokat.
  - [ ] Ellenőrizd, hogy a konténer PostgreSQL 18-at futtat: `docker compose exec postgres psql -U postgres -c "SELECT version();"`.

- [ ] **Task 4 — `.env.example` és `.gitignore` javítás (AC: #6, #7)**
  - [ ] Hozd létre a `.env.example`-t a repo gyökerében a Dev Notes-ban megadott pontos tartalommal (`DATABASE_URL`, `TEST_DATABASE_URL`, `PORT`, a Docker Compose dev-credential-jeivel megegyező, nem-titkos alapértékekkel).
  - [ ] **Fontos, nem nyilvánvaló hiba-forrás:** a jelenlegi `.gitignore` `.env.*` mintája a `.env.example`-t is kizárná a git-ből. Egészítsd ki a `.gitignore`-t egy `!.env.example` negációs sorral közvetlenül a `.env.*` sor után, majd `git status`/`git add -n .env.example`-lel ellenőrizd, hogy a fájl valóban trackelhető.
  - [ ] Egészítsd ki a `.gitignore`-t a build/teszt-output bejegyzésekkel is: `dist/` (a `tsconfig.json` `outDir`-ja) és `coverage/` (jövőbeli teszt-coverage kimenet).

- [ ] **Task 5 — Végigfutási ellenőrzés és delivery (AC: #1–#7)**
  - [ ] Futtasd végig egy tiszta állapotból: `docker compose up -d` → mindkét DB létezik → `rm -rf node_modules && npm ci` → hibamentes → `package.json` typescript mező pontosan `6.0.2` → mind a 7 `src/` réteg-könyvtár létezik → `.env.example` létezik és git által trackelt (nem ignorált).
  - [ ] `docker compose down` (a volume megtartható a következő story-hoz, vagy `docker compose down -v` ha teljesen tiszta állapotot akarsz — mindkettő rendben van, dokumentáld melyiket futtattad).
  - [ ] Delivery norma (NFR7, PRD §2 Evaluation Context): a változtatásokat több kicsi, fókuszált commitra bontsd, ne egyetlen mindent-összefogó commitra — pl. külön commit a `.gitignore`+könyvtár-vázra, külön a Docker Compose-ra, külön a `package.json`/`tsconfig.json`-ra, külön a `.env.example`-ra. Ne committolj valódi titkot (ez a story tudatosan csak nem-titkos, lokális dev-credentialokat használ).

## Dev Notes

- **Ez az Epic 1 első story-ja — nincs korábbi story-intelligencia.** A repo jelenleg gyakorlatilag üres (`seed-customers.json`, `.gitignore`, `README.md` stub, üres `docs/`); a `_bmad`, `_bmad-output`, `.claude` könyvtárak BMAD-tooling, NEM az alkalmazás része, ne nyúlj hozzájuk.
- **`[ASSUMPTION]`** Az Architecture Spine nem nevez meg starter/scaffolding CLI-t (`create-*`) — ez a story manuális `npm init` + kézzel írt `tsconfig.json` + kézzel létrehozott könyvtárváz útján inicializál, nem generátorral. [Source: epics.md#Requirements Inventory — "No starter/scaffolding template is named..."]
- **`[ASSUMPTION]`** Modulrendszer: ESM (`"type": "module"` a `package.json`-ban, `"module": "NodeNext"` a `tsconfig.json`-ban). Az Architecture Spine nem rögzíti explicit a modulrendszert; Node 24 és Express 5 egyaránt támogatja az ESM-et natívan, és a TypeScript 6.0 alapértelmezett irányzata (ES2022+ modul, bundler/NodeNext resolution) is ez felé mutat. Ezt a döntést itt kell rögzíteni, hogy a későbbi story-k (routes/services/repositories importjai) ne térjenek el egymástól CJS/ESM keveredéssel.
- **Scope-határ — mit NEM fed le ez a story** (ne nyúlj bele, más story-k feladata): a migráció és a `customers` tábla (1.2), `env.ts`/`pool.ts` implementáció (1.4), bármilyen route/service/repository kód, az MCP konfiguráció (`.mcp.json`, 1.5), a `seed-customers.json` betöltése. Ez a story kizárólag a repo/tooling-vázra, a Docker Compose-ra, a könyvtárvázra és a `.env.example`-ra korlátozódik.
- **AD-1 (rétegzés)** — a `src/` alatti könyvtárak a routes → services → repositories egyirányú függőségi láncot tükrözik; ez a story csak a vázat hozza létre, a réteg-logikát nem. [Source: ARCHITECTURE-SPINE.md#AD-1]
- **AD-9 (config fail-fast; teszt-DB izoláció)** — a topológia: **egy** `postgres:18` Docker Compose service, **két** logikai adatbázissal (`customer_distance` dev, `customer_distance_test` teszt), ugyanazon instance-en, nem két külön konténer. Ez a story csak a Docker Compose topológiát és az `.env.example` dokumentációt hozza létre; az `env.ts` fail-fast validációs logikája a 1.4 story-ban készül el. [Source: ARCHITECTURE-SPINE.md#AD-9]
- **AD-10 (ne over-engineeringelj)** — ne telepíts ebben a story-ban olyan függőséget (Express, `pg`, `node-pg-migrate`, Vitest), amelyet ez a story ténylegesen nem használ; ezeket a bevezető story-juk telepíti (1.2: `node-pg-migrate`; 1.4: `pg`; 2.1: Vitest; 2.2: Express). Csak a `typescript` (AC #3) és a hozzá tartozó `@types/node` kerül telepítésre itt. [Source: ARCHITECTURE-SPINE.md#AD-10]
- **Docker multi-db mechanizmus:** a hivatalos `postgres` image `POSTGRES_DB` env változója csak **egyetlen** adatbázist hoz létre indításkor. A második logikai adatbázis (`customer_distance_test`) létrehozásának bevett módja egy inicializációs script mountolása a `/docker-entrypoint-initdb.d/` könyvtárba — ez a script (SQL vagy shell) csak **üres** data-directory mellett fut le (első indításkor). Ez a story egy egyszerű `CREATE DATABASE customer_distance_test;` SQL scriptet használ erre a célra, a `docker/initdb/` könyvtárban, read-only mountolva. Ha a compose volume-ot már inicializálták (pl. újrafuttatás régi volume-mal), az init script NEM fut le újra — ilyenkor `docker compose down -v` (volume törlés) szükséges, majd újra `up -d`.
- **PostgreSQL 18 image útvonal-váltás:** a `postgres:18` image-ben a `PGDATA` alapértelmezett útvonala verzió-specifikussá vált (`/var/lib/postgresql/18/docker`), és a deklarált `VOLUME` is `/var/lib/postgresql`-re változott (a korábbi `/var/lib/postgresql/data` helyett). A `docker-compose.yml`-ben a named volume-ot `/var/lib/postgresql`-re mountold, NE `/var/lib/postgresql/data`-ra — egy régebbi PG16/17 példa változtatás nélküli másolása itt hibás konténerindítást okozna.
- **`.gitignore` csapda:** a repóban már létező `.gitignore` `.env.*` mintája alapból kizárná a `.env.example`-t is a verziókezelésből. Ezt Task 4 explicit javítja egy `!.env.example` negációs sorral.

### `docker-compose.yml` — pontos tartalom

```yaml
services:
  postgres:
    image: postgres:18
    container_name: customer-distance-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: customer_distance
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql
      - ./docker/initdb:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d customer_distance"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  pgdata:
```

### `docker/initdb/01-create-test-db.sql` — pontos tartalom

```sql
CREATE DATABASE customer_distance_test;
```

### `.env.example` — pontos tartalom

```
# Postgres connection for the app (customer_distance DB).
# Local Docker Compose dev credentials only — not a real secret.
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/customer_distance

# Postgres connection used ONLY by integration tests (customer_distance_test DB).
# Integration tests must fail-stop if this is unset — never fall back to DATABASE_URL (AD-9).
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/customer_distance_test

# HTTP port the server listens on. Optional — a default is documented where PORT is
# consumed (src/config/env.ts, Story 1.4/2.2).
PORT=3000
```

### `tsconfig.json` — pontos tartalom

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### `.gitignore` — a meglévő fájlhoz hozzáadandó sorok

A meglévő `.gitignore` (`node_modules/`, `.env`, `.env.*`, `.DS_Store`, `.claude/settings.local.json`) megtartandó; az alábbiakkal egészítendő ki:

```
# Environment variable examples must stay tracked
!.env.example

# Build output
dist/

# Test coverage output
coverage/
```

A `!.env.example` sort a meglévő `.env.*` sor UTÁN kell felvenni (a git a negációs mintákat a fájlban elfoglalt sorrend szerint, később felülbírálva alkalmazza).

### Project Structure Notes

- Alignment: a `src/config`, `src/db`, `src/geocoding`, `src/repositories`, `src/services`, `src/routes`, `src/middleware` könyvtárak pontosan megfelelnek az `ARCHITECTURE-SPINE.md` Structural Seed táblázatának. [Source: ARCHITECTURE-SPINE.md#Structural Seed]
- Variance (dokumentált, indokolt eltérés): a `docker/initdb/` könyvtár NEM szerepel explicit az Architecture Spine Structural Seed fájlfájában — ez egy szükséges, alacsony kockázatú kiegészítés, amit a hivatalos `postgres` image második-adatbázis-létrehozási mechanizmusa (AD-9 két logikai DB követelménye) kényszerít ki. Nem befolyásolja az alkalmazás réteg-határait.
- Variance: `src/app.ts`, `src/server.ts`, `src/seed.ts`, `src/config/env.ts`, `src/db/pool.ts` szándékosan NEM jönnek létre ebben a story-ban (ld. Task 1 tiltása és a Scope-határ szakasz fent) — ezek a Structural Seed-ben szerepelnek, de a tartalmukat hozó story-k (1.4, 2.2) fogják létrehozni a fájlokat is, elkerülve az üres stub → felülírás mintát.
- A `migrations/`, `test/unit/`, `test/integration/` könyvtárak üresen (`.gitkeep`-pel) jönnek létre — tartalmukat az 1.2 (migráció), 2.1 (unit teszt), 2.4 (integrációs teszt) story-k töltik fel.

### References

- [Source: epics.md#Story 1.1: Projekt-scaffold és lokális Postgres Docker Compose-zal] — a story pontos Given/When/Then AC-jei
- [Source: epics.md#Epic 1: Reproducible Local Data Foundation] — epic-szintű kontextus, FR/NFR/AD lefedettség
- [Source: epics.md#Requirements Inventory — Additional Requirements] — "No starter/scaffolding template is named..." `[ASSUMPTION]`, Stack pontos verziók
- [Source: ARCHITECTURE-SPINE.md#Stack] — Node.js 24, TypeScript 6.0.2 exact pin, PostgreSQL 18 (`postgres:18`)
- [Source: ARCHITECTURE-SPINE.md#Structural Seed] — teljes forrásfa-váz és a `docker-compose.yml` PG18 PGDATA-útvonal megjegyzése
- [Source: ARCHITECTURE-SPINE.md#AD-1 — Layering and dependency direction]
- [Source: ARCHITECTURE-SPINE.md#AD-9 — Config fail-fast; test-DB isolation] — két logikai DB topológia, `DATABASE_URL`/`TEST_DATABASE_URL`/`PORT`
- [Source: ARCHITECTURE-SPINE.md#AD-10 — No DI framework, ORM, or complex domain layer]
- [Source: prd.md#FR-12: Reprodukálható lokális Postgres indítás] — Docker Compose mint hivatalos indítási mechanizmus
- [Source: prd.md#2. Evaluation Context] — delivery norma: kis, fókuszált commitok (NFR7)
- [Source: addendum.md#Paraméterezett adatbázis-lekérdezések] — háttér-kontextus a későbbi DB-réteghez (nem e story hatóköre)
- Docker Hub, official `postgres` image page (`hub.docker.com/_/postgres`) — `PGDATA`/`VOLUME` verzió-specifikus útvonal PG18-tól (`/var/lib/postgresql/18/docker`, `VOLUME /var/lib/postgresql`); megerősítve a `docker-library/postgres` GitHub repo #1259 PR-jével ("Change `PGDATA` in 18+ to `/var/lib/postgresql/MAJOR/docker`")
- `github/gitignore` — `Node.gitignore` referencia-template (node_modules, build output, `.env`/`.env.*` `!.env.example` kivétellel)
- Multi-DB minta a hivatalos `postgres` image-hez: `/docker-entrypoint-initdb.d/` inicializációs script (SQL/shell), csak üres data-directory mellett fut le első indításkor — közösségi minta (pl. `mrts/docker-postgresql-multiple-databases`), itt egyszerű `CREATE DATABASE` SQL-lel megvalósítva a `POSTGRES_MULTIPLE_DATABASES` bash-wrapper helyett (kevesebb mozgó alkatrész két DB esetén)
- TypeScript 6.0 modul-alapértelmezések (ES2022+ modul, bundler/NodeNext resolution, evergreen runtime feltételezés) — a jelen story ESM `[ASSUMPTION]`-jének háttér-indoklása

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
