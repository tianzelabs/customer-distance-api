# Implementation Readiness Assessment Report

**Date:** 2026-07-18
**Project:** Customer Distance API
**Assessor:** BMAD Implementation Readiness workflow (Fast-path / autonomous mode)

**Documents assessed:**
- PRD: `_bmad-output/planning-artifacts/prds/prd-customer-distance-api-2026-07-17/prd.md` (status: final)
- PRD Addendum: `_bmad-output/planning-artifacts/prds/prd-customer-distance-api-2026-07-17/addendum.md`
- Architecture Spine: `_bmad-output/planning-artifacts/architecture/architecture-customer-distance-api-2026-07-18/ARCHITECTURE-SPINE.md` (status: final)
- Epics/Stories: `_bmad-output/planning-artifacts/epics.md` (3 epics, 10 stories)

Note: Document discovery (step 1) and UX alignment (step 4) were skipped per assignment — discovery inputs were pre-supplied, and this is a backend-only REST API with no UI/UX artifact, so UX Alignment is **not applicable** and is omitted below rather than left blank.

---

## PRD Analysis

### Functional Requirements

FR-1: Customers tábla migrációval — `customers` table via a runnable migration; PK `id`, required `name`/`telepules`, nullable `lat`/`lon`; optional `budget`/`note`/`countryCode`; `UNIQUE(name, telepules)`; migration re-runnable without error/duplication.

FR-2: seed-customers.json idempotens betöltése — idempotent load of `seed-customers.json` into `customers`; natural key `name`+`telepules`; upsert semantics; parameterized queries only.

FR-3: Offline település-koordináta hozzárendelés — assigns `lat`/`lon` from a local, static, versioned town→coordinate reference at seed time only; no external geocoding call; reference covers exactly the 15 seed towns + Budapest.

FR-4: Településnév-normalizálás — diacritic-, case-, and whitespace-insensitive matching between `telepules` and reference keys; optional (non-mandatory) Budapest-district folding.

FR-5: Ismeretlen település kezelése — unmatched `telepules` → `lat`/`lon` = null, warning log, seed does not halt.

FR-6: GET /customers/count — returns `{"count": <int>}` from a real `SELECT COUNT(*)`, never hardcoded or seed-file length.

FR-7: GET /customers/by-distance — full stored record + computed `distanceKm` (1 decimal or null); sort: non-null ascending distance first (Budapest/districts at 0.0), null-distance last, name-ascending tiebreak within each group; deterministic output.

FR-8: Haversine-távolságszámítás — `distanceKm` computed via Haversine against a fixed Budapest reference constant, rounded to 1 decimal.

FR-9: Haversine unit tesztek — Budapest–Vienna ≈214km ±1km, Budapest–Budapest = 0km, null-coordinate handled without throwing.

FR-10: Normalizálási és edge-case tesztek — dedicated fixture covering accented/unaccented match, case, whitespace, unknown town (FR-5 branch, via fixture not real seed), null coordinate, Budapest-district folding (if implemented); idempotent-seed re-run test.

FR-11: Végpont-integrációs tesztek valódi PostgreSQL ellen — real (non-mocked) Postgres integration tests for both endpoints; `by-distance` covers 0km case, name tiebreak, unknown-town-at-end with null.

FR-12: Reprodukálható lokális Postgres indítás — single documented command (`docker compose up -d`) starts local Postgres.

FR-13: PostgreSQL MCP séma- és adatellenőrzés — working Postgres MCP config in repo; developer can inspect `customers` schema and spot-check seeded rows via MCP; dev-time tooling, not runtime API behavior.

FR-14: README a teljes futtatási folyamathoz — README documents the full copy-pasteable path: compose up, migrate, seed, server start, tests, teardown; current one-line stub must be replaced.

**Total FRs: 14**

### Non-Functional Requirements

The PRD itself does **not** contain a separately labeled "Non-Functional Requirements" section (no `NFR-#` numbering appears in `prd.md`). NFR-equivalent content exists but is distributed across §2 (Evaluation Context — delivery norm), §6 (Non-Goals — offline-only, no auth, read-only, no multi-tenant), §8 (Success Metrics — SM-2 reproducibility), and `addendum.md` (parameterized queries). `epics.md` correctly reverse-engineered and numbered these as NFR1–NFR8 with source citations. Restating them here as extracted from the PRD/addendum (not from epics.md, to keep this step independent):

