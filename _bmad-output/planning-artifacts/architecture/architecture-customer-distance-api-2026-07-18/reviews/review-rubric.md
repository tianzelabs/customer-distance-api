# Reviewer Gate — Lens: Rubric Walker (Good-Spine Checklist)

**Target:** `ARCHITECTURE-SPINE.md` (current, post the 4 reconciliation fixes recorded in `reconcile-prd.md` / `reconcile-addendum.md`)
**Driving inputs:** `prds/prd-customer-distance-api-2026-07-17/prd.md` + `addendum.md`
**Date:** 2026-07-18

## Verdict

**PASS, with 2 Medium + 2 Low findings.** No critical/high blockers. FR-1–FR-14 are all mapped to a governing AD/artifact, all 13 ADs have enforceable, divergence-preventing rules, named Stack tech is verified-current (independently re-confirmed via live web search — TypeScript 6.0.2, Express 5.2.1, pg 8.22.0, Vitest 4.1.10, Node 24 Active LTS, PostgreSQL 18.4 all check out as of 2026-07-18), and the operational/environmental envelope is explicitly addressed rather than silently skipped (local Docker Compose Postgres decided; CI explicitly deferred with rationale; production/multi-env deployment explicitly cited to PRD §6 Non-Goals as out-of-scope, not silently absent). The project is greenfield (no `src/` yet), so the brownfield-ratification and parent-spine-inheritance checklist items are not applicable.

## Checklist walk

| Checklist item | Assessment |
| --- | --- |
| Fixes real divergence points for epics/stories, misses none | Mostly yes — see Finding 1 and Finding 2 for two points it still misses |
| Every AD's Rule enforceable and prevents its stated divergence | Yes for all 13 ADs (code-review-checkable, each has a concrete "Prevents" tied to a concrete "Rule") |
| Nothing under Deferred could let two units diverge | Yes — all 5 Deferred items are single-decision, single-file, non-contract-affecting (npm script names, CI, one version pin, one package name, one already-resolved empty-array case) |
| Named tech verified-current | Yes, independently re-verified live (see table below) |
| Ratifies rather than contradicts brownfield code | N/A — repo is greenfield (only `README.md`, `seed-customers.json`, `docs/`, no `src/`) |
| Covers driving PRD's capabilities FR-1–FR-14 | Yes — Capability → Architecture Map has a row for every FR, each citing a real AD or artifact (previously-open FR-4/FR-8/FR-13 gaps from `reconcile-prd.md` are now closed via AD-11/AD-12/AD-13) |
| No new AD weakens/contradicts an inherited parent spine | N/A — `companions: []`, no parent spine |
| Every dimension the altitude owns is decided/deferred/open, esp. operational/environmental envelope | Mostly yes (see the "operational envelope" note below); Finding 2 is the one silent sub-dimension |

### Operational/environmental envelope check (explicit per task instructions)

The spine does **not** silently skip this dimension: Stack table pins `postgres:18` via Docker Compose; Structural Seed lists `docker-compose.yml`; AD-9 owns config/env-var handling and test-DB isolation; Deferred explicitly calls out CI as "not decided this session; homework scope requires only local reproducibility"; and "Out of scope, not deferred" explicitly cites PRD Non-Goals §6 for "Production / multi-environment deployment beyond local Docker Compose." This is the correct treatment for a homework-scale, offline-only project and should not be read as a gap.

### Stack version verification (live re-check, 2026-07-18)

| Stack row | Live check result |
| --- | --- |
| Node.js 24 (Active LTS) | Confirmed — Active LTS since 2025-10-28, through 2026-10-20 |
| TypeScript 6.0.2, exact pin | Confirmed current; TS 7.0.2 (Go rewrite) exists but 6.0.2 is a deliberate, disclosed compat choice, not stale data |
| Express 5 (5.2.1) | Confirmed current/latest supported |
| pg (node-postgres) 8.22.0 | Confirmed current/latest |
| node-pg-migrate (version deferred) | Correctly left unpinned — latest stable is 8.0.4; a 9.0.0-alpha line exists and should NOT be the implementation-time pin |
| Vitest 4.1.x (4.1.10) | Confirmed current stable |
| PostgreSQL 18 (18.4) | Confirmed current — 18.4 released 2026-07-16, 2 days before the spine's own date |

This corroborates (rather than duplicates the depth of) the existing `reviews/review-version-verification.md` lens — independent confirmation, same conclusion.

## Findings

### Finding 1 (Medium) — FR-7 optional-field JSON serialization is ambiguous; two implementers could diverge

