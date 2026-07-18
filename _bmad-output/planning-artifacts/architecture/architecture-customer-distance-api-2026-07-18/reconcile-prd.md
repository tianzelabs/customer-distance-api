---
title: Input Reconciliation — PRD vs. Architecture Spine
type: reconciliation-check
subject: Customer Distance API
inputs:
  - _bmad-output/planning-artifacts/prds/prd-customer-distance-api-2026-07-17/prd.md
  - _bmad-output/planning-artifacts/prds/prd-customer-distance-api-2026-07-17/addendum.md
spine: _bmad-output/planning-artifacts/architecture/architecture-customer-distance-api-2026-07-18/ARCHITECTURE-SPINE.md
created: 2026-07-18
---

# Input Reconciliation — PRD vs. Architecture Spine

## Method

Walked every FR-1..FR-14 testable Consequence, every §6 Non-Goal, every §7 MVP-scope line, and every §8 Success Metric in `prd.md` against the spine's Capability→Architecture Map, AD-1..AD-10, Stack, Consistency Conventions, and Structural Seed. `addendum.md` was also pulled in because the spine lists it as a `sources:` input and several FR Consequences point at it directly (FR-2, FR-6, FR-7 → "Paraméterezett adatbázis-lekérdezések").

## Coverage matrix (FR-1..FR-14)

