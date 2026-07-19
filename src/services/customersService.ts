/**
 * Application/service layer (AD-1). `GET /customers/count` has no real
 * business logic to compute (no rounding, sorting, or distanceKm
 * assembly) — but AD-1's Rule is unconditional: "route calls service
 * functions only, service calls repository functions only."
 * `getCustomerCount()` therefore exists as a deliberate thin
 * pass-through to keep the one-way dependency chain
 * (routes -> services -> repositories) intact rather than letting the
 * route reach into the repository directly.
 *
 * `GET /customers/by-distance` (Story 2.4) is where this layer earns
 * its keep: `assembleCustomersWithDistance()` computes each customer's
 * `distanceKm` (via the pure `haversineDistanceKm()`, AD-6), rounds it,
 * and applies the full deterministic sort (AD-1 — this logic belongs
 * here, not in the repository or the route). It is a plain function of
 * `Customer[]` -> `CustomerWithDistance[]`, with no `db`/`Queryable`
 * parameter, specifically so it can be unit-tested with fake fixture
 * data without touching a database. `getCustomersByDistance(db)` is the
 * thin DB-aware wrapper the route actually calls.
 */
import { haversineDistanceKm } from './haversine.js';
import {
  countCustomers,
  findAll,
  type Customer,
  type CustomerWithDistance,
  type Queryable,
} from '../repositories/customersRepository.js';

export async function getCustomerCount(db: Queryable): Promise<number> {
  return countCustomers(db);
}

/**
 * Rounds a distance to 1 decimal place, correcting for the classic
 * floating-point rounding footgun: naive `Math.round(value * 10) / 10`
 * can misround a value whose true decimal expansion sits exactly on a
 * `.x5` boundary, because upstream floating-point arithmetic can land
 * it a hair below that boundary instead of exactly on it — e.g. a
 * value intended to be exactly `2.45` (which should round to `2.5`)
 * can arrive here as `2.4499999999999997` (verified in Node: this is
 * what `2.4 + 0.05` actually evaluates to), and `Math.round(2.4499999999999997 * 10) / 10`
 * then rounds DOWN to `2.4` instead of `2.5`. Adding `Number.EPSILON`
 * before the multiply nudges values that are only off by a hair of
 * float error back onto the correct side of the boundary, without
 * perceptibly affecting values nowhere near one. Haversine distances
 * are practically never exact `.x5` boundary values (they come out of
 * `atan2`/`sqrt` of irrational intermediate results), so this is a
 * standard, cheap defensive idiom here — not a load-bearing precision
 * guarantee for a domain that actually produces exact boundary values.
 * Note on practical impact: `Number.EPSILON` is calibrated to the gap
 * near magnitude 1, so for this app's real distance range (0 to
 * ~2470km observed against the real seed data) the nudge is a no-op for
 * nearly every value it computes — it only does something for outputs
 * with magnitude close to 1, which is rare in this domain. Kept anyway:
 * it's free, and matches the codebase's general "defend even against
 * unlikely inputs" posture (see `parseCustomerId`/`parseCountResult`).
 * Exported (not just used internally) so it is unit-testable directly,
 * same rationale as exporting `parseCountResult`/`parseCustomerId` from
 * the repository layer.
 */
export function roundToOneDecimal(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/**
 * `distanceKm` for one customer: `null` when the town is unknown OR when
 * a stored coordinate is non-finite (`NaN`/`Infinity`) — defensive
 * because the `customers` table's CHECK constraints use three-valued SQL
 * logic (`'NaN'::double precision BETWEEN -90 AND 90` evaluates to
 * NULL/unknown, which a CHECK constraint treats as passing, not
 * rejecting), so a stored `NaN` is not actually excluded by the schema
 * the way the range CHECKs might suggest. Both `lat` and `lon` are
 * checked independently even though the CHECK constraint guarantees
 * they're null-paired, as basic belt-and-suspenders. Otherwise: the
 * rounded Haversine distance to `BUDAPEST_REF` (the default `to` of
 * `haversineDistanceKm`, AD-13 — not re-specified here).
 */
function computeDistanceKm(customer: Customer): number | null {
  if (
    customer.lat === null ||
    customer.lon === null ||
    !Number.isFinite(customer.lat) ||
    !Number.isFinite(customer.lon)
  ) {
    return null;
  }
  const raw = haversineDistanceKm({ lat: customer.lat, lon: customer.lon });
  if (raw === null) {
    // Unreachable in practice: `from` is non-null and finite (checked
    // above) and `to` defaults to BUDAPEST_REF (never null), so
    // haversineDistanceKm cannot return null here. Thrown instead of
    // silently returning a wrong value, in case that contract ever
    // changes. Covered by a test that mocks haversineDistanceKm to
    // force this branch (see customersService.test.ts).
    throw new Error('[api] haversineDistanceKm unexpectedly returned null for non-null coordinates');
  }
  return roundToOneDecimal(raw);
}

/**
 * Deterministic sort comparator (FR-7 / Consistency Conventions):
 * non-null `distanceKm` ascending, then `name` ascending, then `id`
 * ascending — with the entire null-`distanceKm` group placed after
 * every non-null one, using the same name-then-id tiebreak within it.
 *
 * `name` comparison uses plain `<`/`>` (UTF-16 code-unit order), not
 * `String.prototype.localeCompare` — `localeCompare`'s collation
 * behavior can vary across Node builds/available ICU data, which would
 * undermine FR-7's explicit "fully deterministic" requirement. Plain
 * code-unit comparison is always identical regardless of environment.
 */
function compareByDistanceThenNameThenId(a: CustomerWithDistance, b: CustomerWithDistance): number {
  if (a.distanceKm === null && b.distanceKm !== null) {
    return 1;
  }
  if (a.distanceKm !== null && b.distanceKm === null) {
    return -1;
  }
  if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
    return a.distanceKm - b.distanceKm;
  }
  if (a.name !== b.name) {
    return a.name < b.name ? -1 : 1;
  }
  return a.id - b.id;
}

/**
 * Pure assembly of the `by-distance` response body from already-loaded
 * customers: compute + round each `distanceKm`, then apply the full
 * deterministic sort. No `db`/`Queryable` parameter — deliberately, so
 * this can be unit-tested directly with fake `Customer[]` fixtures
 * (Story 2.4 Dev Notes: this is exactly the kind of business logic that
 * benefits from fast, DB-free tests, separate from the slower
 * real-Postgres integration tests).
 */
export function assembleCustomersWithDistance(customers: Customer[]): CustomerWithDistance[] {
  const withDistance: CustomerWithDistance[] = customers.map((customer) => ({
    ...customer,
    distanceKm: computeDistanceKm(customer),
  }));
  return withDistance.sort(compareByDistanceThenNameThenId);
}

/** DB-aware wrapper the route actually calls: load, then assemble. */
export async function getCustomersByDistance(db: Queryable): Promise<CustomerWithDistance[]> {
  return assembleCustomersWithDistance(await findAll(db));
}