NFR1: Offline-only — no external geocoding API or runtime LLM call anywhere (PRD §1, §6, §2).
NFR2: No authentication/authorization — local, developer/evaluator-only API (PRD §6).
NFR3: Read-only API surface — only two GET endpoints; seed is the sole writer (PRD §6, §7.2).
NFR4: All dynamic-value DB operations must use parameterized queries; string concatenation forbidden (addendum.md, motivated by `Niamh O'Brien`'s apostrophe).
NFR5: Delivery via small, focused, traceable commits — no single all-encompassing final commit (PRD §2).
NFR6: Full stack must be reproducible via README on a clean machine given Node.js/Docker/npm (PRD SM-2).

**Total NFRs (PRD-derivable): 6.** (`epics.md`'s NFR5 "centralized error handling" and NFR6 "config fail-fast" — renumbered NFR5/NFR6 here as NFR7/NFR8 in epics.md's own scheme — are traced only to Architecture AD-8/AD-9, not to any explicit PRD sentence; see Epic Quality Review finding below.)

### Additional Requirements

- Glossary (§4) formally defines 10 domain terms (Customer, Település, Település-koordináta referencia, Normalizált településnév, Ismeretlen település, Idempotens betöltés, Budapest referencia-koordináta, Haversine-távolság, distanceKm, Holtverseny) — unusually rigorous for a homework-scale PRD and directly supports FR testability.
- §9 Open Questions is explicitly closed — all three prior open points (Haversine tolerance, Budapest district handling, reference size) resolved into FR-9/FR-4/FR-3.
- §10 Decision/PM Notes Index gives explicit traceability for every `[NOTE FOR PM]` callout, with no unresolved `[ASSUMPTION]` remaining at PRD close.
- `addendum.md` (technical-how content) is explicitly out of FR scope but is bound into the Architecture Spine (AD-2) — correctly kept in lockstep per both documents' own text.

### PRD Completeness Assessment

The PRD is unusually thorough for its scale: every FR carries a "Consequences (testable)" block, so none of FR-1–FR-14 reads as vague or unverifiable — this is a genuine strength, not a checkbox exercise (e.g., FR-7's sort rule and FR-13's "dev-time tooling, not runtime behavior" framing are both precise enough to eliminate ambiguity at implementation time). Non-Goals (§6) are explicit and are correctly treated as permanent exclusions rather than deferred work (§10 vs. Architecture "Deferred" section keep this distinction clean).

The one structural weakness is the lack of a labeled NFR section — NFRs are present in substance (Non-Goals, Evaluation Context, addendum) but require synthesis to number and cite, which was correctly done in `epics.md` but is not reproducible from the PRD alone without cross-referencing three documents. This is a minor documentation-quality gap, not a content gap.

---

## Epic Coverage Validation

### Coverage Matrix

| FR | PRD Requirement (short) | Epic Coverage | Status |
|---|---|---|---|
| FR-1 | `customers` table + migration | Epic 1 → Story 1.2 | ✓ Covered |
| FR-2 | Idempotent seed load | Epic 1 → Story 1.4 | ✓ Covered |
| FR-3 | Offline town→coordinate assignment | Epic 1 → Story 1.3 | ✓ Covered |
| FR-4 | Town-name normalization | Epic 1 → Story 1.3 | ✓ Covered |
| FR-5 | Unknown-town handling | Epic 1 → Story 1.4 | ✓ Covered |
| FR-6 | `GET /customers/count` | Epic 2 → Story 2.3 | ✓ Covered |
| FR-7 | `GET /customers/by-distance` | Epic 2 → Story 2.4 | ✓ Covered |
| FR-8 | Haversine calculation | Epic 2 → Story 2.1 | ✓ Covered |
| FR-9 | Haversine unit tests | Epic 2 → Story 2.1 | ✓ Covered |
| FR-10 | Normalization/edge-case tests | Epic 1 → Stories 1.3, 1.4 | ✓ Covered |
| FR-11 | Endpoint integration tests | Epic 2 → Stories 2.3, 2.4 | ✓ Covered |
| FR-12 | Reproducible local Postgres | Epic 1 → Story 1.1 | ✓ Covered |
| FR-13 | Postgres MCP dev-check | Epic 1 → Story 1.5 | ✓ Covered (see quality note on unresolved package choice) |
| FR-14 | README end-to-end doc | Epic 3 → Story 3.1 | ✓ Covered |

### Missing Requirements

None. All 14 PRD FRs have a traceable story. No FR is claimed in `epics.md` that does not exist in the PRD (no scope creep at the FR level — the "Additional Requirements" section in `epics.md` correctly quarantines architecture-only concerns like stack pins and AD rules rather than inventing new product FRs).

FR-10 and FR-9 are split across two epics relative to the PRD's single "F4 — Tesztelés és verifikáció" feature grouping (FR-9 haversine tests → Epic 2, FR-10 normalization tests → Epic 1). This is **not** a coverage defect — co-locating each test with the epic that implements the tested behavior is the correct pattern (a standalone "testing epic" would itself be flagged as a technical, non-user-value epic under step-05).

### Coverage Statistics

- Total PRD FRs: 14
- FRs covered in epics: 14
- Coverage percentage: **100%**
- Orphaned FRs (in PRD, absent from epics): 0
- Invented FRs (in epics, absent from PRD): 0

---

## UX Alignment

**Not applicable.** This is a backend-only REST API (two `GET` endpoints, no UI, no client application — PRD §6 Non-Goals explicitly excludes any UI/client). No UX design document exists or is expected. `epics.md` itself confirms this ("No UX design document exists... the UX Design Requirements section is not applicable"). This assessment step is omitted rather than scored.

---

## Epic Quality Review

### Epic Structure Validation

**A. User Value Focus**

| Epic | Title | Verdict |
|---|---|---|
| Epic 1 | Reproducible Local Data Foundation | Borderline-acceptable. Framed around a developer/evaluator persona verifying the data layer directly (MCP/psql), which tracks PRD JTBD #1–#2 exactly. Not a bare technical milestone ("Setup Database"), but it is infrastructure-flavored and delivers no externally-observable product behavior until Epic 2 exists. Acceptable given this is a backend-only homework API where "the evaluator inspecting the DB" is a legitimate stated user journey, not a rationalization. |
| Epic 2 | Verifiable Customer Distance API | Clear user value — client gets correct, sorted, tested distance data. |
| Epic 3 | End-to-End Reproducibility & Delivery Readiness | Clear user value — evaluator can stand up and verify the whole system from README alone. |

**B. Epic Independence**

- Epic 1 claims to stand alone "without the query API existing yet" — **partially contradicted**, see Major finding below (Epic 1's seed script depends on infrastructure modules whose creation is formally specified only in Epic 2 Story 2.2).
- Epic 2 depends on Epic 1's output (seeded DB) — expected backward dependency, not a violation.
- Epic 3 depends on Epic 1 & 2 — expected and explicit ("Given a projekt minden korábbi story-ja (Epic 1, Epic 2) elkészült"), not a violation.
- No circular dependencies found.

### Story Quality Assessment

**A. Story Sizing**

- All 10 stories deliver a coherent, independently-verifiable increment and use consistent Given/When/Then structure.
- Story 1.1 is comparatively large (project init + TS pin + two-database Docker Compose topology + full directory skeleton + env documentation) — acceptable at this project's scale, but a candidate for splitting if this were a larger codebase. **Minor.**

**B. Acceptance Criteria Review**

- Format: consistently Given/When/Then across all 10 stories.
- Testability: every AC observed is independently verifiable (specific response shapes, specific status codes, specific numeric tolerances e.g. "≈214 km ±1 km").
- Error-path coverage: present where relevant (Story 2.2 covers missing-env fail-fast and the fixed 500 error shape; Story 1.4 covers the unknown-town branch without halting).
- No vague criteria ("user can query") were found — all ACs specify exact response fields, sort order, and status codes.

### Dependency Analysis

**A. Within-Epic Dependencies**

- Epic 1: 1.1 → 1.2 (needs running Postgres) → 1.3 (independent of 1.2, needs only 1.1's skeleton) → 1.4 (needs 1.2's schema + 1.3's `normalizeTown`) → 1.5 (needs 1.2+1.4's migrated/seeded DB). No forward references within the epic.
- Epic 2: 2.1 (pure function, no dependency) → 2.2 (app scaffold) → 2.3 (needs 2.2 + Epic 1's seeded DB) → 2.4 (needs 2.1 + 2.2 + Epic 1's seeded DB). No forward references within the epic.
- Epic 3: single story, depends only on prior epics. No issue.

**B. Cross-Epic Infrastructure Gap (Major finding — see below).**

**C. Database/Entity Creation Timing**

- Single table (`customers`), created in Story 1.2, exactly when first needed (before the seed script in 1.4 needs it to exist). No "create all tables upfront" violation — there's only one table, and it's correctly sequenced.

### Special Implementation Checks

**A. Starter Template** — Architecture Spine names no starter template; `epics.md` correctly flags this via `[ASSUMPTION]` and Story 1.1 does manual `package.json`/`tsconfig`/directory-skeleton initialization rather than a `create-*` CLI. Correct handling.

**B. Greenfield Indicators** — Initial project setup (1.1), env configuration (1.1/2.2), and local reproducibility (Epic 3) are all present. No CI/CD pipeline story exists, but the Architecture Spine's own "Deferred" section explicitly excludes CI from this session's scope ("homework scope requires only local reproducibility") — consistent, not a gap.

### Findings by Severity

#### 🟠 Major

1. **Epic 1 has an unstated dependency on Epic 2 Story 2.2's deliverables, contradicting its own independence claim.** Story 1.4 (idempotent seed script) requires a working `src/db/pool.ts` (AD-3) reading `DATABASE_URL`, and by extension `src/config/env.ts` (AD-9) for fail-fast config validation — both needed simply to connect to Postgres and run the seed. Story 1.5 (MCP check) and Story 1.2 (migration, if driven through app tooling rather than the bare `node-pg-migrate` CLI) similarly presuppose working DB connectivity. However, the only story anywhere in `epics.md` with an explicit acceptance criterion for creating/validating `src/config/env.ts`'s fail-fast behavior is **Story 2.2**, in Epic 2 — sequenced *after* Epic 1. No story in Epic 1 has an AC that says "`src/db/pool.ts` is created and exports a `Pool` built from `DATABASE_URL`." Epic 1's own framing — "verifiable directly against the database... without the query API existing yet" — is therefore only true for the *verification* step (Story 1.5, MCP/psql), not for the *seed* step (Story 1.4), which silently assumes infrastructure that the epic breakdown assigns to Epic 2. This is a forward-reference / missing-AC gap per the epic-independence rule ("Epic N cannot require Epic N+1 to work"). Practically low-risk (any developer will trivially write a 5-line `pool.ts` while implementing Story 1.4), but it is a real documentation/sequencing defect that a rigorous story-writer should close before a developer starts Epic 1: either add an explicit AC to Story 1.1 or 1.4 for creating `src/db/pool.ts` (and a minimal `src/config/env.ts` DATABASE_URL read), or explicitly note in Story 2.2 that it *extends* an env.ts/pool.ts created earlier rather than originating them.

2. **A Deferred architectural decision was not actually resolved at the epic/story level as promised.** `ARCHITECTURE-SPINE.md`'s "Deferred" section states: "Which specific Postgres MCP server package `.mcp.json` references... resolve at epic/story level." Story 1.5 (`epics.md`) configures `.mcp.json` but never names a concrete package — it only re-describes AD-11's requirements (env-var-sourced connection, no committed secret) without picking a package. The deferred decision is still open at the end of epic/story planning, one level later than the architecture explicitly promised it would be resolved.

#### 🟡 Minor

3. **NFR traceability gap for two architecture-originated NFRs.** `epics.md`'s NFR5 (centralized error handling) and NFR6 (config fail-fast) are cited only to Architecture AD-8/AD-9, with no corresponding explicit sentence in the PRD. These are reasonable, low-risk engineering additions (neither adds product-visible scope, both are consistent with PRD Non-Goals), but strict FR/NFR traceability back to the PRD is broken for these two items — worth a one-line PRD note if traceability purity matters for the BMAD-vs-Superpowers comparison (PRD §2's own stated meta-goal).

4. **NFR5 "small, focused commits" has no operationalizing AC anywhere.** It's listed as a cross-cutting NFR for Epic 3 but no story's acceptance criteria reference commit granularity — understandable since it's a process norm rather than runtime behavior, but it means nothing in the epics document actually gates or verifies it.

5. **PRD lacks a labeled NFR section** (see PRD Completeness Assessment above) — substance is present but scattered across §2/§6/§8/addendum, requiring synthesis that only `epics.md` performed.

6. **Story 1.1 is oversized relative to the other 9 stories** (project scaffold + two-DB Docker topology + TS pin + full directory skeleton + env docs in one story) — acceptable at homework scale, flagged only as a sizing observation.

7. **Sort tiebreak in Architecture/epics extends PRD FR-7.** The Architecture Spine's runtime-flow diagram and Story 2.4's AC add an `id`-ascending third tiebreak after `distanceKm`/`name`, which PRD FR-7 does not specify (PRD only defines `distanceKm` then `name`). Harmless determinism hardening (name collisions are unlikely given the `UNIQUE(name, telepules)` constraint), not a conflict, but technically an architecture-introduced behavior beyond the literal PRD text.

### Best Practices Compliance Checklist

| Check | Epic 1 | Epic 2 | Epic 3 |
|---|---|---|---|
| Epic delivers user value | ✓ (borderline, justified) | ✓ | ✓ |
| Epic can function independently | ⚠️ (Major finding #1) | ✓ | ✓ |
| Stories appropriately sized | ⚠️ (Story 1.1 large) | ✓ | ✓ |
| No forward dependencies | ⚠️ (Major finding #1) | ✓ | ✓ |
| DB tables created when needed | ✓ | ✓ | n/a |
| Clear acceptance criteria | ✓ | ✓ | ✓ |
| Traceability to FRs maintained | ✓ | ✓ | ✓ |

---

## Summary and Recommendations

### Overall Readiness Status

**NEEDS WORK**

The requirements chain (PRD → Architecture → Epics) is unusually well-disciplined for a project this size: 100% FR coverage, zero orphaned or invented requirements, consistently testable Given/When/Then acceptance criteria, and no scope creep beyond the PRD's Non-Goals. The gate is not tripped by content quality — it's tripped by two real, fixable-in-minutes sequencing/completeness defects that a rigorous pre-implementation check should not wave through: Epic 1's undeclared dependency on Epic 2 infrastructure, and an architecture-promised deferred decision (MCP package) left unresolved at the epic/story level.

### Critical Issues Requiring Immediate Action

None at Critical severity. Two Major issues should be closed before or during Epic 1 implementation:

1. Add an explicit acceptance criterion (to Story 1.1 or 1.4) for creating `src/db/pool.ts` and a minimal `src/config/env.ts` `DATABASE_URL` reader, so Epic 1 does not silently depend on Epic 2 Story 2.2's deliverables.
2. Name the concrete Postgres MCP package in Story 1.5 (or explicitly re-defer it with a one-line rationale), so the Architecture Spine's "resolve at epic/story level" promise is actually kept.

### Recommended Next Steps

1. Patch `epics.md` Story 1.1 or 1.4 with the `pool.ts`/`env.ts` acceptance criterion (Major finding #1) — this is a documentation fix, not a redesign; no architecture change needed.
2. Patch `epics.md` Story 1.5 with a named MCP package (Major finding #2), e.g. resolve it now rather than during coding.
3. Optionally add a one-line PRD/addendum note tracing NFR5 (error handling) and NFR6 (fail-fast config) to their AD-8/AD-9 origin, for traceability completeness relative to this project's own stated BMAD-process-fidelity goal (PRD §2).
4. Proceed to sprint planning / Story 1.1 implementation once items 1–2 are patched; none of the findings block starting Epic 1 scaffold work itself (Story 1.1 doesn't need `pool.ts`), only Story 1.4 (seed script).

### Final Note

This assessment identified **2 Major** and **5 Minor** issues across PRD analysis, epic coverage validation, and epic quality review (UX Alignment N/A, not scored). No Critical issues were found — the artifact chain is fundamentally sound and coverage-complete. Address the two Major items (both are small edits to `epics.md`, not new planning work) before or during Epic 1 development; the Minor items are worth noting but do not block proceeding to sprint planning.