| FR | Consequence covered? | Spine anchor |
| --- | --- | --- |
| FR-1 | Yes | AD-7, DDL shape, `migrations/` |
| FR-2 | Yes | AD-2, AD-5, `customersRepository.ts` upsert |
| FR-3 | Yes | AD-5, `townReference.ts` (static, seed-only) |
| FR-4 | Partial — see Gap 3 | `normalizeTown.ts` exists but no AD backs its behavior |
| FR-5 | Yes | Runtime seed sequence diagram, logging convention |
| FR-6 | Yes | AD-1, AD-2 (exemption — see Gap 2), AD-8, `COUNT(*)` coercion convention |
| FR-7 | Yes | AD-1, AD-6, AD-8, response-shape/sort convention |
| FR-8 | Partial — see Gap 4 | AD-6 (pure function) but no single-source-of-truth rule for the Budapest constant |
| FR-9 | Yes | AD-6 (pure-function testability), `test/unit/haversine.test.ts` |
| FR-10 | Yes | AD-4, AD-9, `test/unit/`, `test/integration/` |
| FR-11 | Yes | AD-4, AD-9, `test/integration/` (real Postgres via `TEST_DATABASE_URL`) |
| FR-12 | Yes | `docker-compose.yml`, Stack (`postgres:18`) |
| FR-13 | **No — see Gap 1** | Map row says "Not yet decided — see Deferred" |
| FR-14 | Yes | `README.md` (content correctly left ungoverned, per PRD's own out-of-scope note on FR-1/FR-12 technical-how) |

Non-Goals (§6), MVP Out-of-Scope (§7.2), and the Deferred/"Out of scope, not deferred" lists in the spine were cross-checked line by line — no contradiction found there (no write endpoints, no auth, no runtime geocoding, no multi-env, all mirrored explicitly in the spine's Deferred section).

## Gaps found

### Gap 1 — FR-13 (Postgres MCP) has no architectural home, contradicting the PRD's explicit hand-off

**PRD:** FR-13 is in MVP §7.1 In Scope ("Docker Compose Postgres, Postgres MCP dev-time ellenőrzés, README (F5)"), has testable Consequences (repo contains a *working* MCP config; dev can query the `customers` schema and seeded data via MCP), and its own `[NOTE FOR PM]` says: *"konkrét mechanizmusát az architektúra rögzíti"* — the architecture is explicitly expected to pin down the mechanism. SM-1 also requires FR-13 to be satisfied by "dokumentált konfiguráció + egy dokumentált séma-/adatellenőrzési lépés."

**Spine:** The Capability→Architecture Map row for FR-13 reads "dev tooling (outside `src/`) | Not yet decided — see Deferred," and the Deferred section states: *"the PRD names the requirement but no concrete MCP config decision was recorded during this architecture pass; resolve at epic/story level."*

**Verdict:** This is a requirement the spine silently punted rather than covered, and it directly contradicts the PRD's own note that the architecture layer is where this gets decided. It is not equivalent to the other "technical-how, addendum.md" deferrals (FR-1 column types, FR-12 compose-file contents) — those are genuinely mechanical details with an obvious eventual home; FR-13 has no home at all yet (no directory, no file, no convention), and it is an in-scope MVP item feeding SM-1.

### Gap 2 — AD-2's static-`SELECT` exemption contradicts `addendum.md`, which is tied specifically to FR-6/FR-7

**Addendum (`addendum.md`, section explicitly linked to FR-2, FR-6, FR-7):** *"Minden adatbázis-művelet (seed-betöltés, `count`, `by-distance` lekérdezés) kizárólag paraméterezett lekérdezést ... használhat."* — every DB operation, **named explicitly as including `count` and `by-distance`**, must use only parameterized queries. No exemption is stated.

**Spine AD-2:** *"Static, parameter-free `SELECT` statements (e.g. `SELECT COUNT(*) FROM customers`, `SELECT * FROM customers` with no `WHERE` clause) are exempt from an artificial placeholder requirement."*

**Verdict:** `SELECT COUNT(*) FROM customers` is literally the FR-6 query and `SELECT * FROM customers` is literally the FR-7 query — the two queries the addendum names by name. AD-2 exempts precisely the two operations the addendum requires to be parameterized. This is a direct contradiction between the spine and a load-bearing input the spine itself lists as a `source`. (The exemption is technically defensible — a query with no dynamic value has nothing to bind — but the addendum's wording leaves no room for that interpretation, so the spine should either soften/quote the addendum's exact carve-out explicitly or flag this as a documented deviation rather than stating it as settled `[ADOPTED]` policy.)

### Gap 3 — FR-4 (town-name normalization) has no backing AD; its Capability Map citation is a mismatched convention

**PRD:** FR-4 has specific testable behavior — accent-fold, case-fold, and whitespace-fold matching between `telepules` and the reference keys — comparable in behavioral specificity to FR-8 (Haversine, backed by AD-6) and FR-2 (parameterized upsert, backed by AD-2/AD-5).

**Spine:** The Capability→Architecture Map cites FR-4 as governed by "Design Paradigm (module split); Consistency Conventions (naming)." The "Consistency Conventions (naming)" table row, however, is about identifier casing (camelCase files, snake_case DB columns, PascalCase types) — it says nothing about accent-folding or whitespace-insensitive string matching. The only artifact anchoring FR-4's actual behavior is an inline filename comment in the Structural Seed block ("pure town-name normalization (accent/case/whitespace-insensitive)"), not a rule with a "Prevents" clause the way every other behaviorally-loaded FR gets.

**Verdict:** Nothing in the AD set would catch a regression where, e.g., a future change implements case-insensitive but not accent-insensitive matching. This is a PRD requirement with no structural or invariant coverage — just a comment.

### Gap 4 — No invariant guards against the Budapest reference coordinate diverging between `townReference.ts` and the Haversine constant

**PRD (Glossary + FR-8):** "Budapest referencia-koordináta" is defined as a single, fixed, application-level constant — explicitly *"nem egy customer rekordból származik"* (not derived from a customer record) — and FR-9 requires "Budapest–Budapest = 0 km" as a hard test target; FR-7 requires Budapest (and optionally its districts) to sort first with `distanceKm: 0.0`.

**Spine:** `townReference.ts` independently holds a lat/lon entry for "Budapest" (used to populate the Budapest customer row's stored coordinates at seed time), while the by-distance sequence diagram shows Haversine computing against a separate `BUDAPEST_REF` constant. These are two independently-authored values that must be bit-for-bit identical for FR-9's "Budapest–Budapest = 0 km" test to hold and for the Budapest customer to actually land at `distanceKm: 0.0`. The spine has an explicit invariant preventing exactly this class of divergence elsewhere (AD-3, single shared `Pool` module, preventing divergent DB connections) but has no equivalent rule ("single source of truth for the Budapest constant, reused by both `townReference.ts` and `haversine`/service") for this pair of values.

**Verdict:** Low probability of triggering by accident given the values are simple, but it is a genuine, currently-unenforced testable-consequence risk with no AD covering it, unlike the structurally analogous DB-pool case.

## Non-Goals / MVP-scope / Success-metrics check

- All seven §6 Non-Goals (no runtime geocoding/LLM, no auth, no UI, no multi-tenant, no write endpoints, no dynamic town reference, no production SLA) are mirrored without contradiction in the spine's Conventions table and "Out of scope, not deferred" list.
- §7.2 MVP Out-of-Scope items (write endpoints, external geocoding, auth/rate-limiting/observability, `countryCode` disambiguation) are all respected — nothing in the spine reintroduces them.
- SM-1 (every FR Consequence tested or documented) is currently blocked for FR-13 by Gap 1 — the spine gives no home to verify against.
- SM-2 (clean-machine README bring-up) is fully covered (`docker-compose.yml`, `README.md`, Stack pins for Node/Docker/npm-only bring-up).
- SM-C1 (no scope creep from test/doc chasing) — not contradicted; if anything AD-10 (no DI/ORM/complex domain layer) actively guards against over-engineering.

## Summary

4 gaps found, none of which are cosmetic: one missing architectural home for an in-scope FR (FR-13), one direct contradiction with a named source document (AD-2 vs. addendum.md on FR-6/FR-7), and two under-specified invariants (FR-4 normalization, Budapest-constant single-source-of-truth) where the spine's structural elements exist but no AD/rule actually protects the testable behavior from regression.
