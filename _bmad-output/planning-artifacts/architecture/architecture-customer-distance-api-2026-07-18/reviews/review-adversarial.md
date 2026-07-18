# Adversarial Review — ARCHITECTURE-SPINE.md

**Lens:** Construct two units one level down that each obey every AD to the letter yet still build incompatibly — clashing shared-data shapes, two owners of one entity, conflicting state-mutation paths.

**Target:** `_bmad-output/planning-artifacts/architecture/architecture-customer-distance-api-2026-07-18/ARCHITECTURE-SPINE.md`

**Method:** For each candidate seam (row→domain mapping, upsert SQL, migration naming, CHECK enforcement, response envelope, sort order), I tried to write two AD-1–AD-13-literal-compliant implementations that a story split would plausibly produce, and checked whether they'd actually disagree on the wire or at runtime.

---

## Finding 1 — No single canonical owner for the `Customer` domain type (structural gap)

**Severity: High**

AD-3 gives `Pool` one owner (`src/db/pool.ts`). AD-12 gives town normalization one owner (`normalizeTown.ts`). AD-13 gives the Budapest reference coordinate one owner (`BUDAPEST_REF` in `townReference.ts`). Each of these ADs exists specifically to prevent a second, divergent copy of shared state/logic.

The `Customer` TS type gets no equivalent treatment. The Consistency Conventions table says only "TS types/interfaces: PascalCase (`Customer`)" — a naming rule, not an ownership rule. The Structural Seed file tree has no `src/types.ts` or `src/models/` entry; `Customer` is implied to live wherever the repository author puts it (`customersRepository.ts` does "row-to-domain mapping" per AD-1, which is the closest thing to a definition site, but nothing says repository, service, and routes must all `import` one interface rather than each declaring their own compatible-looking shape).

