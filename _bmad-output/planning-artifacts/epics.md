---
stepsCompleted: ["step-01", "step-02", "step-03", "step-04"]
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-customer-distance-api-2026-07-17/prd.md"
  - "_bmad-output/planning-artifacts/prds/prd-customer-distance-api-2026-07-17/addendum.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-customer-distance-api-2026-07-18/ARCHITECTURE-SPINE.md"
---

# customer-distance-api - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for customer-distance-api, decomposing the requirements from the PRD and Architecture Spine into implementable stories. No UX design document exists (backend-only API, no UI) — the UX Design Requirements section is not applicable.

Run in Fast path (autonomous mode) per explicit user instruction: drafted directly from prd.md + addendum.md + ARCHITECTURE-SPINE.md without an interactive per-epic elicitation round. `[ASSUMPTION]` tags mark inferred sequencing/sizing calls.

## Requirements Inventory

### Functional Requirements

FR1: The system has a `customers` table created via a versioned, rollback-capable migration (id, name, telepules, lat, lon nullable, budget/note/countryCode optional, UNIQUE(name, telepules), lat/lon range + paired-nullity CHECK constraints).
FR2: The system idempotently loads seed-customers.json into `customers` — re-running never duplicates rows (upsert on the natural key name+telepules).
FR3: The system assigns lat/lon to each customer's telepules from a local, offline, repo-bundled town→coordinate reference at seed time only; no runtime re-geocoding.
FR4: Town-name matching against the reference is diacritic-, case-, and whitespace-insensitive.
FR5: An unmatched telepules gets lat/lon = null, a warning log, and does not halt the seed process.
FR6: GET /customers/count returns `{"count": <integer>}` from a real DB query (not hardcoded, not seed-file length).
FR7: GET /customers/by-distance returns customers sorted by ascending Budapest distance; each element carries distanceKm (1 decimal, or null); Budapest customers show 0.0; null-distance customers sort last; ties broken by name ascending.
FR8: distanceKm is computed via the Haversine formula against a fixed Budapest reference coordinate.
FR9: Haversine unit tests cover Budapest–Vienna (~214km ±1km), Budapest–Budapest (0km), and null-coordinate handling.
FR10: Dedicated normalization/edge-case tests cover diacritic/case/whitespace variants, unknown town, null coordinate, and (if implemented) Budapest-district folding.
FR11: Integration tests exercise both endpoints against a real (non-mocked) Postgres, covering the 0km case, tie-break, and unknown-town-at-end case.
FR12: A single documented command (Docker Compose) starts the required local Postgres instance reproducibly.
FR13: A PostgreSQL MCP configuration lets a developer inspect the `customers` schema and spot-check seeded rows during development.
FR14: A README documents Postgres startup, migration, seed, server start, and test execution end-to-end.

### NonFunctional Requirements

NFR1: Offline-only — no external geocoding API or runtime LLM call anywhere in the system (PRD §1, §6; Evaluation Context reproducibility requirement).
NFR2: No authentication/authorization — local, developer/evaluator-only API (PRD §6).
NFR3: Read-only API surface — only the two GET endpoints exist; the seed process is the sole writer to `customers` (PRD §6; AD-1).
NFR4: Every DB operation carrying a dynamic value must use parameterized queries; string concatenation of values into SQL is forbidden (addendum.md; AD-2) — SQL-injection protection, concretely motivated by the apostrophe in seed customer "Niamh O'Brien".
NFR5: A centralized error-handling layer returns a fixed `{"error":{"message":"Internal server error"}}` / HTTP 500 shape on unexpected/DB errors and never leaks raw SQL errors, connection strings, stack traces, or secrets to the client (AD-8).
NFR6: Configuration is read from environment variables in one place and fails fast with a clear message on missing/invalid values; no hardcoded passwords (AD-9).
NFR7: Delivery is via small, focused, traceable commits — no single all-encompassing final commit (PRD §2 Evaluation Context delivery norm).
NFR8: The full stack (Postgres → migration → seed → server → tests) must be reproducible via the README on a clean machine given Node.js, Docker, and npm (PRD SM-2).

