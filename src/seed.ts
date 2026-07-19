/**
 * Standalone seed entrypoint (AD-5): reuses the repository and
 * geocoding layers, but is NOT routed through any HTTP/service layer
 * (none exists yet). Reads seed-customers.json, resolves each
 * customer's town to a coordinate via the offline reference, and
 * upserts through customersRepository (parameterized, AD-2).
 *
 * `resolveCoordinates()` and `seedCustomers()` deliberately do NOT
 * import `./db/pool.js` (which would pull in `./config/env.js` and
 * require DATABASE_URL at module-load time) — only `main()` does, via
 * a dynamic import, so this module can be imported for unit testing
 * without needing any DB configuration at all. See Story 1.4 Dev Notes.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { Pool, PoolClient } from 'pg';
import { normalizeTown } from './geocoding/normalizeTown.js';
import { lookupTownCoordinate } from './geocoding/townReference.js';
import { upsertCustomer, type UpsertCustomerInput } from './repositories/customersRepository.js';

export interface SeedRecord {
  name: string;
  budget?: number;
  location: {
    city: string;
    countryCode?: string;
  };
  note?: string;
}

export interface ResolvedCoordinates {
  lat: number | null;
  lon: number | null;
}

/**
 * Resolves a raw `location.city` string to a coordinate via
 * normalizeTown() + the offline townReference lookup (FR-3, FR-4).
 * Unknown towns resolve to null/null and log a `[seed]`-prefixed
 * warning (FR-5) — this function never throws, so the caller's loop
 * always continues to the next record.
 */
export function resolveCoordinates(city: string): ResolvedCoordinates {
  const normalized = normalizeTown(city);
  const coordinate = lookupTownCoordinate(normalized);
  if (!coordinate) {
    console.warn(`[seed] Unknown town: "${city}"`);
    return { lat: null, lon: null };
  }
  return { lat: coordinate.lat, lon: coordinate.lon };
}

/**
 * Upserts every record in `records` into `customers` via `db`
 * (dependency-injected — the shared dev Pool in production, a
 * test-DB-bound Pool in integration tests). Returns the number of
 * records processed. Never halts early: an unknown town only nulls
 * out lat/lon (see resolveCoordinates), it does not stop the loop.
 */
export async function seedCustomers(db: Pool | PoolClient, records: SeedRecord[]): Promise<number> {
  for (const record of records) {
    const { lat, lon } = resolveCoordinates(record.location.city);
    const input: UpsertCustomerInput = {
      name: record.name,
      telepules: record.location.city,
      lat,
      lon,
      budget: record.budget ?? null,
      note: record.note ?? null,
      countryCode: record.location.countryCode ?? null,
    };
    await upsertCustomer(db, input);
  }
  return records.length;
}

async function main(): Promise<void> {
  const { pool } = await import('./db/pool.js');
  const seedPath = new URL('../seed-customers.json', import.meta.url);
  const raw = await readFile(seedPath, 'utf-8');
  const records: SeedRecord[] = JSON.parse(raw);
  const count = await seedCustomers(pool, records);
  console.log(`[seed] Upserted ${count} customer(s) into "customers".`);
  await pool.end();
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error('[seed] Seed run failed:', error);
    process.exitCode = 1;
  });
}
