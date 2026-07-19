---
baseline_commit: c59b9b56d85bf2c7701b1ec38a95cce03082b2a9
---

# Story 2.4: GET /customers/by-distance

Status: done

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

- `npx tsc --noEmit` — clean after every implementation step.
- `npm test` (`vitest run`, real Postgres on port 5433): **11 test files passed, 99 tests passed** (72 pre-existing + 27 new: `customersRepository.test.ts` grew from 11 to 21 tests (+10: 7 `parseCustomerId` + 3 `mapRowToCustomer`); `customersService.test.ts` grew from 2 to 11 tests (+9 `assembleCustomersWithDistance`); new `customersByDistance.test.ts` adds 8). Ran 3x consecutively: 99/99, 99/99, 99/99 — no flakiness.
- **Rounding-example correction caught mid-implementation:** the first draft of the rounding-footgun code comment and its regression test used `1.005` as the "classic footgun" example, copying the commonly-cited 2-decimal (cents) rounding example without checking it against 1-decimal rounding. Verified in Node that `1.005` actually rounds correctly to `1.0` at 1-decimal precision (it's closer to 1.0 than 1.1), so the original example was arithmetically wrong for this function's actual granularity. Found a real, Node-verified 1-decimal boundary case instead (`2.4 + 0.05` evaluates to `2.4499999999999997`, which naively rounds to `2.4` instead of the correct `2.5`) and fixed both the code comment (`src/services/customersService.ts`) and the regression test (`test/unit/customersService.test.ts`) to use it, with the exact float value asserted inline so the premise is self-verifying, not just asserted in prose.
- **id/lat/lon/budget coercion scope check:** verified (Node docs + `pg`'s default type parsers) that only `int8`/`bigint`-typed columns (here, just `id`, a `BIGSERIAL`) come back from `pg` as strings — `double precision` (`lat`/`lon`) and `integer` (`budget`) are auto-parsed to JS `number` already. This meant only `id` needed the new coercion helper; `lat`/`lon`/`budget` are passed through as-is in `mapRowToCustomer`, avoiding unnecessary coercion code.
- Manual end-to-end verification: started the real server (`npx tsx src/server.ts`, real `.env`, `PORT=3000`, real seeded dev DB with 15 real customers). Console: `[api] Listening on port 3000`. `curl -s http://localhost:3000/customers/by-distance` → 15-element JSON array, 0 null-distanceKm entries (expected — all 15 real seed towns match the reference). First entries: Anna Kovács (Budapest) `distanceKm: 0`; Lena Fischer (Vienna) `214`; Katarzyna Nowak (Kraków) `293`; Matej Horvat (Ljubljana) `380.6`; Petra Horáková (Prague) `442.4`. Last entry: Isabella Silva (Lisbon) `2469.4`, the farthest city, as expected. Ascending order verified across all 15. Server then stopped; follow-up curl confirmed connection refused. Dev DB re-checked via `docker compose exec postgres psql` — still exactly 15 rows (the TEST_DATABASE_URL-only integration tests never touched it).

### Completion Notes List

- AC #1 verified: `GET /customers/by-distance` returns a bare JSON array; each element carries `id` (number), `name`, `telepules`, `lat`, `lon`, plus `distanceKm` (1-decimal rounded number, or `null`). Proven by `test/integration/customersByDistance.test.ts`'s shape-check test and the manual curl against the real dev DB.
- AC #2 verified: `budget`/`note`/`countryCode` are omitted (not explicit `null`) when the DB column is `NULL` — implemented once, at the repository row-mapping layer (`mapRowToCustomer`), documented as a deliberate design choice so `res.json()` needs zero special-casing (`JSON.stringify` already drops `undefined` keys while keeping explicit `null`). Proven by unit tests (`mapRowToCustomer`, `assembleCustomersWithDistance`) and an integration test that additionally greps the raw response text for `"budget":null` etc. to rule out explicit-null leakage.
- AC #3 verified: a Budapest-coordinate fixture returns `distanceKm: 0` and sorts first among non-null distances (integration + unit tests); confirmed against the real dev DB (Anna Kovács, `distanceKm: 0`, first in the response).
- AC #4 verified: a null-lat/lon fixture returns `distanceKm: null` and sorts to the very end of the array, even with other non-null-distance customers present (integration + unit tests).
- AC #5 verified: full deterministic tiebreak (distanceKm asc → name asc → id asc, null-distanceKm group last with the same tiebreak) proven at both layers — unit tests construct genuine ties via identical lat/lon (bit-identical `distanceKm`) and identical names+null coordinates; the integration test does the same over real Postgres/HTTP.
- AC #6 verified: `parseCustomerId()` (sharing `parseCountResult()`'s extracted `parseSafeNonNegativeInteger` helper) coerces the `pg`-string `id` column to a validated `number`; `typeof element.id === 'number'` asserted in the integration test.
- AC #7 verified: `test/integration/customersByDistance.test.ts` covers all three FR-11 cases against real (non-mocked) Postgres in one combined test plus individual focused tests: 0km, name-ascending tie-break, unknown-town-at-end.
- Rounding: `Math.round((value + Number.EPSILON) * 10) / 10`, not naive `Math.round(value * 10) / 10` — see Debug Log for the corrected, Node-verified footgun example (`2.4 + 0.05` → `2.4499999999999997` → naive rounds to `2.4`, EPSILON-adjusted correctly rounds to `2.5`).
- Sort: plain `<`/`>` string comparison for the `name` tiebreak (not `localeCompare`), for cross-environment determinism independent of Node's ICU build — documented in both the story Dev Notes and the code comment.
- Scope discipline: did not modify `src/services/haversine.ts` or `src/geocoding/`; did not touch `/customers/count`'s route/behavior (only its repository dependency, `parseCountResult`, was refactored to share a helper — its exact existing behavior, error message, and all 11 pre-existing unit tests are unchanged/still passing); no pagination/filtering added.
- `[ASSUMPTION]` Route path is `/customers/by-distance` (mounted the same way as `/customers/count`, under the existing `createCustomersRouter(db)` factory) — matches both `epics.md`'s AC text and the Architecture Spine's sequence-diagram title exactly, no ambiguity to flag.

### File List

**New:**
- `test/integration/customersByDistance.test.ts`

**Modified:**
- `src/repositories/customersRepository.ts` (added `findAll()`, `mapRowToCustomer()`, `CustomerWithDistance`, `parseCustomerId()`, extracted `parseSafeNonNegativeInteger()`)
- `src/services/customersService.ts` (added `assembleCustomersWithDistance()`, `getCustomersByDistance()`, `computeDistanceKm()`, `roundToOneDecimal()`, `compareByDistanceThenNameThenId()`)
- `src/routes/customersRoutes.ts` (added `GET /by-distance`)
- `test/unit/customersRepository.test.ts` (added `parseCustomerId`/`mapRowToCustomer` unit tests)
- `test/unit/customersService.test.ts` (added `assembleCustomersWithDistance` unit tests)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (`2-4-get-customers-by-distance`: `backlog` → `ready-for-dev` → `in-progress` → `review`; `epic-2`: `in-progress` → `done`)

### Change Log

- 2026-07-19: Story created (`bmad-create-story` workflow), Status `ready-for-dev`.
- 2026-07-19: Story implemented (`bmad-dev-story` workflow, autonomous mode). Added `findAll()`/`mapRowToCustomer()`/`CustomerWithDistance`/`parseCustomerId()` to the repository (extracting a shared `parseSafeNonNegativeInteger()` helper from `parseCountResult()` without changing its behavior), `assembleCustomersWithDistance()`/`getCustomersByDistance()` to the service (pure distanceKm assembly + EPSILON-corrected rounding + deterministic sort), and `GET /by-distance` to the route. Added unit tests (repository row-mapping/id-coercion, service rounding/sorting with fake fixtures) and `test/integration/customersByDistance.test.ts` (real Postgres, real HTTP, dedicated fixtures covering 0km/tie-break/unknown-town). `npm test`: 99/99, stable across 3 consecutive runs. Manual verification: real server + real seeded dev DB (15 customers) → `curl /customers/by-distance` → correctly sorted array, Anna Kovács (Budapest) `distanceKm: 0` first, Isabella Silva (Lisbon) farthest last. Dev DB confirmed still exactly 15 rows after. Server stopped after. Status `in-progress` → `review`.
- 2026-07-19: Code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor — the highest-scrutiny pass yet, given this story's real business logic). The Acceptance Auditor hand-traced the sort comparator through every branch and independently verified the NULL-key-omission design against Express's actual `res.json()` serialization path (both confirmed correct, no violations). 8 patches applied (1 genuine defensive gap: non-finite lat/lon could corrupt sort order; the rest were test-coverage gaps for already-correct logic), 3 dismissed. `npm test`: 108/108, stable across 3 consecutive runs. Dev DB re-verified intact at 15 rows. Status `done`.

### Review Findings

- [x] [Review][Patch] **(The one genuine correctness gap found)** `computeDistanceKm` treated any non-null `lat`/`lon` as valid without checking they were finite. Discovered non-obvious root cause (Edge Case Hunter): the `customers` table's CHECK constraints use SQL's three-valued logic — `'NaN'::double precision BETWEEN -90 AND 90` evaluates to NULL/unknown, which a CHECK constraint treats as **passing**, not rejecting — so a stored `NaN` is not actually excluded by the schema the way the range CHECKs appear to promise. A `NaN` distanceKm would then make `Array.prototype.sort`'s comparator return `NaN` for `a.distanceKm - b.distanceKm`, which `sort` silently treats as "equal," corrupting the FR-7 deterministic order with no error raised anywhere [src/services/customersService.ts] — fixed: `computeDistanceKm` now also checks `Number.isFinite(lat)`/`Number.isFinite(lon)` and treats a non-finite coordinate the same as null (unknown town). New unit test (`Number.NaN`/`Number.POSITIVE_INFINITY`).
- [x] [Review][Patch] The "falsy-but-present" design decision (budget `0`, note `""` must NOT be treated as omitted, only a real `NULL` should be) was asserted in code comments but never exercised by any test with those exact values — the highest-stakes design decision in the row-mapping logic had no regression guard — fixed: new tests at both the repository (`mapRowToCustomer`) and service (`assembleCustomersWithDistance`) layers with `budget: 0`/`note: ''`.
- [x] [Review][Patch] The documented-but-surprising sort behavior (plain UTF-16 code-unit comparison, not locale-aware — so e.g. `"Banana"` sorts before `"apple"`) was argued for in a code comment but never demonstrated by a test with mixed-case names; every existing fixture happened to avoid the distinction — fixed: new test with `'apple'`/`'Banana'` proving the documented ordering.
- [x] [Review][Patch] `assembleCustomersWithDistance([])` (empty input) and a real `GET /customers/by-distance` against a truncated table were both untested — cheap, degenerate-input coverage gap in a `.map().sort()` pipeline — fixed: new unit test (empty array) and new integration test (empty table → `200`, `[]`).
- [x] [Review][Patch] The "unreachable in practice" defensive throw in `computeDistanceKm` (fires if `haversineDistanceKm` ever returned `null` for non-null input) had zero test coverage — a future change to that contract could silently start throwing, or silently stop throwing and miscompute, with nothing to catch it — fixed: new test mocking `haversine.js` via `vi.doMock`/dynamic re-import to force the branch and confirm the throw fires with a clear message.
- [x] [Review][Patch] `roundToOneDecimal`'s own regression test reimplemented the rounding formula inline rather than calling the shipped (previously module-private) function — a silent revert of the real function to the naive form wouldn't have been caught — fixed: exported `roundToOneDecimal` (same rationale as the repository's already-exported `parseCountResult`/`parseCustomerId`) and rewrote the test to call it directly. Also added a second test covering ordinary (non-boundary) magnitudes, since the Acceptance Auditor noted the EPSILON correction is a no-op at this app's real distance range and the comment now says so explicitly.
- [x] [Review][Patch] A genuine 3-key tie (same `distanceKm` AND same `name`, decided only by `id`) was proven at the unit level only, never end-to-end — re-examined the constraint reasoning: `UNIQUE(name, telepules)` blocks an exact duplicate, but does NOT block the same name with a *different* `telepules` while sharing identical coordinates (buildable via direct `INSERT`, bypassing the seed/geocoding pipeline) — fixed: new integration test constructing exactly this case against real Postgres, confirming id-ascending order (and that it's not accidentally insertion-order).
- [x] [Review][Patch] `findAll()` had no `LIMIT`/pagination with no comment explaining it as a deliberate choice, unlike every other design decision in this file (NULL-omission, EPSILON rounding, code-unit comparison, static-SELECT exemption), which each get a paragraph of rationale — fixed: added a one-line comment.

**Dismissed (3, with reasoning):**
- The doc-comment wording "checking either is sufficient" (for the paired-nullness CHECK) technically described a single-field check while the code always checked both `lat`/`lon` — reworded while already editing this comment block for the NaN-guard fix above; not tracked as a separate finding since it was folded into the same edit.
- Raw-JSON substring assertions (`expect(rawBody).not.toContain('"budget":null')`) in the integration test are redundant with the `'budget' in obj` check just above them — harmless belt-and-suspenders, not a real problem, left as-is.
- No defensive type check on `pg`'s auto-parsed `lat`/`lon`/`budget` against a hypothetical future global `pg.types.setTypeParser` override — speculative (no such override exists anywhere in this codebase today, and adding one would be a deliberate, reviewable future change); the NaN/Infinity guard added above already covers the actual reachable failure mode (a stored `NaN` slipping past the CHECK constraint), which was the real, non-speculative gap.
