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
 * bracket-prefixed logging, matching `[seed]`'s established pattern),
 * alongside the request method/URL so a failure is traceable to which
 * call caused it.
 *
 * No custom error-class hierarchy or error-code taxonomy — AD-8 explicitly
 * rules this out for this project's scale.
 */
import type { NextFunction, Request, Response } from 'express';

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  console.error(`[api] Unhandled error on ${req.method} ${req.originalUrl}:`, err);

  // Express's own documented requirement for a custom final error handler:
  // if a response has already started (e.g. a partially streamed body),
  // headers can't be set again — delegate to Express's default handler
  // instead of throwing a secondary "Cannot set headers after they are
  // sent" error.
  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(500).json({ error: { message: 'Internal server error' } });
}
