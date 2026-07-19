import type { Server } from 'node:http';
import express from 'express';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { requireTestDatabaseUrl } from '../../src/config/env.js';
import { createPool } from '../../src/db/pool.js';
import { BUDAPEST_REF } from '../../src/geocoding/townReference.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { createCustomersRouter } from '../../src/routes/customersRoutes.js';
import { closeServer, listenOnEphemeralPort } from '../helpers/httpServer.js';

/**
 * Proves FR-7/FR-11 end-to-end against a REAL, non-mocked Postgres, over
 * real HTTP — same synthetic-app pattern as
 * test/integration/customersCount.test.ts (real production route +
 * real errorHandler, wired to a TEST_DATABASE_URL-bound pool instead of
 * the dev-bound singleton, AD-9). Uses dedicated fixture rows inserted
 * directly via parameterized INSERT (not seed-customers.json) for
 * precise control over the 0km / tie-break / unknown-town scenarios.
 */
describe('GET /customers/by-distance (integration, real Postgres via TEST_DATABASE_URL)', () => {
  let server: Server;
  let baseUrl: string;
  let pool: Pool;

  beforeAll(async () => {
    const testDatabaseUrl = requireTestDatabaseUrl();
    pool = createPool(testDatabaseUrl);

    const testApp = express();
    testApp.use('/customers', createCustomersRouter(pool));
    testApp.use(errorHandler);

    ({ server, baseUrl } = await listenOnEphemeralPort(testApp));
  });

  afterAll(async () => {
    await pool.end();
    await closeServer(server);
  });

  beforeEach(async () => {
    // Isolation + repeatability: every test starts from an empty table,
    // same convention as customersCount.test.ts / seed.test.ts.
    await pool.query('TRUNCATE TABLE customers RESTART IDENTITY');
  });

  async function insertCustomer(row: {
    name: string;
    telepules: string;
    lat: number | null;
    lon: number | null;
    budget?: number | null;
    note?: string | null;
    countryCode?: string | null;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO customers (name, telepules, lat, lon, budget, note, country_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        row.name,
        row.telepules,
        row.lat,
        row.lon,
        row.budget ?? null,
        row.note ?? null,
        row.countryCode ?? null,
      ],
    );
  }

  it('returns an empty array against an empty table, without erroring', async () => {
    const res = await fetch(`${baseUrl}/customers/by-distance`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns a bare JSON array (not wrapped in an envelope object)', async () => {
    await insertCustomer({ name: 'Solo Customer', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 });

    const res = await fetch(`${baseUrl}/customers/by-distance`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('a Budapest-coordinate customer shows distanceKm 0, positioned first among non-null distances (FR-7, 0km case)', async () => {
    await insertCustomer({ name: 'Anna Kovács', telepules: 'Budapest', lat: BUDAPEST_REF.lat, lon: BUDAPEST_REF.lon });
    await insertCustomer({ name: 'Vienna Customer', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 });

    const res = await fetch(`${baseUrl}/customers/by-distance`);
    const body = await res.json();

    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('Anna Kovács');
    expect(body[0].distanceKm).toBe(0);
    expect(body[1].name).toBe('Vienna Customer');
    expect(body[1].distanceKm).toBeGreaterThan(0);
  });

  it('a null-lat/lon (unknown town) customer shows distanceKm null and sorts to the very end (FR-7, unknown-town case)', async () => {
    await insertCustomer({ name: 'Known Town Customer', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 });
    await insertCustomer({ name: 'Aaa Unknown Town', telepules: 'Nowhereville', lat: null, lon: null });

    const res = await fetch(`${baseUrl}/customers/by-distance`);
    const body = await res.json();

    expect(body).toHaveLength(2);
    expect(body[body.length - 1].name).toBe('Aaa Unknown Town');
    expect(body[body.length - 1].distanceKm).toBeNull();
    expect(body[0].name).toBe('Known Town Customer');
  });

  it('sorts 3+ customers with distinct non-null distances ascending', async () => {
    // Distances from Budapest, approx: Vienna ~214km, Munich ~526km, Dublin ~1900km.
    await insertCustomer({ name: 'Dublin Customer', telepules: 'Dublin', lat: 53.3498, lon: -6.2603 });
    await insertCustomer({ name: 'Munich Customer', telepules: 'Munich', lat: 48.1351, lon: 11.582 });
    await insertCustomer({ name: 'Vienna Customer', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 });

    const res = await fetch(`${baseUrl}/customers/by-distance`);
    const body = await res.json();

    expect(body.map((c: { name: string }) => c.name)).toEqual([
      'Vienna Customer',
      'Munich Customer',
      'Dublin Customer',
    ]);
    expect(body[0].distanceKm).toBeLessThan(body[1].distanceKm);
    expect(body[1].distanceKm).toBeLessThan(body[2].distanceKm);
  });

  it('breaks a genuine distanceKm tie by name ascending (identical lat/lon -> bit-identical distance, FR-7 tie-break case)', async () => {
    // Same coordinate, different telepules (UNIQUE(name, telepules) still
    // holds since names AND towns both differ) -> bit-identical distanceKm.
    await insertCustomer({ name: 'Zsofia Tie', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 });
    await insertCustomer({ name: 'Anna Tie', telepules: 'Munich', lat: 48.2082, lon: 16.3738 });

    const res = await fetch(`${baseUrl}/customers/by-distance`);
    const body = await res.json();

    expect(body).toHaveLength(2);
    expect(body[0].distanceKm).toBe(body[1].distanceKm);
    expect(body.map((c: { name: string }) => c.name)).toEqual(['Anna Tie', 'Zsofia Tie']);
  });

  it('budget/note/countryCode are present when set and absent (not explicit null) when unset', async () => {
    await insertCustomer({
      name: 'Full Fields Customer',
      telepules: 'Vienna',
      lat: 48.2082,
      lon: 16.3738,
      budget: 5000,
      note: 'a note',
      countryCode: 'AT',
    });
    await insertCustomer({
      name: 'No Optional Fields Customer',
      telepules: 'Munich',
      lat: 48.1351,
      lon: 11.582,
    });

    const res = await fetch(`${baseUrl}/customers/by-distance`);
    const rawBody: string = await res.text();
    const body = JSON.parse(rawBody);

    const withFields = body.find((c: { name: string }) => c.name === 'Full Fields Customer');
    const withoutFields = body.find((c: { name: string }) => c.name === 'No Optional Fields Customer');

    expect(withFields.budget).toBe(5000);
    expect(withFields.note).toBe('a note');
    expect(withFields.countryCode).toBe('AT');

    expect('budget' in withoutFields).toBe(false);
    expect('note' in withoutFields).toBe(false);
    expect('countryCode' in withoutFields).toBe(false);
    // Belt-and-suspenders: confirm the raw JSON text itself never emits
    // an explicit `null` for these keys either (only omission).
    expect(rawBody).not.toContain('"budget":null');
    expect(rawBody).not.toContain('"note":null');
    expect(rawBody).not.toContain('"countryCode":null');
  });

  it('every element carries id (number), name, telepules, lat, lon, and distanceKm', async () => {
    await insertCustomer({ name: 'Shape Check', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 });

    const res = await fetch(`${baseUrl}/customers/by-distance`);
    const body = await res.json();

    expect(body).toHaveLength(1);
    const element = body[0];
    expect(typeof element.id).toBe('number');
    expect(element.name).toBe('Shape Check');
    expect(element.telepules).toBe('Vienna');
    expect(element.lat).toBe(48.2082);
    expect(element.lon).toBe(16.3738);
    expect(typeof element.distanceKm).toBe('number');
  });

  it('breaks a genuine full tie (same distanceKm AND same name, different telepules) by id ascending — real Postgres, real HTTP', async () => {
    // UNIQUE(name, telepules) blocks an exact (name, telepules) duplicate,
    // but allows the SAME name with a DIFFERENT telepules while still
    // sharing identical coordinates (inserted directly, bypassing the
    // seed/geocoding pipeline) — producing a genuine, fully-tied
    // (distanceKm, name) pair whose order can only be decided by id.
    // Insert order is reversed on purpose: the second insert gets the
    // lower id, proving the result is sorted by id, not insertion order.
    await insertCustomer({ name: 'Same Name', telepules: 'Munich', lat: 48.2082, lon: 16.3738 });
    await insertCustomer({ name: 'Same Name', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 });

    const res = await fetch(`${baseUrl}/customers/by-distance`);
    const body = await res.json();

    expect(body).toHaveLength(2);
    expect(body[0].distanceKm).toBe(body[1].distanceKm);
    expect(body[0].name).toBe('Same Name');
    expect(body[1].name).toBe('Same Name');
    // The 'Munich' row was inserted first, so it has the lower id.
    expect(body[0].telepules).toBe('Munich');
    expect(body[1].telepules).toBe('Vienna');
    expect(body[0].id).toBeLessThan(body[1].id);
  });

  it('combines all three FR-11 cases in one seeded table: 0km, name tie-break, unknown-town-at-end', async () => {
    await insertCustomer({ name: 'Anna Kovács', telepules: 'Budapest', lat: BUDAPEST_REF.lat, lon: BUDAPEST_REF.lon });
    await insertCustomer({ name: 'Zsofia Tie', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 });
    await insertCustomer({ name: 'Anna Tie', telepules: 'Munich', lat: 48.2082, lon: 16.3738 });
    await insertCustomer({ name: 'Unmatched Town Customer', telepules: 'Nowhereville', lat: null, lon: null });

    const res = await fetch(`${baseUrl}/customers/by-distance`);
    const body = await res.json();

    expect(body.map((c: { name: string }) => c.name)).toEqual([
      'Anna Kovács',
      'Anna Tie',
      'Zsofia Tie',
      'Unmatched Town Customer',
    ]);
    expect(body[0].distanceKm).toBe(0); // Budapest, 0km case
    expect(body[1].distanceKm).toBe(body[2].distanceKm); // genuine tie (identical coordinates)
    expect(body[0].distanceKm).toBeLessThan(body[1].distanceKm); // Budapest strictly closest
    expect(body[3].distanceKm).toBeNull(); // unknown town, sorted last
  });
});