### Additional Requirements (from Architecture Spine)

- Stack (pinned, web-verified): Node.js 24 (Active LTS); TypeScript 6.0.2 exact pin (`npm ci`); Express 5.2.1; pg (node-postgres) 8.22.0 via `Pool`, no ORM/query-builder; node-pg-migrate 8.0.4 exact pin; Vitest 4.1.x; PostgreSQL 18 (`postgres:18` Docker image) via Docker Compose.
- `[ASSUMPTION]` No starter/scaffolding template is named in the Architecture Spine — Epic 1 / Story 1 must include manual project initialization (package.json, tsconfig, directory skeleton per Structural Seed) rather than a `create-*` CLI.
- Paradigm (AD-1): light layered architecture — routes → services → repositories → PostgreSQL, one-way dependency direction; seed is a standalone entrypoint reusing repositories + geocoding, bypassing HTTP/service layers.
- AD-3: exactly one shared `pg` `Pool` module (`src/db/pool.ts`); all DB access goes through it.
- AD-4: `src/app.ts` (unbound Express app) is separated from `src/server.ts` (`.listen()`), so integration tests can import the app directly.
- AD-5: seed upsert is `ON CONFLICT (name, telepules) DO UPDATE SET ...` (refreshes on re-seed, never `DO NOTHING`).
- AD-6: the Haversine function is pure (no DB/HTTP dependency), enabling isolated unit tests.
- AD-7: the initial migration must create `customers` with `UNIQUE(name, telepules)` and the two lat/lon CHECK constraints exactly as specified; migration files use `node-pg-migrate`'s default timestamped naming.
- AD-9: Docker Compose runs one `postgres:18` instance hosting two logical databases — `customer_distance` (`DATABASE_URL`) and `customer_distance_test` (`TEST_DATABASE_URL`); integration tests must fail-stop (never fall back to `DATABASE_URL`) if `TEST_DATABASE_URL` is unset.
- AD-10: no DI framework/container, no ORM, no domain layer beyond the plain service/repository split — do not over-engineer.
- AD-11: `.mcp.json` at repo root configures the Postgres MCP server via an environment variable, no committed secret; README documents its use.
- AD-12: all town-name matching goes through exactly one pure function, `normalizeTown()`.
- AD-13: exactly one exported `BUDAPEST_REF` constant, defined in `townReference.ts`, imported wherever needed (no second copy).
- AD-14: the `Customer` TS type is defined exactly once (in the repository module) and imported everywhere else.
- Response-shape convention: `budget`/`note`/`countryCode` keys are omitted from `by-distance` elements when the underlying column is NULL (never emitted as explicit `null`); `id` and `COUNT(*)` are coerced from `pg`'s string representation to `number`.
- Sort convention: non-null distanceKm ascending → name ascending → id ascending (full tiebreak, for by-distance); null-distanceKm group last, same tiebreak within it.
- Logging convention: `console.warn`/`console.error` only, with `[seed]`/`[api]`/`[database]` prefixes; never log a password or full connection string.

### UX Design Requirements

Not applicable — no UI, no UX design document exists for this backend-only API.

### FR Coverage Map

FR1: Epic 1 - customers table + migration
FR2: Epic 1 - idempotent seed load
FR3: Epic 1 - offline town→coordinate assignment
FR4: Epic 1 - town-name normalization
FR5: Epic 1 - unknown-town handling
FR6: Epic 2 - GET /customers/count
FR7: Epic 2 - GET /customers/by-distance
FR8: Epic 2 - Haversine distance calculation
FR9: Epic 2 - Haversine unit tests
FR10: Epic 1 - normalization & edge-case tests
FR11: Epic 2 - endpoint integration tests vs. real Postgres
FR12: Epic 1 - reproducible local Postgres (Docker Compose)
FR13: Epic 1 - Postgres MCP dev-time schema/data check
FR14: Epic 3 - README end-to-end documentation