**Where:** Consistency Conventions table, "Data & formats" row: *"each element the full stored customer record (`id`, `name`, `telepules`, `lat`, `lon`, and `budget`/`note`/`countryCode` when present)"*.

**Problem:** "When present" doesn't say whether a customer with no stored `budget` gets the JSON key omitted entirely, or the key present with value `null`. The PRD (FR-7 Consequence: *"ha tárolva vannak: budget, note, countryCode"*) carries the same ambiguity — the architecture layer is exactly where "technical-how" ambiguities like this should be resolved, and it wasn't. This is a genuine divergence point for the level below: a story implementing `customersRepository`'s row-to-domain mapping and a story writing the FR-11 integration-test assertions could each reasonably pick a different interpretation, producing a contract mismatch caught only at test time (or not caught at all if both tests and implementation independently assume the same wrong thing).

**Note in favor of low actual risk:** AD-10 (no ORM, no complex domain layer, plain mapping) implies the natural default is "map the whole row, nulls stay null" rather than conditional key-omission logic — so the *likely* practical outcome is fields always present with `null` values. But the spine doesn't say this explicitly.

**Resolution:** Autofix-able — add one clause to the Consistency Conventions "Data & formats" row: *"all response fields are always present as JSON keys; `budget`/`note`/`countryCode` serialize as `null` when not stored (no conditional key-omission)."*

### Finding 2 (Medium) — Test-database topology (`TEST_DATABASE_URL` provisioning) is left completely silent

**Where:** AD-9 and the Consistency Conventions "Config" row both state `TEST_DATABASE_URL` must be set and must fail-stop if unset — but nothing in the spine (Stack, Structural Seed, `docker-compose.yml` line item, AD-9) says *how* the test database is provisioned relative to the dev database: a second database name inside the same `postgres:18` Compose service, a second Compose service/container, or something else.

**Why this matters:** `docker-compose.yml` and `README.md` are both named Structural Seed artifacts governed by FR-12/FR-14, and FR-11 (integration tests against real Postgres) depends on this exact topology. A story implementing the Compose file and a story implementing/documenting the test-run flow could diverge (e.g., one assumes a single Postgres instance with two databases, another assumes two separate containers) — this is precisely the kind of environmental-envelope sub-dimension the checklist asks to check isn't silently missing.

**Resolution:** Discuss / add to spine — either decide now (e.g., "a second database, e.g. `customer_distance_test`, created via an init step against the same `postgres:18` Compose instance") or explicitly move it to Deferred with the same "mechanical wiring, no invariant impact" rationale used for the npm-script-names item. Currently it is neither decided nor deferred — just absent.

### Finding 3 (Low, informational) — PostgreSQL 18's Docker image has a breaking volume/PGDATA path change from PG16/17

**Where:** Structural Seed lists `docker-compose.yml` with no further content shown.

**Detail:** Confirmed via live search: PostgreSQL 18's official Docker image changed `PGDATA` to a version-specific path (`/var/lib/postgresql/18/docker`) and the `VOLUME` target to `/var/lib/postgresql` — a compose file copy-pasted from an older PG16/17 example (common on the web) would use the old `/var/lib/postgresql/data` mount and silently create an unused volume / lose persistence expectations. Not an architectural invariant and doesn't need an AD, but worth a one-line comment in the eventual `docker-compose.yml` so the implementer doesn't hit it blind. Purely informational — ignore or fold into implementation notes.

### Finding 4 (Low, cosmetic) — "Deferred" list mixes one already-resolved item in with genuinely open ones

**Where:** Deferred section, last bullet: *"Behavior on an empty `customers` result set for `by-distance` — falls out naturally from AD-1/AD-6 ... no special-case rule is needed."*

**Detail:** This isn't actually an open/deferred question — it's a resolved decision (empty array is valid output) presented with its rationale inline. Listing it under "Deferred" alongside genuinely unresolved items (CI pipeline, version pins, MCP package choice) slightly muddies what "Deferred" means in this document. No functional impact; a one-line move to a "Resolved inline" note (or just leaving as-is) is fine either way — ignore unless doing a documentation-hygiene pass.

## Summary for autofix triage

- Finding 1 → **autofix**: one-sentence addition to Consistency Conventions.
- Finding 2 → **discuss/decide-or-defer**: needs a explicit call (resolve now vs. move to Deferred with rationale), not a one-line mechanical fix.
- Finding 3 → **ignore / defer to implementation**: informational only.
- Finding 4 → **ignore**: cosmetic, optional.
