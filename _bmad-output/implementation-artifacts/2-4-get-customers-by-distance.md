---
baseline_commit: c59b9b56d85bf2c7701b1ec38a95cce03082b2a9
---

# Story 2.4: GET /customers/by-distance

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Mint kliens,
az ügyfeleket Budapest-távolság szerint rendezve szeretném lekérdezni,
hogy tudjam, ki van a legközelebb.

## Acceptance Criteria

1. **Given** egy seedelt `customers` tábla, köztük egy Budapesti, több ismert koordinátájú, és egy ismeretlen településű (null koordináta) ügyfél, **when** a kliens meghívja a `GET /customers/by-distance`-t, **then** egy csupasz JSON tömböt kap, minden elem a teljes tárolt rekordot tartalmazza (`id`, `name`, `telepules`, `lat`, `lon`) plusz `distanceKm`-et (1 tizedesre kerekítve, vagy `null`). [Source: epics.md#Story 2.4; prd.md#FR-7]
2. **And** a `budget`/`note`/`countryCode` kulcsok hiányoznak az elemből, ha az adott oszlop `NULL` (nincs explicit `null` érték). [Source: ARCHITECTURE-SPINE.md#Consistency Conventions]
3. **And** a Budapesti ügyfél(ek) `distanceKm: 0.0`-val a lista elején szerepelnek. [Source: epics.md#Story 2.4; prd.md#FR-7]
4. **And** az ismeretlen településű ügyfél a lista végén szerepel, `distanceKm: null`-lal. [Source: epics.md#Story 2.4; prd.md#FR-7]
5. **And** azonos `distanceKm` esetén a sorrend `name` szerint növekvő, majd `id` szerint növekvő (teljes determinisztikus rendezés) — mindkét csoporton (nem-null és null `distanceKm`) belül. [Source: epics.md#Story 2.4; ARCHITECTURE-SPINE.md#Consistency Conventions sort rule]
6. **And** a repository az `id` és minden bigint-reprezentációjú mezőt explicit `number`-ré alakít. [Source: epics.md#Story 2.4; ARCHITECTURE-SPINE.md#Consistency Conventions]
7. **And** egy integrációs teszt valódi Postgres ellen igazolja mindhárom esetet: 0 km, holtverseny név szerint, ismeretlen település a lista végén. [Source: epics.md#Story 2.4; prd.md#FR-11]

## Tasks / Subtasks

- [x] **Task 1 — Repository: `findAll()` + shared bigint coercion (AC: #1, #6)**
  - [x] `src/repositories/customersRepository.ts`: add `findAll(db: Queryable): Promise<Customer[]>` — static, parameter-free `SELECT id, name, telepules, lat, lon, budget, note, country_code FROM customers` (AD-2 static-SELECT exemption, same as `countCustomers()`).
  - [x] Extract a shared pure `parseSafeNonNegativeInteger(raw: string, context: string): number` helper from the existing `parseCountResult()` logic (identical `/^\d+$/` + `Number.isFinite`/`Number.isSafeInteger` rigor); `parseCountResult()` becomes a thin wrapper (`context = 'COUNT(*)'`) so its exact existing error message and behavior are unchanged (existing unit tests keep passing unmodified). Add `parseCustomerId(raw: string): number` (`context = 'customers.id'`) reusing the same helper for the BIGSERIAL `id` column.
  - [x] Row mapping (`mapRowToCustomer`): `country_code` → `countryCode`; `id` via `parseCustomerId`; `lat`/`lon` pass through as-is (pg auto-parses `double precision` as JS `number`, no coercion needed — only `int8`/`bigint` columns like `id` return as strings). **Design decision (documented here, not re-litigated elsewhere):** the row-mapping layer produces `undefined` (omits the key) for `budget`/`note`/`countryCode` when the underlying column is `NULL`, never an explicit `null`. This makes the JSON-serialization step (`res.json(array)`) a pure pass-through with zero special-casing, because `JSON.stringify` already drops `undefined`-valued keys but preserves explicit `null` values — which is exactly the asymmetry this story needs (`budget`/`note`/`countryCode`: omit when absent; `distanceKm`: always present, explicit `null` when unknown).
  - [x] Define `CustomerWithDistance` (extends `Customer` with `distanceKm: number | null`) in this same module, per AD-14 ("Customer type and its CustomerWithDistance extension defined exactly once, in customersRepository.ts").

- [x] **Task 2 — Service: `getCustomersByDistance()` — distanceKm, rounding, deterministic sort (AC: #1, #3, #4, #5)**
  - [x] `src/services/customersService.ts`: add `assembleCustomersWithDistance(customers: Customer[]): CustomerWithDistance[]` — a pure function (no `db` argument) so it is unit-testable with fake data, no DB/mocking required. `getCustomersByDistance(db: Queryable): Promise<CustomerWithDistance[]>` becomes `assembleCustomersWithDistance(await findAll(db))`.
  - [x] `distanceKm` computation: `null` when `customer.lat === null || customer.lon === null` (the CHECK constraint guarantees these are paired); otherwise `haversineDistanceKm({lat, lon})` (defaults `to` to `BUDAPEST_REF`), then rounded.
  - [x] Rounding: `Math.round((value + Number.EPSILON) * 10) / 10`, NOT naive `Math.round(value * 10) / 10` — the classic footgun (`1.005 * 10 === 10.049999999999999` due to float representation, which would round DOWN to `10.0` instead of `10.1`). Adding `Number.EPSILON` before the multiply nudges float-representation-error cases back onto the correct side of the rounding boundary. Document in a code comment that Haversine outputs are practically never exact `.x5` boundary values (irrational trig results), so this is a standard defensive idiom here, not a load-bearing precision guarantee.
  - [x] Sort comparator: non-null `distanceKm` group first (ascending), null group last; within each group, `name` ascending then `id` ascending. Use plain lexicographic string comparison (`<`/`>`) for `name`, NOT `localeCompare` — `localeCompare`'s behavior can vary across Node builds/ICU data, which would undermine FR-7's explicit "fully deterministic" requirement; plain UTF-16 code-unit comparison is always deterministic regardless of environment. Document this choice.

- [x] **Task 3 — Route: `GET /customers/by-distance` (AC: #1)**
  - [x] `src/routes/customersRoutes.ts`: add `router.get('/by-distance', ...)` to the existing `createCustomersRouter(db)` factory (same router as `/count`), calling `getCustomersByDistance(db)` and responding `res.json(result)` — a bare JSON array, not wrapped in an envelope object. No SQL, no direct repository access (AD-1) — same async-handler-without-try/catch pattern as `/count` (Express 5 auto-forwards rejected Promises to `errorHandler`).

- [x] **Task 4 — Tests (AC: #1–#7)**
  - [x] `test/unit/customersRepository.test.ts` (extend): unit tests for `parseCustomerId` (valid, zero, MAX_SAFE_INTEGER boundary, non-numeric, unsafe overflow, non-integer, negative — mirroring the existing `parseCountResult` cases) and for `mapRowToCustomer` (NULL columns → key absent via `'budget' in customer` checks, non-NULL → key present with correct value; `id` string → number).
  - [x] `test/unit/customersService.test.ts` (new): unit tests for `assembleCustomersWithDistance()` with fake `Customer[]` fixtures (no DB) — Budapest coordinate → `distanceKm: 0` (well, whatever the actual haversine value rounds to for the exact `BUDAPEST_REF` coordinate — 0); null lat/lon → `distanceKm: null`, sorted last; ascending non-null sort order for 3+ distinct distances; a genuine tie (two fixtures with IDENTICAL lat/lon, so `distanceKm` is bit-identical) broken by `name` ascending, then by `id` ascending when names also tie; rounding footgun regression test (a value that would misround under naive `Math.round(x*10)/10`).
  - [x] `test/integration/customersByDistance.test.ts` (new), following the `customersCount.test.ts`/`seed.test.ts` pattern (`requireTestDatabaseUrl()`, `createPool()`, synthetic Express app wired to `createCustomersRouter(pool)` + `errorHandler`, `listenOnEphemeralPort`/`closeServer` from `test/helpers/httpServer.ts`, `TRUNCATE TABLE customers RESTART IDENTITY` in `beforeEach`). Insert dedicated fixture rows directly via parameterized `INSERT` (not `seed-customers.json`, for precise scenario control):
    - [x] A Budapest-coordinate customer → `distanceKm: 0` in the response, positioned first among non-null distances.
    - [x] A null-lat/lon customer (unknown town) → `distanceKm: null`, sorted to the very end of the array.
    - [x] 3+ customers with distinct non-null distances → ascending order verified.
    - [x] Two customers with IDENTICAL lat/lon (forcing a bit-identical `distanceKm` tie) and different names → asserts the lower name sorts first.
    - [x] Two customers with identical lat/lon AND identical name-sort-relevant... (use identical distance + same name prefix but ensure a real name tie is impossible with UNIQUE(name, telepules); instead cover the `id` tiebreak by giving two same-distance, same-name-impossible rows — use distinct names for the name-tiebreak case, and rely on unit tests for the id-tiebreak-when-names-equal case since the DB's UNIQUE(name, telepules) constraint makes two truly identical (name, distance) rows impossible via distinct telepules with equal coordinates, which is achievable and does not violate the constraint) — verify the array is fully, deterministically ordered.
    - [x] `budget`/`note`/`countryCode`: one fixture row with all three set → present in the JSON element; one fixture row with all three NULL → absent from the JSON element (assert via `'budget' in element` etc., not just `=== undefined`, since a JSON-parsed body never has `undefined` values anyway — the real assertion is key absence).
  - [x] Run `npm test` — all tests green.

- [x] **Task 5 — Manual end-to-end verification against the real dev DB**
  - [x] Start the real server (`npx tsx src/server.ts`) against the real seeded dev DB (`DATABASE_URL`, 15 real customers). `curl -s http://localhost:$PORT/customers/by-distance` → verify: a properly sorted array, Anna Kovács (Budapest) shows `distanceKm: 0`, overall ordering looks sane (closest European cities to Budapest first). Record a few real entries in the Dev Agent Record. Stop the server after.

- [x] **Task 6 — Story documentation and delivery (NFR7)**
  - [x] Update this story file: check off tasks, fill Dev Agent Record, Status `ready-for-dev` → `in-progress` → `review`.
  - [x] Update `sprint-status.yaml`: `2-4-get-customers-by-distance` → `ready-for-dev` → `in-progress` → `review`; `epic-2` → `done` (last story in the epic, matching Epic 1's closeout pattern).
  - [x] Small, focused commits: (1) story file, (2) repository `findAll`/shared coercion/`CustomerWithDistance` + unit tests, (3) service `assembleCustomersWithDistance`/`getCustomersByDistance` + unit tests, (4) route + integration tests (or combine service+route+integration if naturally cohesive), (5) sprint-status update if not folded into an earlier commit.

## Dev Notes

- **AD-1 (layering)** — Route handler stays HTTP-I/O-only (calls `getCustomersByDistance(db)`, no SQL). All business logic (distanceKm computation, rounding, sorting) lives in `customersService.ts`, NOT in the repository (which does DB I/O + row mapping only) and NOT in the route. [Source: ARCHITECTURE-SPINE.md#AD-1]
- **AD-2 (static-SELECT exemption)** — `SELECT ... FROM customers` with no `WHERE` clause is exempt from the parameterized-query requirement (nothing dynamic to bind), same exemption already used by `countCustomers()`. [Source: ARCHITECTURE-SPINE.md#AD-2]
- **AD-6 (pure Haversine)** — `haversineDistanceKm()` is reused unmodified from Story 2.1; this story must NOT touch `src/services/haversine.ts`. [Source: ARCHITECTURE-SPINE.md#AD-6]
- **AD-13 (single BUDAPEST_REF)** — `haversineDistanceKm()`'s `to` parameter already defaults to the imported `BUDAPEST_REF`; this story does not redefine or re-import a second copy anywhere.
- **AD-14 (single Customer type + CustomerWithDistance)** — both types live in `customersRepository.ts` only; the service and route import them, never redeclare.
- **NULL-omission design decision** — see Task 1: chosen to implement at the row-mapping layer (repository), producing `undefined` for absent optional fields, rather than at JSON-serialization time. Rationale: `JSON.stringify`/Express's `res.json()` already drops `undefined`-valued keys while preserving explicit `null`, so this single choice at the mapping layer gets both required behaviors (budget/note/countryCode omitted when absent; distanceKm explicit `null` when unknown) for free, with no serialization-layer special-casing needed anywhere.
- **Rounding footgun** — `Math.round((value + Number.EPSILON) * 10) / 10`, not naive `Math.round(value * 10) / 10`. See Task 2 for the concrete failure example this avoids.
- **Sort determinism** — plain `<`/`>` string comparison for the `name` tiebreak, not `localeCompare` (ICU-build-dependent, would undermine full determinism). Comparator order: non-null distanceKm asc → name asc → id asc; null-distanceKm group last, same tiebreak within it.
- **Excluded from this story** — no changes to `src/services/haversine.ts` or `src/geocoding/`; no changes to `/customers/count` beyond incidental sharing of the extracted `parseSafeNonNegativeInteger` helper (existing `countCustomers`/`parseCountResult` tests must keep passing unchanged); no pagination/filtering.

### Project Structure Notes

- Alignment: `src/repositories/customersRepository.ts` (extended), `src/services/customersService.ts` (extended), `src/routes/customersRoutes.ts` (extended) — exactly the files `ARCHITECTURE-SPINE.md#Structural Seed` and the `GET /customers/by-distance` sequence diagram anticipate. No new top-level modules.
- No variance from the Structural Seed.

### References

- [Source: epics.md#Story 2.4: GET /customers/by-distance] — exact Given/When/Then ACs
- [Source: epics.md#Epic 2: Verifiable Customer Distance API] — epic-level context
- [Source: ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-6, AD-8, AD-13, AD-14]
- [Source: ARCHITECTURE-SPINE.md#Consistency Conventions] — response shape, NULL-omission, id coercion, sort rule
- [Source: ARCHITECTURE-SPINE.md#Runtime data flow — GET /customers/by-distance] — sequence diagram
- [Source: prd.md#FR-7, FR-8, FR-11]
- [Source: 2-3-get-customers-count.md] — repository/service/route patterns, `createCustomersRouter(db)` factory, `test/helpers/httpServer.ts`, `parseCountResult`-style coercion rigor
- [Source: 2-1-tiszta-haversine-fuggveny-unit-tesztekkel.md] — `haversineDistanceKm(from, to = BUDAPEST_REF)` signature and null-handling contract

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code, bmad-dev-story workflow, autonomous mode)

### Debug Log References

### Completion Notes List

### File List