## Epic List

### Epic 1: Reproducible Local Data Foundation
A developer/evaluator can start a local Postgres via Docker Compose, run the versioned migration, and idempotently load the seed dataset with correct offline-geocoded coordinates — verifiable directly against the database (via the Postgres MCP or psql) without the query API existing yet.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR10, FR12, FR13

### Epic 2: Verifiable Customer Distance API
A client can call `GET /customers/count` and `GET /customers/by-distance` and receive correct, deterministically sorted, Haversine-computed distance data — covered end-to-end by unit and integration tests against a real database.
**FRs covered:** FR6, FR7, FR8, FR9, FR11

### Epic 3: End-to-End Reproducibility & Delivery Readiness
An evaluator on a clean machine (Node.js, Docker, npm present) can follow the README alone — with no other context — to stand up Postgres, migrate, seed, start the server, and run the full test suite, confirming the whole system behaves exactly as documented.
**FRs covered:** FR14

---

## Epic 1: Reproducible Local Data Foundation

Fejlesztő/kiértékelő lokálisan el tudja indítani a Postgres-t, le tudja futtatni a migrációt, és idempotensen be tudja tölteni a helyesen geokódolt seed-adatot — mindezt az API léte nélkül, közvetlenül adatbázis-szinten ellenőrizhetően.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR10, FR12, FR13
**NFRs:** NFR1 (offline), NFR4 (parameterizált SQL), NFR6 (config fail-fast)
**Architektúra:** AD-1 (rétegzés), AD-2 (parameterizált query), AD-3 (megosztott Pool), AD-5 (seed upsert szemantika), AD-7 (migráció), AD-9 (config/teszt-DB), AD-12 (normalizeTown), AD-13 (BUDAPEST_REF)

### Story 1.1: Projekt-scaffold és lokális Postgres Docker Compose-zal

Mint fejlesztő,
inicializált Node/TypeScript projektet és egy Docker Compose-szal indítható lokális Postgres-t szeretnék,
hogy legyen hova migrálni és seedelni.

**Acceptance Criteria:**

**Given** egy üres/kiinduló repo állapot
**When** a fejlesztő elindítja a `docker compose up -d` parancsot
**Then** egy `postgres:18` konténer fut, két logikai adatbázissal (`customer_distance`, `customer_distance_test`)
**And** a `package.json` a `typescript` csomagot pontosan `6.0.2`-re pinneli (`^`/`~` nélkül), telepítés `npm ci`-vel
**And** a projekt forrásfája megfelel az `ARCHITECTURE-SPINE.md` Structural Seed szakaszának (`src/config`, `src/db`, `src/geocoding`, `src/repositories`, `src/services`, `src/routes`, `src/middleware`)
**And** `DATABASE_URL`/`TEST_DATABASE_URL`/`PORT` egy `.env.example` fájlban dokumentált, valódi titok nélkül

### Story 1.2: `customers` tábla migráció

Mint fejlesztő,
egy verziózott migrációt szeretnék, ami létrehozza a `customers` táblát a helyes megszorításokkal,
hogy legyen hova betölteni a seed-adatot.

**Acceptance Criteria:**

**Given** egy futó Postgres instance és üres séma
**When** a fejlesztő lefuttatja a migrációt (`node-pg-migrate`, 8.0.4 pontos verzió)
**Then** létrejön a `customers` tábla `id BIGSERIAL PK, name, telepules, lat, lon, budget, note, country_code` oszlopokkal
**And** a tábla tartalmazza a `UNIQUE(name, telepules)` megszorítást
**And** a tábla tartalmazza a két `CHECK` megszorítást (lat -90..90 vagy null; lon -180..180 vagy null) és a lat/lon páros nullness CHECK-et
**And** a migrációs fájl `node-pg-migrate` alapértelmezett időbélyeg-alapú elnevezését használja
**When** a migrációt visszavonják (`down`)
**Then** a tábla és megszorításai eltűnnek hiba nélkül
**When** a migrációt kétszer futtatják egymás után `up`-pal
**Then** nem keletkezik hiba vagy duplikált sémaelem

