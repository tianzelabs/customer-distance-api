# PRD Quality Review — Customer Distance API

## Overall verdict

This PRD is a well-calibrated, decisive capability spec for its stated stakes (hobby/homework, single-operator internal tool): FRs carry testable consequences almost throughout, trade-offs (district normalization, optional test coverage) are named honestly rather than smoothed to neutral, and the product/meta-layer split (§1 vs §2) keeps the harness-comparison requirements from polluting the API spec. The main risk is a broken linkage: the addendum's parameterized-query / SQL-injection requirement is never cross-referenced from the FRs it actually constrains, so it could be silently dropped when architecture is drafted. A handful of lower-stakes mechanical issues (an unresolved "Working title" not tracked as an open question, an "Assumptions Index" that holds `[NOTE FOR PM]` callouts rather than `[ASSUMPTION]` tags, a section-numbering gap) round out the findings but don't threaten the PRD's core usefulness.

## Decision-readiness — strong

§9 Open Questions explicitly closes all three prior open points with cross-references to where they were resolved ("mindhárom korábbi nyitott pont ... lezárva, lásd §5 FR-9, FR-4, FR-3") — a genuine example of decisions stated as decisions rather than left mushy. Trade-offs are named with what was given up: FR-4 separates the mandatory normalization behavior from an explicitly optional "Robusztussági kiegészítés (nem kötelező elfogadási feltétel)" for Budapest district notation, and FR-10 mirrors this by downgrading missing-optional-field test coverage to "Ajánlott, nem kötelező." `[NOTE FOR PM]` callouts land on real tensions, not safe checkpoints: FR-5/FR-10's note that the unknown-town branch won't activate on the real 15-city seed and can only be proven via a synthetic fixture is a genuine coverage gap honestly surfaced, not hidden.

### Findings
- **medium** Unresolved title not tracked as an open question (line 9; § Open Questions) — The document subtitle reads `*Working title — confirm.*`, an explicitly unresolved item, yet §9 asserts "Nincs nyitott, blokkoló kérdés a PRD lezárásakor" (no open, blocking question at PRD closure). One of these two claims is stale. *Fix:* either confirm the title and drop the caveat, or add it as a (non-blocking) line item in §9 so the "closed" claim stays accurate.

## Substance over theater — strong

No persona theater: roles are limited to "Kiértékelő" and "Fejlesztő," used functionally in JTBD (§3.1) and directly wired into FR-12/FR-14 (evaluator) and FR-13 (developer/dev-agent) rather than padding out a persona gallery. The Vision (§1) is specific enough that it couldn't swap into another PRD unchanged — it names PostgreSQL, a local coordinate reference, no runtime geocoding/LLM calls, and Budapest as the fixed origin. No NFR boilerplate ("must be scalable/secure") appears; §6 instead explicitly non-goals production-scale concerns. The addendum's SQL-injection constraint is the opposite of theater — it cites a concrete data point (`Niamh O'Brien`, an apostrophe in the actual seed data, confirmed present in `seed-customers.json` line 81) as the reason parameterized queries are required, rather than reciting generic security boilerplate.

## Strategic coherence — strong

