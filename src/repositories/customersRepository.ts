/**
 * All SQL for the `customers` table lives here (AD-1: repository does
 * DB I/O + row-to-domain mapping only, no business logic). Also the
 * single source of the `Customer` TS type (AD-14) — every other layer
 * that needs the shape imports it from this module, never redeclares it.
 *
 * Story 1.4 introduces `upsertCustomer()` only (the seed's write path);
 * `findAll()`/`count()` (the query endpoints' read path) are added by
 * Stories 2.3/2.4.
 */
import type { Pool, PoolClient } from 'pg';

/** A stored customer row, mapped to camelCase (country_code -> countryCode, AD-14). */
export interface Customer {
  id: number;
  name: string;
  telepules: string;
  lat: number | null;
  lon: number | null;
  budget?: number | null;
  note?: string | null;
  countryCode?: string | null;
}

/** Fields needed to upsert a customer row (no `id` — assigned by the DB). */
export interface UpsertCustomerInput {
  name: string;
  telepules: string;
  lat: number | null;
  lon: number | null;
  budget?: number | null;
  note?: string | null;
  countryCode?: string | null;
}

/**
 * Any object that can run a parameterized query — either the shared
 * Pool or a checked-out PoolClient. Accepting this (rather than only
 * `Pool`) lets callers inject a test-DB-bound Pool (AD-9) without this
 * module knowing or caring which one it got.
 */
type Queryable = Pool | PoolClient;

/**
 * Inserts a customer, or refreshes its mutable columns if a row with
 * the same (name, telepules) natural key already exists (AD-5) — never
 * `DO NOTHING`, so re-seeding with edited source data updates the row.
 *
 * Every dynamic value is bound via a `$n` placeholder; no string
 * concatenation (AD-2/addendum.md) — this is what keeps a value like
 * `Niamh O'Brien` (containing an apostrophe) from breaking the query.
 */
export async function upsertCustomer(db: Queryable, input: UpsertCustomerInput): Promise<void> {
  await db.query(
    `INSERT INTO customers (name, telepules, lat, lon, budget, note, country_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (name, telepules) DO UPDATE SET
       lat = EXCLUDED.lat,
       lon = EXCLUDED.lon,
       budget = EXCLUDED.budget,
       note = EXCLUDED.note,
       country_code = EXCLUDED.country_code`,
    [
      input.name,
      input.telepules,
      input.lat,
      input.lon,
      input.budget ?? null,
      input.note ?? null,
      input.countryCode ?? null,
    ],
  );
}
