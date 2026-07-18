# Reviewer Gate — Lens: Version/Reality-Check Verification

**Target:** ARCHITECTURE-SPINE.md (Stack table) vs. `.memlog.md` decision trail, cross-checked with live web search (2026-07-18).

**Verdict: PASS** — no blocking gaps. One item is already self-disclosed as open (not a silent assertion) and one cosmetic footnote.

## Stack row-by-row

| Stack row | Memlog `(version)` backing | Live re-check (2026-07-18) | Status |
| --- | --- | --- | --- |
| Node.js 24 (Active LTS) | Verified 2x: "Node.js 24 is current Active LTS (26 is Current/not-yet-LTS until Oct 2026, 22 is Maintenance-only)" | Confirmed: Node 24 Active LTS (supported to Apr 2028), Node 26 Current/not LTS until Oct 2026, Node 22 Maintenance | OK |
| TypeScript 6.0.2, exact pin | Verified 2x, with explicit awareness that 7.0.2 (Go rewrite) already exists — deliberately pinned to 6.0.2 for tooling/ecosystem compat, flagged to and confirmed by the user | Confirmed: 7.0.2 is current stable (released 2026-07-14); 6.0.2 remains the last JS-compiler release. Decision to avoid 7.x for compat risk is reasonable and was made knowingly, not from stale training data | OK (see cosmetic note below) |
| Express 5 (5.2.1, Active support) | Verified 2x with exact version number and support-phase language | Confirmed: 5.2.1 is current, Active/production-recommended | OK |
| pg (node-postgres) 8.22.0 | Verified with exact version number | Confirmed: 8.22.0 is current | OK |
| node-pg-migrate | Verified only as *tool choice* ("standard lightweight Postgres-native migration tool, no ORM coupling") — **no version number was ever claimed or verified** | Latest stable is 8.0.4; a 9.0.0-alpha.11 line is in progress (2026-06-08) — pre-release, should not be used | Correctly deferred, not a gap — see note below |
| Vitest 4.1.x (4.1.10 current; 5.0 beta not used) | Verified with exact version and explicit beta-exclusion reasoning | Confirmed: 4.1.10 is current stable, 5.0.0-beta.1 exists but is not stable | OK |
| PostgreSQL 18 (18.4), postgres:18 | Verified with exact version, plus a real behavioral note (PGDATA path change in PG18) | Confirmed: 18.4 released 2026-07-16 (2 days before the spine's own dated entries) — current | OK |

## Findings

### 1. (Informational, not a defect) node-pg-migrate is unpinned in the Stack table — correctly disclosed, worth closing with today's data
The spine's Stack row for `node-pg-migrate` carries no version number, only "exact version pinned in `package.json` per the same install convention as TypeScript." The memlog backs the *tool choice* but never ran a version check on it, and the spine's own **Deferred** section says so explicitly: "Exact `node-pg-migrate` version pin — not web-verified during this pass." This is exactly the honest, non-asserted handling the lens wants — nothing false is stated, an open item is labeled open. Not a gate blocker.
Action for implementation time: pin to the current stable `8.0.4`, not the `9.0.0-alpha.11` pre-release line that is already circulating.

### 2. (Cosmetic) Minor date-arithmetic slip in the memlog's TypeScript note
The memlog's 2026-07-18 entry describes TypeScript 7.0.2 as "only ~8 days old at time of research." Live search shows 7.0.2 released 2026-07-14 — 4 days before the memlog's own dated entry, not 8. Immaterial to the pin decision (6.0.2 was chosen for Go-rewrite compat risk regardless of exact age), but flagging for accuracy.

## What was checked and held up
Every other Stack entry (Node 24, TS 6.0.2, Express 5.2.1, pg 8.22.0, Vitest 4.1.x, PostgreSQL 18/18.4) has a corresponding `(version)` memlog entry recording a dated, reasoned web verification — not an assertion from training data — and every one of those independently reconfirmed as still accurate against a live web search performed today. No stale or non-existent technology was found; no version claim contradicted current reality.
