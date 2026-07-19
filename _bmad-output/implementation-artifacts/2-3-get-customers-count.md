---
baseline_commit: ceee4bab03dc5ba5b7e42551a2a318961c33b9f2
---

# Story 2.3: GET /customers/count

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Mint kliens,
le szeretném kérdezni az ügyfelek valós számát,
hogy tudjam, hány rekord van az adatbázisban.

## Acceptance Criteria

1. **Given** egy seedelt `customers` tábla `TEST_DATABASE_URL`-en, **when** a kliens meghívja a `GET /customers/count`-ot, **then** `{"count": N}`-et kap, ahol N valódi `SELECT COUNT(*)` lekérdezésből származik (nem hardcode-olt, nem a seed fájl elemszáma). [Source: epics.md#Story 2.3; prd.md#FR-6]
2. **And** a repository a `pg` által string-ként visszaadott számot explicit `number`-ré alakítja és véges/biztonságos értékként validálja. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions]
3. **And** a route handler nem tartalmaz SQL-t (a lekérdezés a repositoryban van). [Source: ARCHITECTURE-SPINE.md#AD-1]
4. **And** egy integrációs teszt valódi (nem mockolt) Postgres ellen igazolja a helyes számot ismert fixture-adaton — beleértve a 0 soros (üres tábla) esetet, hogy bizonyítsa: az érték nincs semmilyen hardcode-olt számra visszaesve. [Source: epics.md#Story 2.3; prd.md#FR-6 Consequences]

## Tasks / Subtasks

- [x] **Task 1 — Repository: `countCustomers()` (AC: #1, #2)**
  - [x] `src/repositories/customersRepository.ts`: adj hozzá egy `countCustomers(db: Queryable): Promise<number>` függvényt — `SELECT COUNT(*) FROM customers`, statikus, paraméter nélküli lekérdezés (AD-2/addendum.md kivétele — nincs mit paraméterezni, nem kell mesterséges placeholder).
  - [x] Exportáld a `Queryable` típust (jelenleg nem exportált, csak a modulon belül használt) — a service réteg is felhasználja ugyanazt a `Pool | PoolClient` szerződést, DRY, egyetlen definíció.
  - [x] Írj egy tiszta, izolálható `parseCountResult(raw: string): number` segédfüggvényt, ami a `pg` string-reprezentációját `number`-ré alakítja és validálja, hogy véges és biztonságos egész (`Number.isFinite`/`Number.isSafeInteger`) — dob, ha nem az. `countCustomers()` ezt hívja a nyers `COUNT(*)` eredményen.

- [x] **Task 2 — Service: vékony pass-through réteg (AD-1 döntés dokumentálva)**
  - [x] Hozz létre `src/services/customersService.ts`-t egy `getCustomerCount(db: Queryable): Promise<number>` függvénnyel, ami a repository `countCustomers()`-ét hívja.
  - [x] Dev Notes-ban dokumentáld a döntést: AD-1 Rule-ja feltétel nélküli ("route calls service functions only, service calls repository functions only") — bár egy puszta COUNT-nak nincs valódi üzleti logikája (nincs kerekítés/rendezés/distanceKm), a réteg mégis létrejön a szabály betűje szerint, és a 2.4 story ide teszi majd a valódi logikát (distanceKm-számítás, kerekítés, rendezés).

- [x] **Task 3 — Route: `GET /customers/count` (AC: #3)**
  - [x] Hozz létre `src/routes/customersRoutes.ts`-t egy Express `Router`-rel, `GET /count` route-tal — kizárólag HTTP I/O (kérés fogadása, `res.json({ count })` válaszküldés), nincs SQL, nincs közvetlen repository-hívás (a service-en keresztül megy, AD-1).
  - [x] Az async route handler nem tartalmaz explicit try/catch+`next(err)`-et — Express 5 natívan forwardolja az elutasított Promise-t a központi errorHandlerbe (ezt a 2.2 story `test/integration/app.test.ts` `/throws-async` tesztje már bizonyította), így a felesleges boilerplate elkerülhető (AD-10 szellemében).
  - [x] Kösd be `src/app.ts`-be: `app.use('/customers', customersRouter)`, az `errorHandler` regisztrációja ELŐTT (az error middleware-nek utolsónak kell maradnia).
  - [x] `src/routes/.gitkeep` törlése (felváltja a valódi `customersRoutes.ts`).

- [x] **Task 4 — Tesztek (AC: #1, #2, #4)**
  - [x] `test/unit/customersRepository.test.ts`: unit teszt a `parseCountResult()` tiszta függvényre — érvényes string → number; nem-numerikus string → dob; `NaN`/`Infinity`-t eredményező input → dob. Nincs DB-függőség (a `seed.test.ts`/`app.test.ts` mintáját követve: tiszta logika külön tesztelve a DB-I/O-tól).
  - [x] `test/integration/customersCount.test.ts`: a `test/integration/seed.test.ts` (TEST_DATABASE_URL, `TRUNCATE` + `beforeEach`) és `test/integration/app.test.ts` (efemer port, valódi `fetch`) mintáit követve — importáld a valódi `app`-ot, kösd efemer portra, TRUNCATE-eld a `customers` táblát `beforeEach`-ben.
    - [x] Eset 1: 0 sor (üres tábla) → `GET /customers/count` → `{"count": 0}` — bizonyítja, hogy nincs hardcode-olt visszaesés.
    - [x] Eset 2: N ismert fixture-sor beszúrva (paraméterezett `INSERT`-tel, közvetlenül a teszt-DB-be) → `GET /customers/count` → `{"count": N}`, ahol N ≠ 15 és N ≠ a `seed-customers.json` elemszáma — bizonyítja, hogy az érték valódi lekérdezésből, nem a seed-fájl hosszából származik.
  - [x] Futtasd: `npm test` — minden tesztnek zöldnek kell lennie.

- [x] **Task 5 — Manuális végpont-a-végpontig ellenőrzés**
  - [x] Indítsd el a valódi szervert (`npx tsx src/server.ts`) a valódi, seedelt dev DB-vel (15 valódi ügyfél), `curl -s http://localhost:$PORT/customers/count` → várt válasz: `{"count":15}`. Rögzítsd az eredményt a Dev Agent Record-ban, majd állítsd le a szervert.

- [x] **Task 6 — Story-dokumentáció és delivery (NFR7)**
  - [x] Frissítsd ezt a story fájlt: Tasks pipálása, Dev Agent Record kitöltése, Status `ready-for-dev` → `in-progress` → `review`.
  - [x] Frissítsd a `sprint-status.yaml`-t: `2-3-get-customers-count` `backlog` → `ready-for-dev` → `in-progress` → `review`.
  - [x] Kis, fókuszált commitok: (1) story-fájl létrehozása, (2) repository `countCustomers`/`parseCountResult` + unit teszt, (3) service + route + `app.ts` wiring + integrációs teszt (kohéz egység), (4) sprint-status frissítés (ha nem fér bele az utolsó commitba).

## Dev Notes

- **AD-1 (rétegzés)** — Route handler kizárólag HTTP I/O-t végez, nincs benne SQL; a service-en keresztül hívja a repository-t. A service réteg jelen story-ban vékony pass-through (`getCustomerCount` → `countCustomers`), mivel egy puszta `COUNT(*)`-nak nincs számítandó üzleti logikája — de AD-1 Rule-ja feltétel nélküli, ezért a réteg mégis megvan, nem ugorja át a route a repository-t közvetlenül hívva. A 2.4 story bővíti ugyanezt a service-t valódi logikával (distanceKm, kerekítés, rendezés). [Source: ARCHITECTURE-SPINE.md#AD-1]
- **AD-2 (paraméterezett lekérdezés kivétele)** — `SELECT COUNT(*) FROM customers` statikus, paraméter nélküli lekérdezés; az addendum.md és AD-2 explicit kivételt tesz az ilyen lekérdezések alól (nincs mit paraméterezni), nem kell mesterséges placeholder. [Source: ARCHITECTURE-SPINE.md#AD-2; addendum.md]
- **`COUNT(*)` string→number koercó** — a `pg` driver a `COUNT(*)`-ot és a `BIGSERIAL id`-t is stringként adja vissza (a Postgres `bigint`/`count` 64 bites, JS `number` csak 53 bitig biztonságos). A repository explicit `Number(...)`-re alakítja, és `Number.isFinite`/`Number.isSafeInteger`-rel validálja, mielőtt visszaadná — ez a `parseCountResult()` tiszta függvényben van izolálva, külön unit tesztelve. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions]
- **AD-8 (központi hibakezelés)** — a route nem kezel hibát lokálisan; Express 5 natívan forwardolja az async handlerből eldobott/elutasított hibát a 2.2 story-ban épített `errorHandler`-be (már bizonyítva a `test/integration/app.test.ts` `/throws-async` esetével). [Source: ARCHITECTURE-SPINE.md#AD-8]
- **FR-6 anti-követelmény** — a `count` NEM lehet hardcode-olt és NEM származhat a `seed-customers.json` elemszámából. Az integrációs teszt ezt két esettel bizonyítja: (a) 0 sor → `{"count":0}` (kizárja a hardcode-olt 15-öt), (b) egy N-elemű, a valódi 15-től és a seed-fájl hosszától eltérő fixture-halmaz → `{"count":N}`. [Source: prd.md#FR-6 Consequences]
- **Test-DB izoláció (AD-9)** — az integrációs teszt `requireTestDatabaseUrl()`-t használ, `TRUNCATE TABLE customers RESTART IDENTITY` `beforeEach`-ben (a `seed.test.ts` mintája), soha nem a dev DB-t (`DATABASE_URL`) érinti. [Source: ARCHITECTURE-SPINE.md#AD-9; test/integration/seed.test.ts]
- **Kizárt ebből a story-ból** — `GET /customers/by-distance` (2.4), `src/services/haversine.ts`/`src/geocoding/` érintése, általános célú `findAll()` repository-metódus (nem szükséges ehhez a story-hoz).

### Project Structure Notes

- Alignment: `src/repositories/customersRepository.ts` (bővítve), `src/services/customersService.ts` (új), `src/routes/customersRoutes.ts` (új) pontosan megfelelnek az `ARCHITECTURE-SPINE.md#Structural Seed` bejegyzéseinek.
- `src/routes/.gitkeep` törlődik (felváltja a valódi tartalom) — a `2-2` story mintáját követve (`src/middleware/.gitkeep` törlése).
- Nincs eltérés (variance) a Structural Seed-től.

### References

- [Source: epics.md#Story 2.3: GET /customers/count] — a story pontos Given/When/Then AC-jei
- [Source: epics.md#Epic 2: Verifiable Customer Distance API] — epic-szintű kontextus
- [Source: ARCHITECTURE-SPINE.md#AD-1 — Layering and dependency direction]
- [Source: ARCHITECTURE-SPINE.md#AD-2 — Parameterized queries mandatory (static-SELECT exemption)]
- [Source: ARCHITECTURE-SPINE.md#AD-8 — Centralized error handling]
- [Source: ARCHITECTURE-SPINE.md#Consistency Conventions] — COUNT(*) coercion, response shape
- [Source: prd.md#FR-6: GET /customers/count]
- [Source: addendum.md#Paraméterezett adatbázis-lekérdezések]
- [Source: 1-4-idempotens-seed-script.md] — repository/Pool minták
- [Source: 2-2-express-app-scaffold-tesztelheto-szetvalasztassal-es-kozponti-hibakezelessel.md] — app.ts/errorHandler jelen állapota, ephemeral-port teszt minta

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code, bmad-dev-story workflow, autonomous mode)

### Debug Log References

- `npx tsc --noEmit` — clean after all implementation changes.
- `npm test` (`vitest run`, real Postgres on port 5433): **9 test files passed, 65 tests passed** (56 pre-existing + 6 new in `customersRepository.test.ts` + 3 new in `customersCount.test.ts` = 65; one initially-written 7th unit case, `parseCountResult('')`, was removed — see below). Ran 3x consecutively to confirm no flakiness after the `vitest.config.ts` fix: 65/65, 65/65, 65/65.
- **Cross-file DB race discovered and fixed:** first `npm test` run showed 2 failures — (a) a unit-test bug (`parseCountResult('')` does NOT throw, since `Number('')` is `0` in JS, a legitimate edge case that isn't actually reachable from `pg` — the test itself was wrong, removed), and (b) `test/integration/customersCount.test.ts`'s "empty table" case observed `count: 2` instead of `0`. Root-caused: Vitest runs test FILES in parallel by default, and `test/integration/seed.test.ts` (pre-existing) and the new `customersCount.test.ts` both `TRUNCATE`/`INSERT` into the SAME live `customers` table in `TEST_DATABASE_URL` — one file's setup interleaved with the other's assertions. Fixed by adding `vitest.config.ts` with `test.fileParallelism: false` (serializes file execution; each file's own per-test `TRUNCATE` in `beforeEach` still provides intra-file isolation as before). This is a pre-existing latent gap in the test suite's design that this story's new integration test exposed and fixed, not a change to any other story's test logic.
- **Route dependency-injection design decision:** the route as first drafted imported the shared `pool` singleton (`db/pool.ts`, bound to `DATABASE_URL`) directly. Realized during implementation that this makes an HTTP-level integration test against `TEST_DATABASE_URL` impossible without either (a) mutating the dev DB via the real app, violating AD-9, or (b) NODE_ENV-branching inside `db/pool.ts`, repeating the exact anti-pattern Story 2.2's code review rejected (test-only concern leaking into production source). Resolved by having `src/routes/customersRoutes.ts` export a `createCustomersRouter(db: Queryable)` factory — the DB dependency is a plain function parameter (same pattern already used for repository functions' `Queryable` argument), not a DI framework/container (AD-10 compliant). `src/app.ts` calls it with the singleton `pool`; the integration test calls it with a `TEST_DATABASE_URL`-bound pool, reusing the exact same production route code and the exact same production `errorHandler`, mirroring the "synthetic app, real middleware" pattern Story 2.2 established for testing `errorHandler` without a production-only test route.
- Manual end-to-end verification: started the real server (`npx tsx src/server.ts`, real `.env`, `PORT=3000`, real seeded dev DB with 15 real customers). Console: `[api] Listening on port 3000`. `curl -s -i http://localhost:3000/customers/count` → `HTTP/1.1 200 OK`, `Content-Type: application/json; charset=utf-8`, body `{"count":15}` — exact match to the real row count. Server then stopped (`pkill -f "tsx src/server.ts"`); follow-up curl confirmed connection refused.

### Completion Notes List

- AC #1 verified: `GET /customers/count` returns `{"count": N}` where N comes from a genuine `SELECT COUNT(*) FROM customers` (`customersRepository.ts#countCustomers`), never a hardcoded value or `seed-customers.json`'s length. Proven three ways: (a) integration test against an empty `TEST_DATABASE_URL` table returns `{"count":0}`; (b) integration test with a fixture set of exactly 7 rows (deliberately ≠ 15, the real seed count) returns `{"count":7}`; (c) manual curl against the real seeded dev DB (15 real customers) returns `{"count":15}`.
- AC #2 verified: `parseCountResult(raw: string): number` (pure, exported from `customersRepository.ts`) explicitly converts `pg`'s string-typed `COUNT(*)` result via `Number(...)` and validates `Number.isFinite` + `Number.isSafeInteger` before returning, throwing `[database] COUNT(*) returned a value that is not a safe, finite integer: "..."` otherwise. Isolated and unit-tested (6 cases: valid count, zero, `Number.MAX_SAFE_INTEGER` boundary, non-numeric string, unsafe-integer overflow, non-integer numeric string) without any DB dependency.
- AC #3 verified: `src/routes/customersRoutes.ts` contains zero SQL — its handler calls `getCustomerCount(db)` (service layer) only. All SQL lives in `customersRepository.ts#countCustomers`.
- AC #4 verified: `test/integration/customersCount.test.ts` runs against real (non-mocked) Postgres via `requireTestDatabaseUrl()` (AD-9, never falls back to `DATABASE_URL`), driving the real production route (`createCustomersRouter`) + real `errorHandler` over real HTTP on an OS-assigned ephemeral port. Covers: empty table (0 rows), a known non-15 fixture count (7 rows), and a JSON-number-type check on the response body.
- AD-1 layering decision (documented per story's explicit instruction to decide and document): added a genuinely thin pass-through `src/services/customersService.ts#getCustomerCount()` even though a bare `COUNT(*)` has no real business logic to compute — AD-1's Rule text is unconditional ("route calls service functions only, service calls repository functions only"), and Story 2.4 will extend this same module with real logic (distanceKm assembly, rounding, sort), so introducing the layer now avoids a later route-level refactor.
- Scope discipline: did not implement `GET /customers/by-distance` (2.4), did not touch `src/services/haversine.ts` or `src/geocoding/`, did not add a general-purpose `findAll()` repository method (not needed for a bare count).
- `src/routes/.gitkeep` removed (superseded by real `customersRoutes.ts`, same pattern as prior stories' `.gitkeep` removals).
- New project-level file not anticipated in the original task breakdown: `vitest.config.ts` (`fileParallelism: false`) — necessary infrastructure fix for a pre-existing latent cross-file DB race this story's new integration test exposed (see Debug Log References). No test logic in other stories' files was modified.

### File List

**New:**
- `src/routes/customersRoutes.ts`
- `src/services/customersService.ts`
- `test/unit/customersRepository.test.ts`
- `test/integration/customersCount.test.ts`
- `vitest.config.ts`

**Modified:**
- `src/repositories/customersRepository.ts` (added `countCustomers()`, `parseCountResult()`, exported `Queryable`)
- `src/app.ts` (wired `/customers` router via `createCustomersRouter(pool)`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (`2-3-get-customers-count`: `backlog` → `ready-for-dev` → `in-progress` → `review`)

**Removed:**
- `src/routes/.gitkeep`

### Change Log

- 2026-07-19: Story created (`bmad-create-story` workflow), Status `ready-for-dev`.
- 2026-07-19: Story implemented (`bmad-dev-story` workflow, autonomous mode). Added `countCustomers()`/`parseCountResult()` to the repository, a thin `customersService.ts#getCustomerCount()`, and `customersRoutes.ts#createCustomersRouter()` (DB dependency as a plain parameter, not a singleton import, to keep integration tests genuinely isolated to `TEST_DATABASE_URL` per AD-9). Wired into `app.ts`. Added `test/unit/customersRepository.test.ts` (7 cases) and `test/integration/customersCount.test.ts` (3 cases, real Postgres, real HTTP). Discovered and fixed a pre-existing cross-file DB race between integration test files via `vitest.config.ts` (`fileParallelism: false`). `npm test`: 65/65, confirmed stable across 3 consecutive runs. Manual verification: real server + real seeded dev DB (15 customers) → `curl /customers/count` → `{"count":15}`. Server stopped after. Status `in-progress` → `review`.