### Story 1.3: Offline település-koordináta referencia és `normalizeTown()`

Mint fejlesztő,
egy lokális település→koordináta referenciát és egy központi normalizáló függvényt szeretnék,
hogy a seed offline, ékezet-/kis-nagybetű-/whitespace-független módon tudjon geokódolni.

**Acceptance Criteria:**

**Given** a 15 seed-városnak megfelelő lokális `townReference.ts` és egy exportált `BUDAPEST_REF` konstans
**When** a `normalizeTown()` függvényt azonos településre eltérő írásmóddal hívják (pl. `"Kraków"` és `"krakow"`, vezető/záró whitespace-szel, vegyes kis-nagybetűvel)
**Then** mindegyik ugyanarra a normalizált kulcsra képződik le
**When** a `normalizeTown()` egy nem létező települést kap
**Then** nem talál egyezést a referenciában (a hívó felelőssége a null lat/lon beállítása)
**And** unit tesztek fedik: ékezet/kis-nagybetű/whitespace variánsok, Kraków↔krakow eset, ismeretlen település nem-egyezése
**And** ha a Budapest kerület-normalizálás (pl. `"Budapest XIII."`) implementálásra kerül, az is a `BUDAPEST_REF`-re képződik le, dedikált teszttel

### Story 1.4: Idempotens seed script

Mint fejlesztő,
a `seed-customers.json`-t idempotensen szeretném betölteni a `customers` táblába geokódolt koordinátákkal,
hogy reprodukálható induló adatom legyen.

**Acceptance Criteria:**

**Given** ez a story hozza létre a `src/config/env.ts`-t (minimálisan `DATABASE_URL`-t olvasva és validálva, fail-fast hibaüzenettel hiányzó/érvénytelen érték esetén) és a `src/db/pool.ts`-t (az egyetlen megosztott `pg` `Pool` modul, ami az `env.ts`-ből olvassa a kapcsolatot) — ezeket a 2.2 story bővíti tovább (`TEST_DATABASE_URL`, `PORT`), nem hozza létre újra
**Given** egy futó, migrált Postgres és a `seed-customers.json` forrásfájl
**When** a fejlesztő lefuttatja a seed scriptet (`src/seed.ts`, a megosztott `src/db/pool.ts` Pool-on keresztül)
**Then** mind a 15 ügyfél bekerül a `customers` táblába, `normalizeTown()`+`townReference.ts` alapján geokódolva
**And** minden beszúrás/upsert paraméterezett lekérdezésen keresztül történik (nincs string-konkatenáció)
**When** a seed scriptet másodszor is lefuttatják
**Then** a `customers` táblában nem keletkezik duplikátum (upsert `ON CONFLICT (name, telepules) DO UPDATE`)
**Given** egy dedikált teszt-fixture, amely egy ismeretlen települést tartalmaz (nem a valódi 15 seed-városok egyike)
**When** a seed script feldolgozza ezt a rekordot
**Then** a rekord `lat`/`lon` értéke `null` lesz, egy `[seed] Unknown town: "..."` figyelmeztető log íródik, és a folyamat a többi rekordot változatlanul feldolgozva sikeresen befejeződik

### Story 1.5: PostgreSQL MCP séma- és adatellenőrzés

Mint kiértékelő,
MCP-n keresztül szeretném ellenőrizni a `customers` séma és a seedelt adatok helyességét,
hogy fejlesztés közben kód írása nélkül tudjam validálni az adatréteget.

**Acceptance Criteria:**