**Concrete clash:** Story A implements `customersRepository.ts` and declares `interface Customer { id: number; name: string; telepules: string; lat: number | null; lon: number | null; budget?: number; note?: string; countryCode?: string }` locally. Story B implements `customersService.ts` independently (before A merges, or without importing A's file) and declares its own `type Customer = { ...; budget: number | null; note: string | null; countryCode: string | null }` — same fields, but optional-with-`?` vs. `| null`, which is a real structural type mismatch in TS and, more importantly, licenses two different JSON serialization behaviors (see Finding 5). Both stories are fully AD-1-compliant as written; AD-1 only constrains *where SQL runs and where distance/sort logic runs*, not where the `Customer` type is declared or how many times.

**Fix:** Add (or fold into AD-1) a rule: exactly one `Customer` interface, defined in one named file (e.g. exported from `customersRepository.ts` or a new `src/types.ts`), imported by services/routes/tests — never redeclared.

---

## Finding 2 — `id` (BIGSERIAL) coercion is unspecified; `pg` returns bigint columns as strings

**Severity: High**

The DDL shape has `id BIGSERIAL PRIMARY KEY`, i.e. a Postgres `int8`/bigint column. `node-postgres` (`pg`) does not parse `int8` to a JS `number` by default — it returns it as a **string**, for the same precision-safety reason the spine explicitly calls out for `COUNT(*)`: *"`pg` returns `COUNT(*)` as a string; the repository must explicitly convert it to a `number`..."* (Consistency Conventions, Data & formats row). The Structural Seed comment on `customersRepository.ts` names exactly two normative mappings: `country_code -> countryCode` and `COUNT(*) coercion`. It does not mention `id`.

**Concrete clash:** Developer A (implementing `by-distance`) assumes `pg`'s default type parsing "just works" like it does for `DOUBLE PRECISION`/`INTEGER` columns elsewhere in the same row, and passes `row.id` straight through, producing `id: string` in the JSON response (`"id": "1"`). Developer B (implementing `count`, or writing the integration tests for `by-distance`) knows about `pg`'s bigint-as-string behavior from the `COUNT(*)` rule and applies the same treatment to `id`, explicitly coercing with `Number(row.id)`, producing `"id": 1`. Both are letter-compliant with AD-1 ("row-to-domain mapping") — neither rule says which one is correct — yet the two implementations emit different JSON types for the same DB row, which breaks any cross-story integration test or client expecting a consistent shape.

**Fix:** Extend the Consistency Convention row (or AD-1) with an explicit `id` coercion rule, mirroring the existing `COUNT(*)` rule — e.g. "`id` (BIGINT) is returned by `pg` as a string; the repository must coerce it to `number` (safe at this row-count scale) before returning the domain object."

---

## Finding 3 — Upsert conflict-resolution semantics unspecified for `ON CONFLICT (name, telepules)`

**Severity: High**

AD-2 mandates parameter binding; AD-5 mandates that the seed call "the same repository functions (parameterized upsert)"; FR-2 requires "idempotent seed load." None of AD-2, AD-5, or the Consistency Conventions pins the actual `ON CONFLICT` clause.

**Concrete clash:** Both of the following are literally "idempotent" (rerunning produces no error and no duplicate rows) and thus both satisfy AD-2/AD-5/FR-2 as written:

- Dev A: `INSERT INTO customers (...) VALUES (...) ON CONFLICT (name, telepules) DO UPDATE SET lat = EXCLUDED.lat, lon = EXCLUDED.lon, budget = EXCLUDED.budget, note = EXCLUDED.note, country_code = EXCLUDED.country_code`
- Dev B: `INSERT INTO customers (...) VALUES (...) ON CONFLICT (name, telepules) DO NOTHING`

These diverge the moment `seed-customers.json` is edited and the seed re-run against an already-seeded DB: A's data reflects the new file, B's data silently keeps the stale row. This is exactly the "idempotent seed load" requirement being satisfied by two behaviorally incompatible SQL statements. A third axis of divergence exists even among `DO UPDATE` implementations: unconditional `SET lat = EXCLUDED.lat` (can clobber a known-good value with `NULL` if a later re-seed run hits a geocoding lookup miss) vs. `SET lat = COALESCE(EXCLUDED.lat, customers.lat)` (preserves prior good data) — again, nothing in the spine arbitrates this.

**Fix:** Add a rule (new AD or tightened AD-5) pinning the exact `ON CONFLICT (name, telepules) DO UPDATE SET <full column list> = EXCLUDED.<col>` behavior as canonical, explicitly rejecting `DO NOTHING`.

---

## Finding 4 — Table constraints (UNIQUE, CHECK) are illustrative, not binding — a real two-owners-of-one-entity clash

**Severity: High**

The Capability → Architecture Map pins FR-1 ("customers table + migration") to **AD-7 only**. AD-7's rule text, in full: *"Schema changes are expressed as `node-pg-migrate` versioned migrations with explicit `up` and `down` functions; migrations are safe to re-run (no error, no duplicate schema elements) and reversible."* That's it — no mention of `UNIQUE(name, telepules)`, no mention of the three `CHECK` constraints, no mention of column nullability. The actual constraint list only appears in a fenced code block titled "`customers` table (DDL shape)" under Structural Seed — not inside any `[ADOPTED]` AD rule.

**Concrete clash:** Developer A implements the FR-1 migration story reading AD-7 literally — they produce a correct, reversible, re-run-safe migration, but (reasonably, since nothing in AD-7 requires it) omit `UNIQUE (name, telepules)`, treating dedup as an application-layer concern instead, or omit one of the `CHECK` constraints as "belt-and-suspenders app validation can handle it." This migration is fully AD-7-compliant. Developer B implements the FR-2/AD-5 seed story and writes `INSERT ... ON CONFLICT (name, telepules) DO UPDATE ...`, which is *only valid SQL if a unique constraint or index on exactly `(name, telepules)` exists* — otherwise Postgres raises `42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification` at seed run time. Both stories are individually AD-compliant; integrated, the seed crashes. This is precisely "two owners of one entity" (the `customers` table's real, enforced shape) where one owner's governing rule (AD-7) doesn't actually bind the details the other owner (AD-2/AD-5's upsert) depends on.

**Fix:** Fold the DDL block's UNIQUE/CHECK constraints directly into AD-7's rule text (or add a dedicated AD) so they are binding contract, not illustrative example.

---

## Finding 5 — "`budget`/`note`/`countryCode` when present" is ambiguous between key-omission and null-value

**Severity: Medium**

Consistency Conventions, Data & formats row: *"each element the full stored customer record (`id`, `name`, `telepules`, `lat`, `lon`, and `budget`/`note`/`countryCode` when present)..."* Note that `lat`/`lon` are listed without the "when present" qualifier (they're always included, even as `null` for unknown towns — confirmed by the seed sequence diagram), but `budget`/`note`/`countryCode` get the qualifier.

**Concrete clash:** "When present" is read two defensible ways:
- Reading A: the key is included in the JSON object only when the underlying column is non-`NULL` for that row (so a customer with no `budget` has no `"budget"` key at all).
- Reading B: the key is always included, with JSON `null` when the column is `NULL` (matching how `lat`/`lon` already behave, just phrased loosely).

An endpoint implementer following Reading A and an integration-test author (or a second endpoint's implementer, e.g. someone building tooling against `by-distance` output while implementing `count`) following Reading B will produce/expect genuinely different JSON envelopes for the same rows — most seed rows plausibly have unset `budget`/`note`/`country_code`, so this isn't an edge case, it's the common case.

**Fix:** Tighten the Consistency Convention wording to state explicitly which behavior is intended (Reading B — always-present key with `null` value — is recommended for consistency with `lat`/`lon`/`distanceKm`).

---

## Finding 6 — Sort tie-break is incomplete, compounded by an unordered base query

**Severity: Low**

The sort rule (Consistency Conventions / sequence diagram): "non-null `distanceKm` asc, `name` asc tie-break; null group last, `name` asc tie-break." The repository's `findAll()` query is named explicitly in AD-2 as the parameter-free exemption ("`SELECT * FROM customers` with no `WHERE` clause") and carries no `ORDER BY`. Since `UNIQUE` is on `(name, telepules)` and not `name` alone, two distinct customers can legally share the same `name` (different `telepules`) and, after rounding to 1 decimal, the same `distanceKm`. For that pair, the stated sort rule provides no further tie-break, and Postgres gives no row-order guarantee for an `ORDER BY`-less `SELECT *`. Two fully spec-compliant implementations (both using a stable JS sort, both following the letter of the tie-break rule) can legitimately emit the pair in different relative order depending on DB-internal row order, which is observable and could make an integration test asserting exact array order flake between environments/re-seeds.

**Fix:** Add a final deterministic tie-break, e.g. `id asc`, to the stated sort rule.

---

## Finding 7 — Migration filename/numbering convention unspecified

**Severity: Low**

AD-7 mandates "versioned" migrations but never states the naming/numbering scheme, and the Deferred section only explicitly punts "npm script names / CLI wiring," not filename convention. `node-pg-migrate`'s own `create` CLI generates timestamp-prefixed filenames, which sidesteps collisions if used consistently — but nothing in the spine mandates using the CLI generator over hand-authored sequential prefixes (`0001_`, `0002_`). Lower severity for this project specifically since FR-1 anticipates a single migration, but the hole is real if the epic split ever adds a second schema-touching story (e.g., a follow-up index or column addition): two implementers hand-numbering files independently could collide.

**Fix:** Pin "always use `node-pg-migrate create <name>`'s default timestamp-based filename; never hand-number migration files."

---

## Summary Table

| # | Pair that clashes | What breaks | Severity |
| --- | --- | --- | --- |
| 1 | Repository-declared `Customer` type vs. independently-declared `Customer` type elsewhere | No AD gives `Customer` a single owner (unlike Pool/normalizeTown/BUDAPEST_REF); field optionality/shape can diverge | High |
| 2 | `id` passed through raw (`string`) vs. `id` coerced (`number`) | Same DB row serializes to different JSON types across two compliant repository implementations | High |
| 3 | Seed upsert `DO UPDATE SET <cols>` vs. seed upsert `DO NOTHING` | Both are "idempotent" per FR-2's letter, but diverge on re-seed with edited source data | High |
| 4 | Migration omits `UNIQUE(name, telepules)`/CHECK (AD-7 doesn't require them) vs. seed's `ON CONFLICT (name, telepules)` upsert (AD-5) assumes them | Seed crashes at runtime (`42P10`) even though both stories are individually AD-compliant | High |
| 5 | `by-distance` response omits null-valued optional keys vs. always includes them as `null` | Different JSON envelope shape for the common case (unset budget/note/countryCode) | Medium |
| 6 | Two stable sorts over an `ORDER BY`-less base query, tied on `(name, distanceKm)` | Non-deterministic final array order for a schema-legal duplicate-name+same-distance case | Low |
| 7 | Hand-numbered migration files from two independent stories | Filename collision if a second schema-touching story is added later | Low |

**Overall: 7 genuine incompatibility pairs found; none rejected as spurious.** All arise from ADs that are precise about *where* code runs but silent on the *exact shared data contract* (type shape, SQL semantics, constraint bindingness, JSON envelope) that a second, independently-compliant implementer would need to match it exactly.
