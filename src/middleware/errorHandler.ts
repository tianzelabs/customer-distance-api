/**
 * Centralized Express error-handling middleware (AD-8). Registered as the
 * LAST middleware in `src/app.ts`. Express recognizes it as an
 * error-handling middleware by its 4-argument signature — any synchronous
 * throw or rejected Promise from a route/middleware upstream (Express 5
 * auto-forwards both, no per-route try/catch needed) lands here.
 *
 * The client ALWAYS receives exactly this fixed shape with HTTP 500 —
 * never the raw error message, a SQL error, a connection string, a stack
 * trace, or any other secret. The real error is logged server-side only,
 * via `console.error` with the `[api]` prefix (Consistency Conventions:
 * bracket-prefixed logging, matching `[seed]`'s established pattern).
 *
 * No custom error-class hierarchy or error-code taxonomy — AD-8 explicitly
 * rules this out for this project's scale.
 */
import type { NextFunction, Request, Response } from 'express';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[api] Unhandled error:', err);
  res.status(500).json({ error: { message: 'Internal server error' } });
}
