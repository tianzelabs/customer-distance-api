---
baseline_commit: 6e795717ed714db84e6c41f1ed68ec73a232fe67
---

# Story 1.1: Projekt-scaffold és lokális Postgres Docker Compose-zal

Status: done

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

- [x] **Task 1 — Projekt forrásfa-váz létrehozása (AC: #5)**
  - [x] Hozd létre az alábbi könyvtárakat a repo gyökeréből: `src/config`, `src/db`, `src/geocoding`, `src/repositories`, `src/services`, `src/routes`, `src/middleware`.
  - [x] Hozd létre a `migrations/`, `test/unit/`, `test/integration/` könyvtárakat is (ezek szintén szerepelnek a Structural Seed-ben; tartalmukat a 1.2, 2.1, 2.4 story-k töltik fel — itt csak a váz jön létre).
  - [x] Mivel git nem követ üres könyvtárakat, tegyél egy üres `.gitkeep` fájlt minden fenti könyvtárba, hogy azok committolhatók legyenek üresen.
  - [x] **NE** hozz létre `src/app.ts`-t, `src/server.ts`-t, `src/seed.ts`-t, `src/config/env.ts`-t vagy `src/db/pool.ts`-t ebben a story-ban — ezek tartalmát a 1.4 (seed.ts, env.ts, pool.ts) és a 2.2 (app.ts, server.ts) story hozza létre. Az AC #5 kizárólag a 7 réteg-könyvtárat követeli meg, nem ezeket a fájlokat; placeholder stub fájlok létrehozása felesleges duplikációs/felülírási kockázatot jelentene a későbbi story-kban (AD-10 — ne over-engineeringelj).
  - [x] **NE** hozz létre semmilyen migrációs fájlt a `migrations/`-ben — az a 1.2 story feladata.

- [x] **Task 2 — Node/TypeScript projekt inicializálása pontos `typescript` pinneléssel (AC: #3, #4)**
  - [x] `npm init -y` a repo gyökerében, majd szerkeszd a generált `package.json`-t: `"name": "customer-distance-api"`, `"private": true`, `"type": "module"` (ld. Dev Notes — ESM döntés), `"engines": { "node": ">=24" }`.
  - [x] `npm install --save-dev --save-exact typescript@6.0.2` — a `--save-exact` biztosítja, hogy a `package.json`-ban `"typescript": "6.0.2"` szerepeljen `^`/`~` nélkül. Ellenőrizd a `package.json`-t utána: a `typescript` bejegyzésnek pontosan `"6.0.2"`-nek kell lennie.
  - [x] `npm install --save-dev @types/node@24` (a Node 24 típusdefiníciói; nem igényel pontos pinnelést, csak a `typescript`/`node-pg-migrate` igényel az Architecture Spine Stack táblája szerint).
  - [x] Hozz létre egy `tsconfig.json`-t a repo gyökerében (lásd Dev Notes — pontos tartalom).
  - [x] Adj hozzá egy minimális `"scripts": { "build": "tsc" }` bejegyzést a `package.json`-hoz. Ne adj hozzá más npm scriptet (pl. `dev`, `test`, `migrate`, `seed`) — ezek pontos elnevezése az Architecture Spine szerint deferred, a döntést az adott funkciót bevezető story hozza (1.2, 1.4, 2.x).
  - [x] Committold a `package-lock.json`-t.
  - [x] Ellenőrizd a reprodukálhatóságot: `rm -rf node_modules && npm ci` — hibamentesen kell lefutnia, és a `node_modules/typescript/package.json`-ban a verziónak `6.0.2`-nek kell lennie.
  - [x] Megjegyzés: mivel ez a story még nem hoz létre egyetlen `.ts` forrásfájlt sem a `src/`-ben, az `npm run build` ebben a fázisban "No inputs were found" hibát fog jelezni — ez ELVÁRT és nem hiba; ne próbáld ezt üres/placeholder `.ts` fájlok hozzáadásával elkerülni (ld. Task 1 tiltása).

  **Megjegyzés a helyi környezetről:** a fejlesztői gépen Node v23.5.0 fut (nem 24) — az `npm install` ezért `EBADENGINE` warningot ad, ami elvárt és nem hiba (a `package.json` `engines` mezője dokumentációs célú megkötés, nem blokkol telepítést). A CI/deployment környezetnek Node 24-et kell használnia.

- [x] **Task 3 — Docker Compose: `postgres:18`, két logikai adatbázissal (AC: #1, #2)**
  - [x] Hozd létre a `docker-compose.yml`-t a repo gyökerében a Dev Notes-ban megadott pontos tartalommal.
  - [x] Hozd létre a `docker/initdb/01-create-test-db.sql` fájlt egyetlen `CREATE DATABASE customer_distance_test;` utasítással — ez a hivatalos `postgres` image inicializációs mechanizmusa második logikai adatbázis létrehozására (a `POSTGRES_DB` env változó csak egyetlen adatbázist hoz létre alapból).
  - [x] Indítsd el: `docker compose up -d`, várd meg amíg a healthcheck `healthy`-re vált (`docker compose ps`).
  - [x] Ellenőrizd mindkét adatbázis létét: `docker compose exec postgres psql -U postgres -c "\l"` — a kimenetnek tartalmaznia kell `customer_distance` és `customer_distance_test` sorokat.
  - [x] Ellenőrizd, hogy a konténer PostgreSQL 18-at futtat: `docker compose exec postgres psql -U postgres -c "SELECT version();"`.

  **Végrehajtás közben felmerült, nem-blokkoló környezeti ütközés:** a fejlesztői gépen már fut egy másik, ehhez a projekthez nem tartozó Postgres konténer (`smartbasket-pg`, postgres:17) az 5432-es host-porton. Ez nem AC-, sem architektúra-szintű probléma, csak lokális port-ütközés — a fix a host port 5433-ra állítása a `docker-compose.yml`-ben és az `.env.example`-ben (a konténeren belüli port marad 5432, csak a host-oldali mapping változott). Lásd a lenti pontos fájltartalmakat és Dev Notes.

- [x] **Task 4 — `.env.example` és `.gitignore` javítás (AC: #6, #7)**
  - [x] Hozd létre a `.env.example`-t a repo gyökerében a Dev Notes-ban megadott pontos tartalommal (`DATABASE_URL`, `TEST_DATABASE_URL`, `PORT`, a Docker Compose dev-credential-jeivel megegyező, nem-titkos alapértékekkel).
  - [x] **Fontos, nem nyilvánvaló hiba-forrás:** a jelenlegi `.gitignore` `.env.*` mintája a `.env.example`-t is kizárná a git-ből. Egészítsd ki a `.gitignore`-t egy `!.env.example` negációs sorral közvetlenül a `.env.*` sor után, majd `git status`/`git add -n .env.example`-lel ellenőrizd, hogy a fájl valóban trackelhető.
  - [x] Egészítsd ki a `.gitignore`-t a build/teszt-output bejegyzésekkel is: `dist/` (a `tsconfig.json` `outDir`-ja) és `coverage/` (jövőbeli teszt-coverage kimenet).

- [x] **Task 5 — Végigfutási ellenőrzés és delivery (AC: #1–#7)**
  - [x] Futtasd végig egy tiszta állapotból: `docker compose up -d` → mindkét DB létezik → `rm -rf node_modules && npm ci` → hibamentes → `package.json` typescript mező pontosan `6.0.2` → mind a 7 `src/` réteg-könyvtár létezik → `.env.example` létezik és git által trackelt (nem ignorált). **Mindegyik ellenőrzés sikeres volt.**
  - [x] `docker compose down` (volume megtartva a `pgdata` named volume-ban a következő story-hoz — nem futtattam `-v`-t).
  - [x] Delivery norma (NFR7, PRD §2 Evaluation Context): a változtatások 5 kicsi, fókuszált commitra lettek bontva (forrásfa-váz; Node/TS init; Docker Compose; .env.example+.gitignore; ez a lezáró story-frissítés), nem egyetlen mindent-összefogó commitban. Nincs valódi titok committolva.

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
- **Host port 5433 (nem az alapértelmezett 5432):** a fejlesztői gépen egy másik, ehhez a projekthez nem tartozó Postgres konténer már foglalja az 5432-es host-portot. A `docker-compose.yml` és az `.env.example` ezért az 5433 host-portot mappeli a konténer belső 5432-es portjára (`"5433:5432"`) — ez tisztán lokális, a repóra korlátozott, reverzibilis megoldás, nem érinti a másik konténert.

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
      - "5433:5432"
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
# Host port 5433 (not the Postgres default 5432) to avoid clashing with
# any other local Postgres instance already using 5432 on your machine.
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/customer_distance

# Postgres connection used ONLY by integration tests (customer_distance_test DB).
# Integration tests must fail-stop if this is unset — never fall back to DATABASE_URL (AD-9).
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/customer_distance_test

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

claude-sonnet-5 (Claude Code, bmad-dev-story workflow, autonomous mode)

### Debug Log References

- Port conflict on `docker compose up -d`: host port 5432 already bound by an unrelated container (`smartbasket-pg`, postgres:17, different project). Resolved by remapping to host port `5433:5432` in `docker-compose.yml` and `.env.example` — purely local, reversible, does not affect the other container. See Dev Notes and Task 3.
- Local Node runtime is v23.5.0, not the `>=24` declared in `package.json` `engines` — `npm install`/`npm ci` emit an `EBADENGINE` warning (not an error) each time; expected per Task 2 notes, not fixed (CI/deployment should use Node 24).

### Completion Notes List

- All 7 ACs verified end-to-end from a clean state (`docker compose up -d`, `npm ci`, directory check, `.env.example` git-tracked check) in Task 5 — all passed.
- No `.ts` source files created (correct per Task 1/AD-10 — later stories 1.2/1.4/2.x own that code); `npm run build` will report "No inputs were found" until then, which is expected.
- No application dependencies installed beyond `typescript`/`@types/node` (AD-10 — each later story installs what it needs: `pg` in 1.4, `node-pg-migrate` in 1.2, Express in 2.2, Vitest in 2.1).
- Postgres container stopped (`docker compose down`, volume preserved) at the end of the story since no further story is being implemented in this session; `docker compose up -d` will resume with the same data via the `pgdata` named volume.

### File List

**New:**
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `docker-compose.yml`
- `docker/initdb/01-create-test-db.sql`
- `.env.example`
- `src/config/.gitkeep`
- `src/db/.gitkeep`
- `src/geocoding/.gitkeep`
- `src/repositories/.gitkeep`
- `src/services/.gitkeep`
- `src/routes/.gitkeep`
- `src/middleware/.gitkeep`
- `migrations/.gitkeep`
- `test/unit/.gitkeep`
- `test/integration/.gitkeep`

**Modified:**
- `.gitignore` (added `!.env.example` negation, `dist/`, `coverage/`)

### Change Log

- 2026-07-18: Story 1.1 implemented end-to-end (Tasks 1–5), all 7 ACs verified, status set to `review`.
- 2026-07-18: Code review (bmad-code-review, 3 parallel layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor) — 5 patches applied, 3 deferred, 9 dismissed. Status set to `done`.

### Review Findings

- [x] [Review][Patch] Healthcheck doesn't verify `customer_distance_test` exists, only `customer_distance` [docker-compose.yml:16] — fixed, healthcheck now probes both databases.
- [x] [Review][Patch] `docker/initdb/*.sql` only runs on first container start against an empty volume; this caveat wasn't documented in any committed file (only in this story doc) [docker/initdb/01-create-test-db.sql, docker-compose.yml] — fixed, added comments in both files.
- [x] [Review][Patch] Hardcoded `container_name: customer-distance-postgres` collides if this repo is checked out twice (e.g. comparing branches, or running the Superpowers vs. BMAD variants of this same homework side by side — the project's own stated purpose) [docker-compose.yml:4] — fixed, removed `container_name` so Compose scopes it per project directory.
- [x] [Review][Patch] Postgres port bound to all interfaces (`5433:5432`) with default `postgres:postgres` credentials, reachable from the local network [docker-compose.yml:11] — fixed, bound to `127.0.0.1:5433:5432`.
- [x] [Review][Patch] `.gitignore`'s `!.env.example` negation is order-dependent (must follow `.env.*`) but that constraint wasn't documented in the file itself [.gitignore] — fixed, added a comment.
- [x] [Review][Defer] `engines.node >=24` is declared but unenforced (no `.nvmrc`/`engine-strict`) — deferred, reason: enforcing it now would hard-fail every npm command in the current dev environment (Node v23.5.0); revisit when the dev environment is upgraded or in CI.
- [x] [Review][Defer] Host port 5433 is hardcoded with no override mechanism if it also conflicts on some machine — deferred, reason: low severity/nice-to-have, hardcoding is acceptable at this scale (AD-10), revisit only if it actually causes friction.
- [x] [Review][Defer] `NodeNext` + `"type": "module"` requires explicit `.js` extensions on relative TS imports — deferred, reason: no `.ts` source exists yet in this story to violate it; carry forward as a note into Story 1.2's Dev Notes.

**Dismissed (9, with reasoning — not written to `{deferred_work_file}` since these are not real pre-existing issues, just findings resolved by full-repo context the reviewing subagents lacked):**
- `postgres:18` floating major tag — matches the ratified `ARCHITECTURE-SPINE.md` Stack decision (not patch-pinned by design), not a story-level defect.
- `restart: unless-stopped` / no teardown doc in repo — teardown documentation is Story 3.1's explicit scope (README).
- `.env.example`'s "Story 1.4/2.2" comment references internal-only artifacts — false premise: `_bmad-output/` (including this story file) is committed to this same repo, so the reference resolves for anyone who clones it.
- No lint/format/test script or CI — CI is explicitly deferred at the architecture level (`ARCHITECTURE-SPINE.md` Deferred section); verification method matches this story's own AC/Task 5 exactly.
- `license: "ISC"` npm-init default — trivial, `"private": true` already set, no publish concern.
- Single shared `postgres` superuser for dev+test DB — matches the ratified AD-9 topology; role separation is production-grade hardening explicitly out of PRD scope.
- `package-lock.json` integrity "taken on faith" — verified in this session: generated by a real `npm install`/`npm ci` against the real npm registry, not hand-authored.
- TypeScript 6.0.2 / `@types/node` pins "not sanity-checked as resolvable" — verified in this session: installed successfully, `node_modules/typescript` reports `6.0.2`.
- Empty `.gitkeep` directories give "false structural confidence" with no automated layering enforcement — matches the explicit AD-10 scope boundary (no stub files, no over-engineering); no spec requirement calls for automated enforcement.
- (Acceptance Auditor) "`package-lock.json` missing from diff" — self-resolved: artifact of how the diff excerpt was assembled for review, not a real gap (file is committed, confirmed via `git show`).
