# Input Reconciliation: source-homework-spec.md vs prd.md

Date: 2026-07-18
Scope: Read-only verification that every requirement, constraint, and decision in the
source homework spec (verbatim spec + "Kiegészítő döntések" conversational decisions)
is represented somewhere in prd.md.

## Method

Went through the source document top to bottom in two passes — (1) the verbatim
homework spec (ADAT / ADATMODELL / BETÖLTÉS / VÉGPONTOK / TESZT / MINŐSÉG / LEADANDÓ),
(2) the "Kiegészítő döntések" list — and located the corresponding PRD section for
each item. Also grepped prd.md for specific terms to confirm absence where a gap was
suspected, rather than relying on visual scan alone.

## Coverage Table — Verbatim Homework Spec

| Source item | PRD location | Status |
|---|---|---|
| Small, self-contained REST service over Postgres, offline (no external geocoder/LLM at runtime) | §1 Vision | Covered |
| Seed data in seed-customers.json, 15 customers (name, budget, location.city, location.countryCode, note); location.city = telepules | §4 Glossary (Customer, Település) | Covered |
| customers table: id, name, telepules, lat (nullable), lon (nullable); budget/note storable but not required | FR-1 | Covered |
| Idempotent seed load, run twice → no duplication | FR-2 | Covered |
| lat/lon assigned from local bundled telepules→lat/lon reference; no external geocoder call | FR-3 | Covered |
| Town matching accent/case/whitespace-independent | FR-4 | Covered |
| Plain "Budapest" (and optionally districts) maps to the capital | FR-4 | Covered |
| Unknown town → lat/lon = null, warning log, process does not stop | FR-5 | Covered |
| GET /customers/count → { "count": <int> } | FR-6 | Covered, exact response shape preserved |
| GET /customers/by-distance → list ascending by Budapest distance | FR-7 | Covered |
| Every element has distanceKm, rounded to 1 decimal | FR-7, FR-8 | Covered |
| Budapest customers first, 0 km | FR-7 | Covered |
| Unknown-coordinate customers at end of list, distanceKm: null | FR-7 | Covered |
| Tie-break by name | FR-7 | Covered |
| Haversine unit test: Budapest–Vienna ≈ 214 km | FR-9 | Covered (with ±1 km tolerance added per decisions) |
| Haversine unit test: Budapest–Budapest = 0 km | FR-9 | Covered |
| Haversine unit test: null coordinate handling | FR-9 | Covered |
| MINŐSÉG: Kis, fókuszált commitok (small, focused commits) | — | **GAP — not present anywhere in prd.md** |
| MINŐSÉG: README covers Postgres start, migration, seed, server, tests | FR-14 | Covered (also extended to stop/volume-delete per decisions) |
| MINŐSÉG: PostgreSQL MCP wired up and used for schema/data checks | FR-13 | Covered |
| LEADANDÓ: solution on separate harness/bmad branch | §2 Evaluation Context | Covered |
| LEADANDÓ: full BMAD planning+implementation chain preserved | §2 Evaluation Context | Covered |
| LEADANDÓ: only run the PRD workflow for now | §2 Evaluation Context | Covered |
| LEADANDÓ: do not start writing implementation code | §2 Evaluation Context | Covered |

## Coverage Table — Kiegészítő döntések (conversational decisions)