**Given** egy futó, migrált és seedelt lokális Postgres
**When** a fejlesztő megnyitja a repo gyökerében lévő `.mcp.json`-t
**Then** a hivatalos `@modelcontextprotocol/server-postgres` csomag van konfigurálva Postgres MCP szerverként (read-only kényszerítéssel tranzakció-szinten), amely a kapcsolatot egy környezeti változóból (`DATABASE_URL`) kapja, nem hardcode-olt connection stringből vagy titokból
**When** a kiértékelő az MCP-n keresztül lekérdezi a sémát
**Then** látja a `customers` tábla oszlopait és megszorításait
**When** a kiértékelő az MCP-n keresztül lekérdez néhány sort
**Then** ellenőrizni tudja legalább a `name`/`telepules`/`lat`/`lon` értékeket
**And** a README dokumentálja ennek a séma-/adatellenőrzésnek a pontos lépéseit

---

## Epic 2: Verifiable Customer Distance API

Egy kliens lekérdezheti a `GET /customers/count` és `GET /customers/by-distance` végpontokat, és helyes, determinisztikusan rendezett, Haversine-alapú távolságadatot kap — unit és integrációs tesztekkel valódi adatbázis ellen igazolva.

**FRs covered:** FR6, FR7, FR8, FR9, FR11
**NFRs:** NFR3 (read-only), NFR5 (hibakezelés)
**Architektúra:** AD-1, AD-4 (app/server szétválasztás), AD-6 (tiszta Haversine), AD-8 (központi hibakezelés), AD-9 (teszt-DB), AD-14 (egyetlen Customer típus)

### Story 2.1: Tiszta Haversine-függvény unit tesztekkel

Mint fejlesztő,
egy tiszta Haversine-függvényt szeretnék a Budapest referenciakoordinátával,
hogy a távolságszámítás helyessége az API-tól függetlenül garantált legyen.

**Acceptance Criteria:**

**Given** a `src/services/haversine.ts` fájlban egy DB/HTTP-független, tiszta függvény, amely importálja a `BUDAPEST_REF`-et
**When** a Budapest és Bécs koordinátáit adjuk meg neki
**Then** kb. 214 km-t ad vissza, ±1 km tolerancián belül
**When** Budapest koordinátáit adjuk meg mindkét paraméterként
**Then** 0 km-t ad vissza
**When** `null` koordinátát kap bemenetként
**Then** definiált módon kezeli (nem dob kivételt, `null`-t ad vissza)

### Story 2.2: Express app-scaffold tesztelhető szétválasztással és központi hibakezeléssel

Mint fejlesztő,
egy tesztelhető Express appot szeretnék (`app.ts`/`server.ts` szétválasztva) központi hibakezeléssel,
hogy a végpontok konzisztensen hibázzanak és integrációs tesztelhetők legyenek.

**Acceptance Criteria:**

**Given** a `src/app.ts` egy kötetlen (unbound), importálható Express app-ot exportál
**When** a `src/server.ts` importálja és `.listen()`-t hív rá
**Then** a szerver elindul a `PORT` env változón (dokumentált alapértelmezett érték, ha nincs megadva)
**When** egy integrációs teszt importálja `app.ts`-t
**Then** HTTP hívásokat tud indítani rá anélkül, hogy valódi portot kötne
**Given** a `src/config/env.ts` (Story 1.4-ben létrehozva, itt bővítve) egyetlen helyen olvassa a `DATABASE_URL`/`TEST_DATABASE_URL`/`PORT` változókat
**When** egy kötelező env változó hiányzik vagy érvénytelen
**Then** az alkalmazás azonnal, érthető hibaüzenettel leáll (fail-fast), hardcode-olt jelszó nélkül
**Given** a `src/middleware/errorHandler.ts` központi hibakezelő middleware
**When** egy váratlan vagy DB-hiba történik bármelyik route-ban
**Then** a kliens `{"error":{"message":"Internal server error"}}` választ kap HTTP 500-zal, nyers SQL-hiba, connection string, stack trace vagy titok nélkül
**And** a tényleges hiba `console.error`-ral, `[api]` prefixszel logolódik szerver-oldalon

### Story 2.3: GET /customers/count

Mint kliens,
le szeretném kérdezni az ügyfelek valós számát,
hogy tudjam, hány rekord van az adatbázisban.

**Acceptance Criteria:**