The thesis is explicit and two-layered: a product thesis (small, offline, reproducible distance API) in §1, and a meta thesis (BMAD-vs-Superpowers methodology comparison) in §2, deliberately kept separate ("két, egymástól tudatosan elválasztott réteget tartalmaz," §0). Feature ordering (F1 schema → F2 seed/geocoding → F3 API → F4 tests → F5 dev ergonomics) follows real dependency logic, not arbitrary ease. Success Metrics match the thesis rather than measuring generic activity: SM-1 ties to FR-level test/verification coverage, SM-2 to a clean-machine reproducible run, SM-3 to the meta-thesis of a traceable BMAD chain — and a counter-metric (SM-C1: don't chase test/doc coverage into scope creep) is present and correctly counterbalances SM-1.

## Done-ness clarity — strong

FR consequences are concrete and testable almost throughout, with no instances of "handles gracefully" / "reasonable performance" / "user-friendly" found. Notable strengths: FR-9 pins a numeric tolerance ("Budapest–Bécs ≈ 214 km, ±1 km tolerancia") instead of leaving accuracy open; FR-7's sort order is fully specified (non-null ascending, then null-distance group, then name tie-break) while still leaving implementation location free ("alkalmazás- vagy SQL-oldalon") — exactly the right level of freedom-with-boundedness the rubric asks for.

### Findings
- **low** FR-13's acceptance consequence is process-shaped, not behavior-shaped (§5.2, FR-13) — "[Fejlesztő ügynök] ... ellenőrzi a lokális Postgres sémáját és a seedelt adatokat" has no stated checklist of what "ellenőrzés" must confirm. This is self-acknowledged via `[NOTE FOR PM]` as deferred to architecture, which is a reasonable call for a dev-time tooling requirement rather than an API behavior — flagging only because it's the one FR in the set without a testable consequence. *Fix:* none required now; architecture doc should give this a concrete checklist when it picks it up.

## Scope honesty — adequate

§6 Non-Goals does real work with seven specific exclusions (no auth, no write endpoints, no multi-tenant, no runtime geocoding, no production SLA, etc.), and §7.2 mirrors this with reasoned de-scoping (e.g., `countryCode`-based disambiguation explicitly deferred with a revisit condition). Open-items density (0 open questions, 3 `[NOTE FOR PM]`, 0 `[ASSUMPTION]` tags) is appropriately low for hobby stakes.

### Findings
- **medium** "Assumptions Index" contains no `[ASSUMPTION]` tags (§10) — All three §10 entries cross-reference `[NOTE FOR PM]` callouts (FR-5/FR-10, FR-13, §7.2); none is an inline `[ASSUMPTION: …]` tag on an unconfirmed inference. Either the section is mislabeled (it's really a "PM Notes Index"), or the PRD is asserting every inference was directly user-confirmed with none needing an assumption flag — plausible for a solo author/evaluator project, but worth stating explicitly rather than leaving the reader to infer it from an empty category. *Fix:* rename §10 to match its actual contents, or add a one-line note confirming no unconfirmed inferences exist.

## Downstream usability — adequate

The Glossary (§4) is thorough and domain terms (telepules, distanceKm, Holtverseny, Budapest referencia-koordináta, etc.) are used identically across FRs, SMs, and the addendum. FR IDs (FR-1…FR-14) are contiguous and unique; SM/UJ IDs are consistent; cross-references from §9 Open Questions and §10 Assumptions Index all resolve to real FR/section targets.

### Findings
- **high** Addendum requirement orphaned from the FRs it constrains (addendum.md vs. prd.md §5.2/§5.3) — `addendum.md`'s header states it relates to "FR-2, FR-6, FR-7" (parameterized queries / SQL injection protection), but none of FR-2, FR-6, or FR-7 in `prd.md` reference `addendum.md`. The only two `addendum.md` pointers in the PRD are attached to FR-1 and FR-12 (§5.1, §5.5), and those are about unrelated technical-how topics (migration tooling, compose file contents) — not parameterized queries. A reader or downstream architecture pass following the FR-2/6/7 trail has no signal the addendum exists. *Fix:* add an "Out of Scope: technical-how, see addendum.md" pointer to FR-2 (and ideally FR-6/FR-7) so the linkage is bidirectional.
- **low** §3 numbering skips 3.2 (§3, between lines 34 and 42) — "### 3.1 Jobs To Be Done" is followed directly by "### 3.3 Key User Journeys" with no 3.2 anywhere in the document. Likely editing residue (a removed persona subsection?) rather than missing content, but it's the kind of gap that trips up doc-sharding tooling downstream. *Fix:* renumber 3.3 → 3.2, or restore the missing subsection if one was intended.

## Shape fit — strong

The PRD correctly reads its own shape: internal tool / single-operator-role capability spec, not a consumer product. It uses one consolidated UJ (UJ-1, protagonist "a fejlesztő/kiértékelő") tied directly to the two testable endpoints rather than inflating a UJ gallery, and JTBD (§3.1) substitutes for a persona section — appropriate density for this scope, not under- or over-formalized. The explicit separation of the meta/evaluation layer (§2, marked "meta — nem termékkövetelmény") from the product layer (§1) is a good shape decision: it lets the harness-comparison requirements (branch discipline, commit granularity) exist as real, binding requirements without contaminating the API's functional spec.

## Mechanical notes

- **Glossary drift**: none found — `telepules`/`distanceKm`/`Holtverseny`/etc. are spelled and cased consistently everywhere they appear.
- **ID continuity**: FR-1…FR-14 contiguous, no gaps or duplicates; SM-1…SM-3 + SM-C1 and UJ-1 consistent. The one numbering gap is prose-section numbering, not requirement IDs — see §3.2 finding above (Downstream usability).
- **Assumptions Index roundtrip**: technically satisfied (0 inline `[ASSUMPTION]` tags = 0 index entries), but the index's actual contents are `[NOTE FOR PM]` callouts — see Scope honesty finding above for the labeling concern.
- **UJ protagonist naming**: UJ-1 carries a dual role name ("a fejlesztő/kiértékelő") rather than a personal name; acceptable given the single-operator shape where both roles are the same actual person for this project.
- **Cross-reference check**: addendum.md → prd.md linkage is one-directional (addendum cites FR-2/6/7; those FRs don't cite the addendum) — see Downstream usability finding above. All other cross-references checked (§9 → FR-3/FR-4/FR-9; §10 → FR-5/FR-10, FR-13, §7.2; SM-1/2/3 → FR and UJ targets) resolve correctly.
- **Factual spot-check**: FR-3's claim of exactly 15 seed towns and the addendum's `Niamh O'Brien` apostrophe example were both verified directly against `seed-customers.json` — accurate.
