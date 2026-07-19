/**
 * Express app construction (AD-4). This module builds and exports the
 * Express app WITHOUT binding it to a network port — binding is
 * `src/server.ts`'s sole responsibility. Keeping construction and binding
 * separate lets integration tests `import { app } from './app.js'` and
 * drive it directly (e.g. bound to an OS-assigned ephemeral port) without
 * ever needing a real, fixed production port.
 *
 * No `/customers` routes exist yet — Story 2.3 (`GET /customers/count`)
 * and Story 2.4 (`GET /customers/by-distance`) add them. This story only
 * wires the cross-cutting piece required by AD-8 (the centralized error
 * handler) so the scaffold itself is genuinely testable end-to-end before
 * any real route exists.
 */
import express, { type Request, type Response } from 'express';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

// Diagnostic-only route: intentionally throws, so integration tests can
// prove the full chain end-to-end (route throws -> Express 5 auto-forwards
// to the centralized error middleware -> fixed {"error":...} shape, HTTP
// 500) via a real HTTP call, not just a direct unit-level call into
// errorHandler(). Registered ONLY when running under the test runner
// (Vitest sets NODE_ENV=test by default, verified during this story's
// implementation) — never in production, and never a stand-in for the
// real /customers routes that Stories 2.3/2.4 own. See Story 2.2 Dev
// Notes for the rationale.
if (process.env.NODE_ENV === 'test') {
  app.get('/__test/throw', (_req: Request, _res: Response) => {
    throw new Error('diagnostic error for centralized error handler test');
  });
}

// Must be registered LAST: Express identifies error-handling middleware by
// its 4-argument signature, and only middleware/routes registered before
// it can have their errors forwarded here.
app.use(errorHandler);
