import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { closeServer, listenOnEphemeralPort } from '../helpers/httpServer.js';

/**
 * Proves AD-4 end-to-end: the real `app` (src/app.ts) is imported directly
 * — src/server.ts is never involved — and bound to an OS-assigned
 * ephemeral port (port 0) purely within this test, never a fixed/
 * production port. Real HTTP requests are driven with the platform's
 * native fetch, no supertest or other new dependency needed (AD-10).
 */
describe('app (integration)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    ({ server, baseUrl } = await listenOnEphemeralPort(app));
  });

  afterAll(async () => {
    await closeServer(server);
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
});

/**
 * Proves the error-forwarding mechanism (AC #4) over real HTTP without
 * putting a throw-on-purpose route inside production source (src/app.ts).
 * This suite builds its own throwaway Express instance — NOT the
 * production `app` — but wires the real, imported `errorHandler` from
 * src/middleware/errorHandler.ts, the same way src/app.ts does. Express's
 * throw -> error-middleware forwarding is generic per-instance framework
 * behavior (not something specially configured by src/app.ts), so a
 * synthetic instance proves the mechanism just as validly, with zero
 * test-conditional branching ever shipped in production code.
 */
describe('centralized error handling (integration, synthetic app)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const testApp = express();
    testApp.get('/throws-sync', () => {
      throw new Error('diagnostic sync error for centralized error handler test');
    });
    testApp.get('/throws-async', async () => {
      throw new Error('diagnostic async rejection for centralized error handler test');
    });
    testApp.use(errorHandler);

    ({ server, baseUrl } = await listenOnEphemeralPort(testApp));
  });

  afterAll(async () => {
    await closeServer(server);
  });

  it('routes a synchronous route throw through the centralized error handler end-to-end', async () => {
    const res = await fetch(`${baseUrl}/throws-sync`);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body).toEqual({ error: { message: 'Internal server error' } });
  });

  it('routes an async/rejected-promise route error through the centralized error handler end-to-end (Express 5 auto-forwarding)', async () => {
    const res = await fetch(`${baseUrl}/throws-async`);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body).toEqual({ error: { message: 'Internal server error' } });
  });
});
