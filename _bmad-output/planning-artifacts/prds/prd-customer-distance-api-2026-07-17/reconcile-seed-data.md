---
title: Seed Data Reconciliation — Customer Distance API PRD
type: input-reconciliation
source_data: seed-customers.json (15 records)
target_doc: prd.md (Glossary, FR-1..FR-5)
generated: 2026-07-18
---

# Input Reconciliation: seed-customers.json vs prd.md

## 1. Full inventory of seed-customers.json

| # | name | budget | city | countryCode |
|---|------|--------|------|-------------|
| 1 | Anna Kovács | 850 | Budapest | HU |
| 2 | Lena Fischer | 950 | Vienna | AT |
| 3 | Jonas Weber | 300 | Munich | DE |
| 4 | Sofia Rossi | 1500 | Milan | IT |
| 5 | Diego Martín | 720 | Barcelona | ES |
| 6 | Lucas Dubois | 500 | Lyon | FR |
| 7 | Katarzyna Nowak | 380 | Kraków | PL |
| 8 | Petra Horáková | 640 | Prague | CZ |
| 9 | Isabella Silva | 560 | Lisbon | PT |
| 10 | Sanne de Vries | 1100 | Amsterdam | NL |
| 11 | Emma Andersson | 700 | Stockholm | SE |
| 12 | Matej Horvat | 450 | Ljubljana | SI |
| 13 | Elena Popescu | 820 | Bucharest | RO |
| 14 | Niamh O'Brien | 990 | Dublin | IE |
| 15 | Kristofer Nielsen | 1300 | Copenhagen | DK |

All 15 `name` values are distinct. All 15 `city` values are distinct. All 15 records carry `budget`, `note`, and `location.countryCode` — none of the "optional" columns (FR-1) is ever absent in the real seed.

## 2. City-name collision check (countryCode NOT in natural key / geocode key)

Cities present: Budapest, Vienna, Munich, Milan, Barcelona, Lyon, Kraków, Prague, Lisbon, Amsterdam, Stockholm, Ljubljana, Bucharest, Dublin, Copenhagen.

- Within the 15-record seed: **no two records share the same city name across different `countryCode`s** (all 15 city strings are pairwise distinct). So `UNIQUE(name, telepules)` and the country-code-free geocoding reference key are **not falsified** by the real data — the PRD's `[NOTE FOR PM]` in §7.2 ("a jelenlegi 15 elemű seedben nincs ütközés") checks out as literally true.
- This is a property of the curated dataset, not a structural guarantee. Real-world same-name-different-country pairs exist for city names of this style (e.g. Barcelona ES/VE, Valencia ES/VE, Cordoba ES/AR, Vienna AT/Vienna-VA-US) — none of those collisions happen to land in this seed, but the design (city-name-only key, no country disambiguation) would silently mis-resolve or ambiguously resolve such a pair if the reference or seed ever grows. The PRD already flags this residual risk and defers it ("revizitálandó, ha a referencia később bővül") — flagging here only to confirm the flag is warranted, not newly discovered.

## 3. "1 customer already in Budapest → distanceKm=0 exercised by real seed" claim

**Confirmed true.** Record #1, Anna Kovács, `location.city = "Budapest"`, `countryCode = "HU"`, is the only seed record with city Budapest. Since the Budapest reference coordinate is the distance origin (Glossary: "Budapest referencia-koordináta"), Anna Kovács's `distanceKm` will compute to `0.0` via the Haversine formula against herself-as-origin-city. The `/customers/by-distance` real-seed run does exercise the `distanceKm = 0` path exactly once, independent of the dedicated FR-9 unit test (Budapest–Budapest = 0 km) and the FR-11 integration-test assertion ("Budapest=0km eset"). No gap.

## 4. Diacritics / apostrophe / whitespace risk to `UNIQUE(name, telepules)` and normalization (FR-4)