| Decision | PRD location | Status |
|---|---|---|
| Vision and Evaluation Context in separate sections | §1 vs §2 | Covered |
| Unknown-town handling is mandatory but expected inactive on real 15-city seed; must be proven by dedicated test/fixture, not by normal seed outcome | FR-5 `[NOTE FOR PM]`, FR-10 | Covered |
| JTBD priority order (1–5) | §3.1 | Covered, order matches exactly |
| Glossary +2: Budapest reference coordinate (fixed app constant, not from a customer record); Real DB record count (from real DB query, not hardcoded, not seed file length) | §4 Glossary | Covered, both entries present with matching wording |
| Település-koordináta reference used only by seed process; query endpoints read stored lat/lon, do not re-geocode | §4 Glossary, FR-3 | Covered |
| Features split into 5 clusters (F1–F5) to support future epic/story breakdown **and focused commits** | §5 (F1–F5 exist) | **Partially covered** — the F1–F5 structure exists, but the stated rationale ("to support ... focused commits") is not written anywhere; ties to the commit-norm gap above |
| FR-2 natural key: UNIQUE(name, telepules); countryCode storable, not part of key, not required | FR-1, FR-2 | Covered |
| FR-7 sort order: non-null distanceKm ascending first, then null distanceKm at end, name-ascending tie-break within each group, app- or SQL-side but deterministic | FR-7 | Covered, precise match |
| FR-7 response fields: full stored customer record (id, name, telepules, lat, lon) + distanceKm; budget/note/countryCode included if stored but not a mandatory acceptance criterion | FR-7 | Covered, precise match |
| FR-12/FR-14: Docker Compose is the official local Postgres mechanism; README covers up -d, migration, seed, server, tests, stop/volume-delete | FR-12, FR-14 | Covered |
| Haversine tolerance: Budapest–Vienna ≈ 214 km, ±1 km, fixed | FR-9 | Covered, exact figure preserved |
| Budapest districts: plain "Budapest" suffices for normal seed; normalization may optionally fold district notations ("Budapest XIII.", "Budapest 13", "Budapest, XI. kerület") to the central reference; not required; no per-district reference entry needed | FR-4 | Covered, same examples reproduced verbatim |
| Település reference size: MVP = only the 15 seed cities + Budapest reference coordinate; not a general city database | FR-3 | Covered |
| SM-1 clarification: not "one test per FR" but "every critical acceptance criterion proven by automated test or reproducible verification step"; MCP usage (FR-13) needs documented config + one documented check, no automated test required | §8 SM-1 | Covered, precise match |
| SM-2 "clean machine" reproducibility: via README, given Node.js/Docker/npm, no external service | §8 SM-2 | Covered |

## Gaps Found

### 1. "Kis, fókuszált commitok" (small, focused commits) — dropped entirely
The source homework spec lists this as an explicit MINŐSÉG (quality) bullet, and the
"Kiegészítő döntések" section explicitly ties the F1–F5 feature-cluster breakdown to
"a jövőbeli epic/story-bontás **és fókuszált commitok** támogatására" (supporting
future epic/story breakdown *and* focused commits). A grep of prd.md for
`commit|fókusz|focused` returns zero matches. This is exactly the kind of
qualitative/process norm that a rigid FR structure tends to silently drop, because it
isn't independently testable as a product-behavior FR — but it was an explicit,
named requirement in both the original spec and the conversational decisions, and it
currently has no home in the PRD (not in Non-Goals, not in F5's delivery/process
cluster, not as a footnote under §5's intro, not in Success Metrics). Recommend
adding it as a brief delivery-norm note, most naturally near F5 (Fejlesztői futtatás
és ellenőrizhetőség) or as a line in §2 Evaluation Context, since it's a process
expectation tied to the BMAD/commit-history evaluation, not a testable product FR.

## Non-Gaps Verified (worth noting as "checked, fine")

- Numeric tolerances (Budapest–Vienna ≈214 km ±1 km), rounding (1 decimal on
  distanceKm), and the exact response shape (`{ "count": <int> }`) all carry through
  precisely, with no drift in precision or phrasing.
- Sort-order semantics (non-null-first ascending, null-last, name tie-break within
  each group, deterministic regardless of app/SQL implementation) match the source
  decision almost word-for-word in FR-7.
- The natural key (UNIQUE(name, telepules), countryCode excluded) is consistent
  across FR-1 and FR-2.
- Glossary's two added concepts (Budapest reference coordinate, real DB record count)
  are both present with matching intent.
- SM-1's "not one test per FR" clarification and SM-2's clean-machine reproducibility
  statement are both reproduced with correct nuance (including the MCP
  documented-check-suffices carve-out).
- Budapest district-folding examples are reproduced verbatim (same three example
  strings) rather than paraphrased or generalized.

## Conclusion

Coverage is close to complete and generally high-fidelity — no numeric, structural,
or sort-order detail was found to be lost or paraphrased incorrectly. The one
substantive gap is the qualitative "kis, fókuszált commitok" delivery norm, which is
absent from prd.md despite being an explicit bullet in the source spec and reinforced
in the conversational decisions as a stated rationale for the F1–F5 feature-cluster
split.
