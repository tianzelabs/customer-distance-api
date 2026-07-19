/**
 * Application/service layer (AD-1). `GET /customers/count` has no real
 * business logic to compute (no rounding, sorting, or distanceKm
 * assembly — that's `by-distance`, Story 2.4) — but AD-1's Rule is
 * unconditional: "route calls service functions only, service calls
 * repository functions only." `getCustomerCount()` therefore exists as
 * a deliberate thin pass-through to keep the one-way dependency chain
 * (routes -> services -> repositories) intact rather than letting the
 * route reach into the repository directly. Story 2.4 adds real logic
 * to this same module (distanceKm calculation via haversine.ts,
 * rounding, deterministic sort).
 */
import { countCustomers, type Queryable } from '../repositories/customersRepository.js';

export async function getCustomerCount(db: Queryable): Promise<number> {
  return countCustomers(db);
}