- **Apostrophe**: `Niamh O'Brien` — a literal apostrophe inside a `name` value that will be part of the `UNIQUE(name, telepules)` upsert key (FR-2). This is a standard parameterized-query case (not a PRD defect), but it's the kind of value that breaks naive string-concatenated SQL or CSV-style tooling. Worth flagging as an implementation risk to carry into the architecture doc: the seed loader and any query layer touching `name` must use parameterized statements, not string interpolation.
- **Accented characters in `name`**: `Anna Kovács`, `Diego Martín`, `Petra Horáková` all contain diacritics. FR-4's diacritic-insensitive normalization is explicitly scoped to `telepules` only, not to `name` — this is consistent (the PRD never claims name is normalized), but means the natural key's uniqueness depends on the seed file being byte-for-byte stable across idempotent re-runs. Since the loader always re-reads the same `seed-customers.json`, this holds in practice; flagged only as a documented assumption, not a bug.
- **Accented city name already in source**: `Kraków` (with `ó`) is the one city given in local-diacritic form in the seed; all other cities (`Vienna`, `Munich`, `Prague`, `Lisbon`, `Copenhagen`, `Milan`) are plain-ASCII English exonyms rather than local-language forms (Wien, München, Praha, Lisboa, København, Milano). Two consequences worth noting:
  1. The bundled town-coordinate reference (FR-3) must be authored to match this seed file's specific naming convention (English exonym for most cities, Polish spelling for Kraków) — it is not a "canonical" city-name reference, it's a reference keyed to this exact dataset's strings.
  2. If the reference entry for Kraków is authored with the *same* `Kraków` spelling (diacritic included), then the real seed pass never actually exercises the "diacritic-insensitive" branch of FR-4's normalization — same situation as the FR-5 "unknown town" branch, which the PRD already acknowledges is not exercised by the real seed and defers coverage to a dedicated test fixture (FR-10: "Ékezet/kis-nagybetű/whitespace variánsok ... dedikált teszttel bizonyítva"). This is already mitigated at the test-planning level, just noting the real-seed pass alone would not prove diacritic normalization works.

## 5. Optional-column coverage gap

`budget`, `note`, and `countryCode` are modeled as optional/nullable columns (FR-1), but all 15 real seed records populate all three fields. The real seed therefore never exercises the "optional field absent" code path for these columns — same pattern as the FR-5 unknown-town branch, but not called out anywhere in the PRD (FR-5/FR-10's `[NOTE FOR PM]` only addresses the unknown-town/null-coordinate branch). Minor test-coverage gap: if "missing optional field" ingestion behavior matters, it too will need a dedicated fixture, not the real seed.

## Summary of findings

1. **No factual error found** in the PRD's core claims: no city-name collision exists in the real 15-record seed, and the Budapest `distanceKm=0` case is genuinely exercised by the real seed (via Anna Kovács). The `countryCode`-out-of-key design decision is safe for this dataset.
2. **Apostrophe in `Niamh O'Brien`** is a concrete data quirk that stresses the `UNIQUE(name, telepules)` natural key / upsert logic — should be carried forward as a "use parameterized queries" note into architecture, not currently mentioned in the PRD.
3. **Diacritic normalization (FR-4) may be under-exercised by the real seed** the same way the unknown-town branch is (already acknowledged by the PRD for FR-5, not explicitly acknowledged for FR-4/Kraków) — mitigated only if the dedicated FR-10 test fixture actually includes a diacritic-variant case, which the PRD does promise but is worth verifying at architecture/story time.
4. **Optional columns (`budget`, `note`, `countryCode`) are 100%-populated in the real seed**, so "field absent" behavior for those columns is untested by the real data — same class of gap as #3, not currently flagged anywhere in the PRD.
5. **City-name-only key/reference remains a residual, PRD-acknowledged risk** if the town reference or seed ever expands beyond these 15 curated, collision-free cities — no new information here, just confirms the PRD's own caveat is correctly scoped.
