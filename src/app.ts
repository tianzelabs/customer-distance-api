/**
 * Express app construction (AD-4). This module builds and exports the
 * Express app WITHOUT binding it to a network port — binding is
 * `src/server.ts`'s sole responsibility. Keeping construction and binding
 * separate lets integration tests `import { app } from './app.js'` and
 * drive it directly (e.g. bound to an OS-assigned ephemeral port) without
 * ever needing a real, fixed production port.
 *
 * Story 2.3 adds the first real route (`GET /customers/count`), mounted
 * under `/customers`. Story 2.4 (`GET /customers/by-distance`) adds to
 * the same router.
 *
 * Deliberately NOT here: a diagnostic throw-route to exercise the error
 * handler. An earlier revision added one gated by `NODE_ENV === 'test'`,
 * but code review flagged that as test-only concern leaking into
 * production source (a permanently-shipped, unauthenticated,
 * always-throws route with no safeguard beyond one ambient env-var
 * check). The error-forwarding mechanism is proven instead by a
 * throwaway Express instance built locally inside
 * test/integration/app.test.ts, reusing this project's real
 * `errorHandler` — see that file.
 */
import express from 'express';
import { pool } from './db/pool.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createCustomersRouter } from './routes/customersRoutes.js';

export const app = express();

// The singleton pool (DATABASE_URL, the dev DB) — production wiring only.
// Integration tests build their own router via createCustomersRouter(),
// bound to a TEST_DATABASE_URL pool instead (AD-9); see
// test/integration/customersCount.test.ts.
app.use('/customers', createCustomersRouter(pool));

// Must be registered LAST: Express identifies error-handling middleware by
// its 4-argument signature, and only middleware/routes registered before
// it can have their errors forwarded here.
app.use(errorHandler);
