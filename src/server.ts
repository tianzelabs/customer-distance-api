/**
 * Binds the Express app (built in `src/app.ts`) to a real network port.
 * Deliberately kept separate from `app.ts` (AD-4) so integration tests can
 * drive `app` directly without ever going through this file or binding a
 * fixed production port.
 *
 * `env.port` is `src/config/env.ts`'s single source of the PORT value
 * (AD-9, Story 1.4) — defaults to 3000 if PORT is unset, fails fast at
 * import time if PORT (or DATABASE_URL) is present but invalid.
 */
import { app } from './app.js';
import { env } from './config/env.js';

app
  .listen(env.port, () => {
    console.log(`[api] Listening on port ${env.port}`);
  })
  .on('error', (err: NodeJS.ErrnoException) => {
    // Without this, a bind failure (e.g. EADDRINUSE) surfaces as a raw,
    // unlabeled Node exception instead of the project's own [api]-prefixed
    // logging convention used everywhere else.
    console.error(`[api] Failed to start listening on port ${env.port}:`, err);
    process.exitCode = 1;
  });
