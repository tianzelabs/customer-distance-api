import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { requireTestDatabaseUrl } from '../../src/config/env.js';
import { createPool } from '../../src/db/pool.js';
import { BUDAPEST_REF } from '../../src/geocoding/townReference.js';
import { seedCustomers, type SeedRecord } from '../../src/seed.js';

// This suite runs against TEST_DATABASE_URL (customer_distance_test)
// ONLY — requireTestDatabaseUrl() fail-stops if it's unset and never
// falls back to DATABASE_URL (AD-9). It never touches the dev DB: the
// Pool below is built via db/pool.ts's createPool() factory, the same
// single construction site AD-3 mandates, just pointed at a different
// connection string than the shared `pool` singleton.

describe('seed integration (TEST_DATABASE_URL, customer_distance_test)', () => {
  let pool: Pool;
  let realSeedRecords: SeedRecord[];

  beforeAll(async () => {
    const testDatabaseUrl = requireTestDatabaseUrl();
    pool = createPool(testDatabaseUrl);

    const seedPath = new URL('../../seed-customers.json', import.meta.url);
    const raw = await readFile(seedPath, 'utf-8');
    realSeedRecords = JSON.parse(raw) as SeedRecord[];
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Isolation + repeatability: every test starts from an empty table.
    await pool.query('TRUNCATE TABLE customers RESTART IDENTITY');
  });

  it('idempotently seeds all 15 real customers — a second run does not duplicate rows (FR-2)', async () => {
    const firstRunCount = await seedCustomers(pool, realSeedRecords);
    expect(firstRunCount).toBe(15);

    const afterFirst = await pool.query('SELECT COUNT(*) FROM customers');
    expect(Number(afterFirst.rows[0].count)).toBe(15);

    // Second run: same natural key (name, telepules) -> upsert, not insert.
    await seedCustomers(pool, realSeedRecords);

    const afterSecond = await pool.query('SELECT COUNT(*) FROM customers');
    expect(Number(afterSecond.rows[0].count)).toBe(15);

    // The real seed data includes "Niamh O'Brien" (apostrophe) — this
    // proves the parameterized upsert handled it safely twice over,
    // with the correct, un-mangled row surviving (addendum.md).
    const niamh = await pool.query('SELECT name, telepules, lat, lon FROM customers WHERE name = $1', [
      "Niamh O'Brien",
    ]);
    expect(niamh.rows).toHaveLength(1);
    expect(niamh.rows[0].telepules).toBe('Dublin');
    expect(niamh.rows[0].lat).not.toBeNull();
    expect(niamh.rows[0].lon).not.toBeNull();
  });

  it('sets lat/lon to null for a dedicated unknown-town fixture and keeps processing subsequent records (FR-5, FR-10)', async () => {
    // Dedicated fixture, NOT drawn from the real seed-customers.json —
    // none of the real 15 towns are unknown, so this branch must be
    // proven with fabricated data (PRD FR-5/FR-10 note-for-PM).
    const fixture: SeedRecord[] = [
      {
        name: 'Ghost Customer',
        budget: 100,
        location: { city: 'Nonexistentville', countryCode: 'XX' },
        note: 'Dedicated unknown-town fixture — deliberately not a real town.',
      },
      {
        name: 'Known Town Customer',
        budget: 200,
        location: { city: 'Budapest', countryCode: 'HU' },
        note: 'Proves the loop continued past the unknown-town record above.',
      },
    ];

    const count = await seedCustomers(pool, fixture);
    expect(count).toBe(2);

    const rows = (
      await pool.query<{ name: string; telepules: string; lat: number | null; lon: number | null }>(
        'SELECT name, telepules, lat, lon FROM customers ORDER BY name',
      )
    ).rows;
    expect(rows).toHaveLength(2);

    const ghost = rows.find((row) => row.name === 'Ghost Customer');
    expect(ghost).toBeDefined();
    expect(ghost?.lat).toBeNull();
    expect(ghost?.lon).toBeNull();

    const known = rows.find((row) => row.name === 'Known Town Customer');
    expect(known).toBeDefined();
    expect(known?.lat).toBeCloseTo(BUDAPEST_REF.lat);
    expect(known?.lon).toBeCloseTo(BUDAPEST_REF.lon);
  });
});
