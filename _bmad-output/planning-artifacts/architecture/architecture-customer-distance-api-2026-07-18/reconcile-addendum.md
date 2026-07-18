# Input Reconciliation — Addendum (Parameterized Queries) vs. Architecture Spine

**Finalize step 2 — input reconciliation check**
**Input:** `prds/prd-customer-distance-api-2026-07-17/addendum.md`
**Spine:** `architecture/architecture-customer-distance-api-2026-07-18/ARCHITECTURE-SPINE.md`
**Date:** 2026-07-18

## Addendum constraint being traced

The addendum mandates (Hungarian, translated):

- All DB operations (seed load, `count`, `by-distance` query) must use **only** parameterized queries (prepared statement / parameter binding).
- String-concatenating seed values into SQL is **forbidden**.
- Concrete reason: the seed name `Niamh O'Brien` contains an apostrophe — string concatenation would syntactically break the query and open an SQL-injection surface.
- Framed as general SQL-injection defense, not just a fix for this one data point.

This is a mandatory technical-how constraint (not a nice-to-have), so it must land in the spine as an `[ADOPTED]` rule, not a passing mention.

## Finding 1 — Constraint is elevated correctly (PASS)

**AD-2 — "Parameterized queries mandatory"** (spine lines 53–57) is the covering AD:

- Status: `[ADOPTED]` (not proposed/deferred).
- `Binds: FR-2, FR-6, FR-7` — matches exactly the three operations the addendum names (seed-betöltés → FR-2, count → FR-6, by-distance → FR-7).
- `Prevents` clause explicitly names the addendum's own rationale: *"SQL injection and query breakage from unescaped values (e.g. the seed value `Niamh O'Brien`, which contains an apostrophe) via string concatenation."* This is a direct, traceable carry-through of the addendum's concrete example, not a generic restatement.
- Rule text is unambiguous and enforceable: *"Every SQL statement carrying a dynamic value ... must use parameter binding / prepared statements; string concatenation of values into SQL is forbidden."* This is a testable, binary rule (grep-able in code review: any `+`/template-literal building of SQL text around a variable is a violation).
- The rule also carves out a narrow, explicit exemption for **static, parameter-free** SELECTs (`COUNT(*)`, `SELECT * FROM customers` with no `WHERE`) — this does not weaken the addendum's protection because those statements carry no dynamic value in the first place; there is nothing to inject. The exemption is scoped correctly and doesn't create a loophole for the seed-insert path where the apostrophe risk actually lives.

Conclusion: the addendum's constraint is a first-class, mandatory, unambiguous architecture rule — not just mentioned in passing.

## Finding 2 — Nothing else in the spine makes it easy to accidentally violate AD-2 (PASS)

Checked for the specific accidental-violation vectors named in the task:

- **No ORM chosen that could silently string-concatenate:** Stack table pins `pg` (node-postgres) 8.22.0 "used via `Pool` — no ORM/query-builder." AD-10 independently reinforces this: *"No dependency-injection framework/container, no ORM/query-builder (raw parameterized SQL via `pg` only)."* Two independent points in the spine rule out an ORM/query-builder that might interpolate strings under the hood.
- **No code path that bypasses the repository layer:** AD-1 states repository functions are "the only place SQL is executed." AD-3 mandates exactly one shared `Pool` module (`src/db/pool.ts`), and "all repository code and the seed entrypoint obtain their DB connection exclusively from this module" — so there is no alternate/ad-hoc DB connection a developer could open and concatenate SQL against.
- **Seed path (where the actual apostrophe lives) is explicitly covered:** AD-5 requires the seed entrypoint to "call the same repository functions (parameterized upsert) as the API" rather than issuing its own SQL. The seed sequence diagram (spine lines 181–208) shows `Seed→Repo: upsertCustomer(record, lat, lon) [parameterized]` explicitly labeled parameterized. This is the exact code path that will insert `Niamh O'Brien`.
- **Structural Seed centralizes SQL:** `src/repositories/customersRepository.ts` is annotated "all SQL; row-to-domain mapping" — a single named file, consistent with AD-1's single-choke-point rule, making it easy to audit for concatenation in one place.
- **Runtime data flow diagrams confirm current query shapes:** `by-distance` uses a static `SELECT * FROM customers` (no WHERE, covered by AD-2's exemption, not a violation) and the seed upsert is explicitly marked parameterized.

No conflicting or loophole-creating element found elsewhere in the spine (Stack, Structural Seed, other ADs, Consistency Conventions).

## Finding 3 — Minor traceability nit (not a rule gap)

The **Capability → Architecture Map** row for **FR-7** (`GET /customers/by-distance`) lists governing ADs as `AD-1, AD-6, AD-8` and does **not** cite AD-2, even though AD-2's own `Binds` field lists FR-7. Practically this is harmless today because FR-7's current implementation is a static, parameter-free `SELECT *` that AD-2 itself exempts — so there's no enforcement gap in practice, only an internal cross-reference inconsistency between AD-2's `Binds` list and the Capability Map row. Worth a one-line fix for traceability hygiene (add `AD-2` to the FR-7 map row, or note the exemption there), but it does not weaken or bypass the mandatory rule and does not block finalization.

## Overall verdict

**No gaps that undermine the addendum's constraint.** AD-2 is a properly adopted, unambiguous, enforceable rule directly traceable to the addendum's rationale (including the `Niamh O'Brien` example), and it is reinforced rather than undercut by AD-1 (sole SQL choke point), AD-3 (single connection module, no bypass), AD-5 (seed reuses the parameterized repository upsert), AD-10 (no ORM/query-builder), and the Stack table (raw `pg` only). One cosmetic cross-reference inconsistency (FR-7 Capability Map row omitting AD-2) is noted for optional cleanup but does not constitute a functional or enforceability gap.
