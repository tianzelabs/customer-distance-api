/**
 * All SQL for the `customers` table lives here (AD-1: repository does
 * DB I/O + row-to-domain mapping only, no business logic). Also the
 * single source of the `Customer` TS type (AD-14) — every other layer
 * that needs the shape imports it from this module, never redeclares it.
 *
 * Story 1.4 introduces `upsertCustomer()` (the seed's write path).
 * Story 2.3 adds `countCustomers()` (the `GET /customers/count` read
 * path); `findAll()` (the `by-distance` read path) is added by Story 2.4.
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
 * module knowing or caring which one it got. Exported so the service
 * layer (`customersService.ts`) can accept the same shape without
 * redeclaring it (single source of the contract, same spirit as AD-14).
 */
export type Queryable = Pool | PoolClient;

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

/**
 * Converts `pg`'s string-typed `COUNT(*)` result to a validated `number`
 * (Consistency Conventions: `pg` returns `COUNT(*)`/`BIGSERIAL` columns as
 * strings because Postgres's `bigint`/`count` is 64-bit and JS `number`
 * is only safely precise up to 2^53-1 — the repository must explicitly
 * coerce and validate before returning). Pure and DB-independent, so it
 * is unit-testable without a live Postgres connection.
 */
export function parseCountResult(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
    throw new Error(`[database] COUNT(*) returned a value that is not a safe, finite integer: "${raw}"`);
  }
  return value;
}

/**
 * Returns the real number of rows currently in `customers` via a static,
 * parameter-free `SELECT COUNT(*)` — no dynamic value to bind, so this
 * is exempt from the parameterized-query requirement (AD-2/addendum.md
 * exemption for static, parameter-free `SELECT`s).
 */
export async function countCustomers(db: Queryable): Promise<number> {
  const result = await db.query<{ count: string }>('SELECT COUNT(*) FROM customers');
  return parseCountResult(result.rows[0].count);
}