**Given** egy seedelt `customers` tábla `TEST_DATABASE_URL`-en
**When** a kliens meghívja a `GET /customers/count`-ot
**Then** `{"count": N}`-et kap, ahol N valódi `SELECT COUNT(*)` lekérdezésből származik (nem hardcode-olt, nem a seed fájl elemszáma)
**And** a repository a `pg` által string-ként visszaadott számot explicit `number`-ré alakítja és véges/biztonságos értékként validálja
**And** a route handler nem tartalmaz SQL-t (a lekérdezés a repositoryban van)
**And** egy integrációs teszt valódi (nem mockolt) Postgres ellen igazolja a helyes számot ismert fixture-adaton

### Story 2.4: GET /customers/by-distance

Mint kliens,
az ügyfeleket Budapest-távolság szerint rendezve szeretném lekérdezni,
hogy tudjam, ki van a legközelebb.

**Acceptance Criteria:**

**Given** egy seedelt `customers` tábla, köztük egy Budapesti, több ismert koordinátájú, és egy ismeretlen településű (null koordináta) ügyfél
**When** a kliens meghívja a `GET /customers/by-distance`-t
**Then** egy csupasz JSON tömböt kap, minden elem a teljes tárolt rekordot tartalmazza (`id`, `name`, `telepules`, `lat`, `lon`) plusz `distanceKm`-et (1 tizedesre kerekítve, vagy `null`)
**And** a `budget`/`note`/`countryCode` kulcsok hiányoznak az elemből, ha az adott oszlop `NULL` (nincs explicit `null` érték)
**And** a Budapesti ügyfél(ek) `distanceKm: 0.0`-val a lista elején szerepelnek
**And** az ismeretlen településű ügyfél a lista végén szerepel, `distanceKm: null`-lal
**And** azonos `distanceKm` esetén a sorrend `name` szerint növekvő, majd `id` szerint növekvő (teljes determinisztikus rendezés)
**And** a repository az `id` és minden bigint-reprezentációjú mezőt explicit `number`-ré alakít
**And** egy integrációs teszt valódi Postgres ellen igazolja mindhárom esetet: 0 km, holtverseny név szerint, ismeretlen település a lista végén

---

## Epic 3: End-to-End Reproducibility & Delivery Readiness

Egy kiértékelő tiszta gépen (Node.js, Docker, npm megléte esetén) kizárólag a README alapján — más kontextus nélkül — fel tudja állítani a Postgres-t, le tudja futtatni a migrációt, a seedet, el tudja indítani a szervert, és le tudja futtatni a teljes tesztsorozatot, megerősítve, hogy a rendszer pontosan úgy viselkedik, ahogy dokumentálva van.

**FRs covered:** FR14
**NFRs:** NFR7 (kis, fókuszált commitok), NFR8 (README-alapú reprodukálhatóság)

### Story 3.1: README végigfutási dokumentáció

Mint kiértékelő,
egy README-t szeretnék, ami lépésről lépésre leírja a Postgres indítást, migrációt, seedelést, szerverindítást és teszt-futtatást,
hogy egy tiszta gépen is reprodukálni tudjam a teljes rendszert.

**Acceptance Criteria:**

**Given** a projekt minden korábbi story-ja (Epic 1, Epic 2) elkészült
**When** a kiértékelő megnyitja a README-t
**Then** minden lépéshez (`docker compose up -d`, migráció futtatása, seed futtatása, szerver indítása, tesztek futtatása, leállítás/volume törlés) egyetlen, közvetlenül másolható parancs tartozik
**And** a README explicit megnevezi az előfeltételeket (Node.js 24, Docker, npm)
**And** a README dokumentálja a Postgres MCP séma-/adatellenőrzési lépéseit (Story 1.5-ből)
**When** egy kiértékelő, aki csak a README-t olvasta, végigköveti a lépéseket egy tiszta gépen
**Then** a teljes rendszer (adatbázis, seedelt adat, futó szerver, zöld tesztek) sikeresen létrejön külső szolgáltatás nélkül
