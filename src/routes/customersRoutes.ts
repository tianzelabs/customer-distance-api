/**
 * HTTP I/O only — no SQL, no direct repository access (AD-1). Mounted
 * under `/customers` in `src/app.ts`.
 *
 * `createCustomersRouter(db)` takes its DB dependency (`Queryable`, the
 * same `Pool | PoolClient` contract the repository layer already uses)
 * as a plain function parameter rather than importing the shared
 * `db/pool.ts` singleton directly. This is NOT a DI framework/container
 * (AD-10 forbids those) — it's the same explicit-parameter pattern the
 * repository layer already uses for `Queryable`. It exists specifically
 * so an integration test can build a router bound to a `TEST_DATABASE_URL`
 * pool and drive it over real HTTP (AD-9: integration tests must
 * exercise TEST_DATABASE_URL, never the dev DB reachable through the
 * `db/pool.ts` singleton). Production wiring (`src/app.ts`) always
 * passes the singleton `pool` (DATABASE_URL); nothing here reads
 * `NODE_ENV` or branches on it.
 *
 * The async handler below has no explicit try/catch + `next(err)`:
 * Express 5 natively forwards a rejected Promise from an async route
 * handler to the centralized error handler registered in `app.ts`
 * (proven end-to-end by the `/throws-async` case in Story 2.2's
 * `test/integration/app.test.ts`), so the boilerplate would be
 * redundant (AD-10 — keep it simple, no unneeded ceremony).
 */
import { Router } from 'express';
import type { Queryable } from '../repositories/customersRepository.js';
import { getCustomerCount, getCustomersByDistance } from '../services/customersService.js';

export function createCustomersRouter(db: Queryable): Router {
  const router = Router();

  router.get('/count', async (_req, res) => {
    const count = await getCustomerCount(db);
    res.json({ count });
  });

  // Bare JSON array (not wrapped in an envelope object) — Consistency
  // Conventions/FR-7. Each element is whatever assembleCustomersWithDistance
  // produced: `budget`/`note`/`countryCode` already omitted (not
  // explicit null) when unset, `distanceKm` always present. No
  // additional shaping needed here — res.json() serializes the service
  // layer's result as-is.
  router.get('/by-distance', async (_req, res) => {
    const customers = await getCustomersByDistance(db);
    res.json(customers);
  });

  return router;
}
