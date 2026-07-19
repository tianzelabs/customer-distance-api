import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';

/**
 * Proves AD-4 end-to-end: `app` is imported directly (src/server.ts is
 * never involved) and bound to an OS-assigned ephemeral port (port 0)
 * purely within this test — never a fixed/production port, and app.ts
 * itself never calls .listen(). Real HTTP requests are driven with the
 * platform's native fetch, no supertest or other new dependency needed
 * (AD-10).
 */
describe('app (integration)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('returns Express 5 default 404 for an undefined route (no custom 404 handler — AD-8 does not require one)', async () => {
    const res = await fetch(`${baseUrl}/nincs-ilyen-route`);
    expect(res.status).toBe(404);
    // Express's built-in default 404 (finalhandler) responds with an HTML
    // body, not JSON — documented via a content-type/non-empty-body check
    // rather than an exact string match, since Express doesn't guarantee
    // identical wording across patch versions.
    const contentType = res.headers.get('content-type') ?? '';
    expect(contentType).toContain('text/html');
    const body = await res.text();
    expect(body.length).toBeGreaterThan(0);
  });

  it('routes an unhandled route error through the centralized error handler end-to-end (AC #4)', async () => {
    // Hits the diagnostic-only route registered by app.ts exclusively
    // under NODE_ENV=test (which Vitest sets by default) — proves the
    // real chain (route throws -> Express 5 auto-forwards -> errorHandler)
    // over actual HTTP, not just a direct unit-level call into
    // errorHandler() (see test/unit/errorHandler.test.ts for that).
    const res = await fetch(`${baseUrl}/__test/throw`);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body).toEqual({ error: { message: 'Internal server error' } });
  });
});
