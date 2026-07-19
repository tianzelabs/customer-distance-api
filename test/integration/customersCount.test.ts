import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { requireTestDatabaseUrl } from '../../src/config/env.js';
import { createPool } from '../../src/db/pool.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { createCustomersRouter } from '../../src/routes/customersRoutes.js';

/**
 * Proves FR-6 end-to-end against a REAL, non-mocked Postgres, over real
 * HTTP. `src/app.ts`'s exported `app` always wires its route to the
 * singleton `pool` (DATABASE_URL, the dev DB) — that's correct for
 * production, but unusable here: this suite must exercise
 * TEST_DATABASE_URL (AD-9 — integration tests must fail-stop, never
 * silently fall back to/touch the dev DB). So this suite builds its own
 * Express instance, using the SAME production route code
 * (`createCustomersRouter`) and the SAME production `errorHandler`,
 * just wired to a `createPool(requireTestDatabaseUrl())` pool instead of
 * the dev-bound singleton — mirroring the synthetic-app pattern already
 * established in Story 2.2's test/integration/app.test.ts for exercising
 * production middleware over real HTTP without touching production
 * wiring. Bound to an OS-assigned ephemeral port (port 0), never a
 * fixed/production port (AD-4).
 */
describe('GET /customers/count (integration, real Postgres via TEST_DATABASE_URL)', () => {
  let server: Server;
  let baseUrl: string;
  let pool: Pool;

  beforeAll(async () => {
    const testDatabaseUrl = requireTestDatabaseUrl();
    pool = createPool(testDatabaseUrl);

    const testApp = express();
    testApp.use('/customers', createCustomersRouter(pool));
    testApp.use(errorHandler);

    server = createServer(testApp);
    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await pool.end();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(async () => {
    // Isolation + repeatability: every test starts from an empty table,
    // same convention as test/integration/seed.test.ts.
    await pool.query('TRUNCATE TABLE customers RESTART IDENTITY');
  });

  it('returns {"count": 0} against an empty table — proves no hardcoded fallback (FR-6)', async () => {
    const res = await fetch(`${baseUrl}/customers/count`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body).toEqual({ count: 0 });
  });

  it('returns the real row count for a known fixture set, distinct from 15 and from seed-customers.json length (FR-6)', async () => {
    const fixtureNames = [
      'Count Fixture One',
      'Count Fixture Two',
      'Count Fixture Three',
      'Count Fixture Four',
      'Count Fixture Five',
      'Count Fixture Six',
      'Count Fixture Seven',
    ];
    // Deliberately 7 rows: not 15 (the real seed-customers.json length)
    // and not 0 — proving the value is a genuine, independent DB query
    // result rather than a hardcoded constant or the seed file's length.
    expect(fixtureNames.length).not.toBe(15);

    for (const name of fixtureNames) {
      await pool.query('INSERT INTO customers (name, telepules) VALUES ($1, $2)', [name, 'Vienna']);
    }

    const res = await fetch(`${baseUrl}/customers/count`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ count: fixtureNames.length });

    // Cross-check directly against the DB to make sure the endpoint's
    // answer actually matches reality, not a coincidence.
    const dbCount = await pool.query('SELECT COUNT(*) FROM customers');
    expect(Number(dbCount.rows[0].count)).toBe(fixtureNames.length);
  });

  it('response count is a JSON number, not a string (repository coercion, Consistency Conventions)', async () => {
    await pool.query('INSERT INTO customers (name, telepules) VALUES ($1, $2)', ['Type Check Customer', 'Vienna']);

    const res = await fetch(`${baseUrl}/customers/count`);
    const body = await res.json();
    expect(typeof body.count).toBe('number');
    expect(body.count).toBe(1);
  });
});
