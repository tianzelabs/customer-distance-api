---
baseline_commit: fd9dc19dc7f813227c7dec3f12555feeca957fb
---

# Story 2.1: Tiszta Haversine-függvény unit tesztekkel

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Mint fejlesztő,
egy tiszta Haversine-függvényt szeretnék a Budapest referenciakoordinátával,
hogy a távolságszámítás helyessége az API-tól függetlenül garantált legyen.

## Acceptance Criteria

1. **Given** a `src/services/haversine.ts` fájlban egy DB/HTTP-független, tiszta függvény, amely importálja a `BUDAPEST_REF`-et a `src/geocoding/townReference.ts`-ből, **when** Budapest és Bécs koordinátáit adjuk meg neki, **then** kb. 214 km-t ad vissza, ±1 km tolerancián belül. [Source: epics.md#Story 2.1; prd.md#FR-8, #FR-9; ARCHITECTURE-SPINE.md#AD-6, #AD-13]
2. **When** Budapest koordinátáit adjuk meg mindkét paraméterként, **then** a függvény 0 km-t ad vissza (pontosan). [Source: epics.md#Story 2.1; prd.md#FR-9]
3. **When** a függvény `null` koordinátát kap bemenetként (bármelyik paraméterben), **then** definiált módon kezeli — nem dob kivételt, `null`-t ad vissza. [Source: epics.md#Story 2.1; prd.md#FR-9]
4. A függvény kizárólag sík (`{lat, lon}`-alakú) argumentumokat vesz át és egy sima `number`-t (vagy `null`-t) ad vissza — nincs DB-kliens, HTTP- vagy egyéb I/O-függősége (AD-6). Nem hardcode-ol egy második, divergáló Budapest-koordinátát — a `BUDAPEST_REF`-et importálja (AD-13). [Source: ARCHITECTURE-SPINE.md#AD-6, #AD-13]
5. Unit tesztek (`test/unit/haversine.test.ts`) fedik pontosan az FR-9 három kötelező esetét (Budapest–Bécs ≈214 km ±1 km valós, a `townReference.ts`-ben már rögzített Bécs-koordinátával; Budapest–Budapest = 0 km; null-kezelés), és a projekt `npm test`/`npm run test:unit` parancsa ténylegesen lefut, minden teszt zölden. [Source: epics.md#Story 2.1; prd.md#FR-9; ARCHITECTURE-SPINE.md#Capability→Architecture Map FR-9 sor]

## Tasks / Subtasks

- [x] **Task 1 — `src/services/haversine.ts`: tiszta Haversine-függvény (AC: #1, #2, #3, #4)**
  - [x] Importáld a `BUDAPEST_REF` konstanst és a `TownCoordinate` típust a `../geocoding/townReference.js`-ből (ESM/`NodeNext` konvenció: explicit `.js` kiterjesztés a relatív TS importban — ld. Story 1.1/1.3 tanulsága).
  - [x] Definiáld a függvényt két, `TownCoordinate | null` típusú paraméterrel (`from`, `to`), ahol `to` alapértelmezett értéke `BUDAPEST_REF` (a domain-igény — FR-8 — mindig Budapesthez viszonyít; az alapértelmezett paraméter azt is kielégíti, hogy maga a `haversine.ts` fájl importálja és ténylegesen használja a `BUDAPEST_REF`-et, nem csak a jövőbeli hívó).
  - [x] Implementáld a szabvány Haversine-képletet (Föld sugár ≈ 6371 km), `Math.sin`/`Math.cos`/`Math.atan2`/`Math.sqrt`, fokból radiánba konvertálással.
  - [x] Ha `from === null` vagy a felbontott `to === null`, a függvény `null`-t ad vissza — nem dob kivételt.
  - [x] Ne implementálj kerekítést (1 tizedesjegyre kerekítés a válaszban — FR-8 "consequences" pont — a 2.4 story service-rétegének felelőssége, nem ezé a pure function-é).
  - [x] Ne hozz létre `src/services/customersService.ts`-t, ne nyúlj `src/app.ts`/`server.ts`/route-okhoz (2.2/2.3/2.4 hatóköre).

- [x] **Task 2 — Unit tesztek (AC: #5)**
  - [x] Hozd létre a `test/unit/haversine.test.ts`-t.
  - [x] Teszt: Budapest (`BUDAPEST_REF`) → Bécs (`townReference.ts` `vienna` bejegyzése, `{lat: 48.2082, lon: 16.3738}`) ≈ 214 km, ±1 km tolerancián belül (számított referenciaérték: ≈214.04 km — ellenőrizve független Python-implementációval a story-készítés során).
  - [x] Teszt: Budapest → Budapest (mindkét paraméter `BUDAPEST_REF`) === 0 (pontos egyenlőség, nem tolerancia-alapú).
  - [x] Teszt: `null` bemenet mindkét pozícióban (`from = null`, `to = null`, mindkettő `null`) → `null`-t ad vissza, nem dob kivételt.
  - [x] Kiegészítő józanság-tesztek (nem FR-9 kötelező eset, de olcsó és értékes): szimmetria (`haversine(A, B) === haversine(B, A)`); alapértelmezett `to` paraméter (`haversine(vienna)` ugyanazt adja, mint `haversine(vienna, BUDAPEST_REF)`); egy harmadik, független várospár (Budapest–München, `townReference.ts` `munich` bejegyzése) egy előre kiszámított, tolerált értékkel (≈561.15 km ±1 km).
  - [x] Futtasd: `npm run test:unit` — minden tesztnek zöldnek kell lennie; rögzítsd a valódi pass-számot a Dev Agent Record-ban.

- [x] **Task 3 — Story-dokumentáció és delivery (delivery norma, NFR7)**
  - [x] Frissítsd ezt a story fájlt: Tasks pipálása, Dev Agent Record kitöltése, Status `ready-for-dev` → `in-progress` → `review`.
  - [x] Frissítsd a `sprint-status.yaml`-t: `epic-2` `backlog` → `in-progress`; `2-1-tiszta-haversine-fuggveny-unit-tesztekkel` `backlog` → `ready-for-dev` → `in-progress` → `review`.
  - [x] Kis, fókuszált commitok: (1) story-fájl létrehozása, (2) `haversine.ts` implementáció + unit tesztek együtt (kicsi, kohéz egység — nincs értelme szétbontani implementáció és teszt között, mivel egyetlen fájlpár).

## Dev Notes

- **Előző story-k (1.1, 1.3) tanulságai, relevánsak erre a story-ra:**
  - ESM (`"type": "module"`), `NodeNext` modulrezolúció (1.1) — relatív TS→TS import explicit `.js` kiterjesztéssel: `import { BUDAPEST_REF } from '../geocoding/townReference.js'`.
  - Story 1.3 pontosan ezért hagyta tisztán, jól típusozottan exportálva a `BUDAPEST_REF`-et és a `TownCoordinate` interfészt — ez az első story, amely ténylegesen importálja őket (1.3 Dev Notes: "a 2.1 IMPORTÁLNI FOGJA a `BUDAPEST_REF`-et ebből a fájlból").
  - `tsconfig.json` `"strict": true` már érvényesül forráskódra (1.3 óta) — a Haversine-függvény típusai (`TownCoordinate | null`) explicit null-kezelést igényelnek fordítási időben is, nem csak futásidőben.
- **AD-6 (tiszta Haversine-függvény)** — a függvény kizárólag sík argumentumokat vesz át, sima `number | null`-t ad vissza, nincs DB/HTTP/I/O-függősége. [Source: ARCHITECTURE-SPINE.md#AD-6]
- **AD-13 (egyetlen `BUDAPEST_REF`)** — a `haversine.ts` importálja, nem definiál második másolatot. [Source: ARCHITECTURE-SPINE.md#AD-13]
- **Rétegződés (Consistency Conventions / AD-1)** — a `services/` réteg (Haversine, majd 2.4-ben `customersService.ts`) végzi a `distanceKm`-számítást, kerekítést, rendezést; a route-ok csak HTTP I/O-t végeznek; a repository csak SQL-t. Ez a story kizárólag a Haversine pure function-t adja — a kerekítés (1 tizedesjegy) és a rendezés a 2.4 story felelőssége, itt NEM implementálandó. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions, sor 41-42]
- **Signature-döntés `[ASSUMPTION]`:** a két Given/When/Then eset közül a második ("Budapest koordinátáit adjuk meg mindkét paraméterként") explicit két paramétert feltételez ("mindkét paraméterként" = "as both parameters"), tehát a függvény generikus, két-koordinátás (`from`, `to`), NEM egy Budapest-re fixált egyparaméteres függvény. Ugyanakkor az első Given-tagmondat explicit előírja, hogy maga a `haversine.ts` fájl importálja a `BUDAPEST_REF`-et — ezt egy `to: TownCoordinate | null = BUDAPEST_REF` alapértelmezett paraméterrel oldom fel: a függvény generikus marad (a tesztek explicit mindkét paramétert adhatják), de a valós domain-használat (2.4: `distanceKm` mindig Budapesthez viszonyítva, FR-8) `haversine(customerCoord)` alakban hívható majd, anélkül hogy a 2.4 service rétegnek külön kellene importálnia a `BUDAPEST_REF`-et (bár az AD-13 ezt is megengedné "any other consumer"-ként).
- **Bécs-koordináta forrása:** a `townReference.ts` `vienna` bejegyzése (`{lat: 48.2082, lon: 16.3738}`, Story 1.3-ban rögzítve) — a teszt ebből importál, NEM egy második, kézzel beírt Bécs-koordinátából, hogy a teszt ugyanazon az adaton alapuljon, amit az app ténylegesen használ (AD-13 szellemében, még ha AD-13 szó szerint csak Budapestről szól).
- **Tolerancia-számítás ellenőrzése:** Budapest (47.4979, 19.0402) → Bécs (48.2082, 16.3738) Haversine-távolság független Python-implementációval kiszámítva a story-készítés során: **214.044 km** — jól az FR-9 "≈214 km, ±1 km" elvárásán belül, nincs verzió-currency vagy adat-drift kockázat.
- **Kizárt ebből a story-ból (más story-k felelőssége — ne nyúlj bele):** `src/services/customersService.ts` (2.4 — `distanceKm` összeállítás, kerekítés, rendezés); `src/app.ts`/`server.ts`/route-ok (2.2/2.3/2.4); bármilyen HTTP-végpont.

### Project Structure Notes

- Alignment: `src/services/haversine.ts` pontosan megfelel az `ARCHITECTURE-SPINE.md#Structural Seed` bejegyzésének (`services/haversine.ts # pure Haversine distance function`). [Source: ARCHITECTURE-SPINE.md#Structural Seed]
- Alignment: `test/unit/haversine.test.ts` a `test/unit/` könyvtárban, pontosan a Structural Seed és a Capability→Architecture Map (FR-9 sor: "`test/unit/haversine.test.ts`") szerint.
- Nincs eltérés (variance) — ez a story szigorúan a `src/services/haversine.ts`-re és a hozzá tartozó unit tesztekre korlátozódik; nincs új npm-dependency, nincs meglévő fájl módosítása a `townReference.ts`-en kívüli importon túl.

### References

- [Source: epics.md#Story 2.1: Tiszta Haversine-függvény unit tesztekkel] — a story pontos Given/When/Then AC-jei
- [Source: epics.md#Epic 2: Verifiable Customer Distance API] — epic-szintű kontextus, FR/NFR/AD lefedettség
- [Source: prd.md#FR-8: Haversine-távolságszámítás] — a `distanceKm` Haversine-képlettel számítva, ügyfél-koordináta ↔ Budapest referencia-koordináta között; kerekítés a válaszban (2.4 felelőssége)
- [Source: prd.md#FR-9: Haversine unit tesztek] — a három kötelező teszteset (Budapest–Bécs ≈214 km ±1 km, Budapest–Budapest = 0 km, null-kezelés)
- [Source: ARCHITECTURE-SPINE.md#AD-6 — Pure Haversine function] — sík argumentumok, sima `number`/`null` visszatérés, nincs I/O-függőség
- [Source: ARCHITECTURE-SPINE.md#AD-13 — Single Budapest reference coordinate] — egyetlen `BUDAPEST_REF`, `haversine.ts` importálja
- [Source: ARCHITECTURE-SPINE.md#Consistency Conventions, sor 41-42] — rétegződési szabály: service végzi a `distanceKm`-számítást/kerekítést/rendezést, route csak HTTP I/O
- [Source: ARCHITECTURE-SPINE.md#Structural Seed] — `src/services/haversine.ts` fájlhely, `test/unit/` teszt-könyvtár
- [Source: ARCHITECTURE-SPINE.md#Capability→Architecture Map, FR-8/FR-9 sorok]
- [Source: 1-3-offline-telepules-koordinata-referencia-es-normalizetown.md#Dev Notes] — ESM/`NodeNext` explicit `.js` import-kiterjesztés konvenció; `BUDAPEST_REF`/`TownCoordinate` export szerződés, amit ez a story importál
- `src/geocoding/townReference.ts` (repo, Story 1.3-ban létrehozva) — `BUDAPEST_REF`, `TownCoordinate`, `vienna`/`munich` bejegyzések pontos koordinátái

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code, bmad-dev-story workflow, autonomous mode)

### Debug Log References

- Independent Python Haversine cross-check (story-creation time, R=6371 km): Budapest↔Vienna = 214.044 km; Budapest↔Munich = 561.152 km — used to set the test tolerances in `haversine.test.ts` (±1 km each) without relying on memorized real-world figures.
- `npx tsc --noEmit` after writing `src/services/haversine.ts` — clean, no type errors (`TownCoordinate | null` default-parameter typing checked out under `strict: true`).
- `npm run test:unit` (`vitest run test/unit`) executed for real: **4 test files passed, 44 tests passed** (38 pre-existing + 6 new in `haversine.test.ts`), ~192ms duration.
- `npm test` (`vitest run`, unit+integration together, real Postgres running on port 5433 via `docker ps`) executed for real: **5 test files passed, 47 tests passed** (44 unit + 3 integration in `test/integration/seed.test.ts`), ~242ms duration. Confirms this story's addition did not regress the integration suite.
  ```
  RUN  v4.1.10 .../customer-distance-api
   Test Files  5 passed (5)
        Tests  47 passed (47)
     Start at  13:40:13
     Duration  242ms
  ```

### Completion Notes List

- AC #1/#4 verified: `src/services/haversine.ts` is a pure function (`TownCoordinate | null` in, `number | null` out), no DB/HTTP/I/O import — only `../geocoding/townReference.js` for `BUDAPEST_REF`/`TownCoordinate` (AD-6, AD-13). `npx tsc --noEmit` clean.
- AC #1 verified with the project's own Vienna coordinate (`townReference.ts`'s `vienna` entry, `{lat: 48.2082, lon: 16.3738}`, not a second hand-typed copy): Budapest↔Vienna = 214.044 km, well inside the ±1 km tolerance test (asserted as `[213, 215]`).
- AC #2 verified: `haversineDistanceKm(BUDAPEST_REF, BUDAPEST_REF)` returns exactly `0` (exact equality, not a tolerance range).
- AC #3 verified: `null` in either position (`from`, `to`, or both) returns `null` and does not throw — tested with `expect(...).not.toThrow()` plus `toBeNull()`, three separate call shapes.
- AC #4 / AD-13 verified: the file imports `BUDAPEST_REF` (used as the `to` parameter's default value) rather than redefining a Budapest coordinate. `[ASSUMPTION]` documented in Dev Notes: the function stays generic/two-argument (required by AC #2's "as both parameters" phrasing) while still satisfying the "the file imports BUDAPEST_REF" Given-clause via a default parameter — this also means Story 2.4's `customersService.ts` can call `haversineDistanceKm(customerCoord)` without needing its own `BUDAPEST_REF` import.
- AC #5 verified: `test/unit/haversine.test.ts` covers exactly FR-9's three required cases plus three low-cost sanity checks (symmetry, default-parameter equivalence, an independent third city pair Budapest↔Munich with a pre-computed ±1 km tolerance). `npm run test:unit` — **44/44 passing**; full-suite `npm test` — **47/47 passing** (real Postgres, no regression).
- Scope discipline: did not create `src/services/customersService.ts`, did not touch `src/app.ts`/`server.ts`/routes (2.2/2.3/2.4's scope), did not implement response rounding or sorting (2.4's scope — this function returns the raw float).
- `src/services/.gitkeep` removed (superseded by the real `haversine.ts`, same pattern as Story 1.3's `test/unit/.gitkeep` removal).

### File List

**New:**
- `src/services/haversine.ts`
- `test/unit/haversine.test.ts`

**Modified:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (`epic-2`: `backlog` → `in-progress`; `2-1-tiszta-haversine-fuggveny-unit-tesztekkel`: `backlog` → `ready-for-dev` → `in-progress` → `review`; `last_updated: 2026-07-19`)

**Removed:**
- `src/services/.gitkeep` (superseded by the real `haversine.ts`)

### Change Log

- 2026-07-19: Story created (`bmad-create-story` workflow), Status `ready-for-dev`.
- 2026-07-19: Story implemented (`bmad-dev-story` workflow, autonomous mode) — Tasks 1-3 completed. `src/services/haversine.ts` (generic two-coordinate Haversine function with `BUDAPEST_REF`-defaulted second parameter) and `test/unit/haversine.test.ts` (6 tests: 3 FR-9-required + 3 sanity checks, using real project coordinates) implemented and run for real (44/44 unit, 47/47 full suite). All 5 ACs verified. Status `in-progress` → `review`.
- 2026-07-19: Code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor) — Acceptance Auditor independently recomputed the Haversine formula from scratch and confirmed both real-world distance claims (Budapest-Vienna 214.044km, Budapest-Munich 561.152km) are correct, and caught a test-count bookkeeping error in this Dev Agent Record (now fixed above: 38+6=44, not 35+9). 2 patches applied to the implementation (FP-safety clamp, JSDoc), 11 dismissed (matched established anti-over-engineering precedent or unreachable by this app's actual data domain). 47/47 tests still passing after fixes. Status `done`.

### Review Findings

- [x] [Review][Patch] Classic Haversine floating-point failure mode near antipodal points: `a` can round to fractionally above 1, making `1 - a` negative and `Math.sqrt` return `NaN` [src/services/haversine.ts] — fixed: both `Math.sqrt` calls now clamp their argument to `Math.max(0, ...)`. Not reachable by this app's actual data (15 European cities, nowhere near antipodal), but the fix is free and standard practice for Haversine implementations.
- [x] [Review][Patch] No documentation of: why `EARTH_RADIUS_KM = 6371` (mean-radius approximation, accuracy ceiling), the `0` (real distance) vs `null` (invalid input) footgun for a naive `if (!distance)` caller check, or the `to` parameter's null-vs-omitted behavioral fork — fixed: JSDoc expanded to cover all three.
- [x] [Review][Patch] (Acceptance Auditor) Dev Agent Record and Change Log miscounted the new tests as "9 (3 FR-9 + 3 sanity)" when `haversine.test.ts` actually has 6 `it()` blocks (38 pre-existing + 6 new = 44, not 35+9) — fixed: both entries corrected above. Headline pass counts (44/44, 47/47) were already correct; only the internal breakdown was wrong.

**Dismissed (11, with reasoning):**
- No validation of out-of-range/NaN coordinate fields — consistent with precedent already established across Stories 1.2/1.4's reviews: the only real caller path is this app's own `townReference.ts` (frozen, hand-verified literals), not external/user input; AD-10 anti-over-engineering.
- Loose (`==`) vs strict (`===`) null check not handling `undefined` — this codebase is strictly typed (`TownCoordinate | null`, never `| undefined`); TypeScript itself prevents passing `undefined` from any internal caller.
- Tests couple to `townReference.ts`'s real data rather than hardcoded literals — this is the project's own established, deliberate testing convention (already used in Stories 1.3/1.4: "reuse the exact coordinates the app actually looks up"), not a defect.
- Non-null assertions (`!`) on test-time lookups could throw a cryptic error if a town were ever removed from the reference table — low-value hypothetical, matches precedent for dismissed test-code defensive concerns.
- Tolerance-based assertions (±1-2km) could theoretically mask a systematic error — resolved in practice: the Acceptance Auditor independently recomputed the formula from scratch and confirmed both distances to 3 decimal places.
- No test near the antimeridian/poles — this app's data domain is 15 European cities; not reachable, disproportionate to test.
- No component-isolated tests (pure-`dLat`-only, pure-`dLon`-only cases) — FR-9's three required cases are covered and independently verified correct; additional coverage is nice-to-have beyond spec.
- "Exactly 0"/symmetric tests relying on unstated floating-point guarantees — true but not a practical risk for the current formula shape; no action needed.
