/**
 * All SQL for the `customers` table lives here (AD-1: repository does
 * DB I/O + row-to-domain mapping only, no business logic). Also the
 * single source of the `Customer` TS type (AD-14) — every other layer
 * that needs the shape imports it from this module, never redeclares it.
 *
 * Story 1.4 introduces `upsertCustomer()` (the seed's write path).
 * Story 2.3 adds `countCustomers()` (the `GET /customers/count` read
 * path); Story 2.4 adds `findAll()` (the `by-distance` read path).
 */
import type { Pool, PoolClient } from 'pg';

/**
 * A stored customer row, mapped to camelCase (country_code -> countryCode,
 * AD-14). `budget`/`note`/`countryCode` are OPTIONAL keys, not
 * nullable-but-present ones: `findAll()`'s row mapping (below) OMITS
 * these keys entirely (produces `undefined`, not `null`) when the
 * underlying DB column is `NULL`. This is a deliberate design choice
 * (Story 2.4 Dev Notes): it lets `res.json()` implement the
 * Consistency Conventions' "omitted when NULL, never explicit null"
 * response rule for free, since `JSON.stringify` already drops
 * `undefined`-valued keys while preserving explicit `null` — no
 * serialization-layer special-casing needed anywhere. The `| null` in
 * each type below remains for `UpsertCustomerInput` callers that need
 * to explicitly clear a column.
 */
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

/**
 * A `Customer` plus the computed, response-assembly-time `distanceKm`
 * field (AD-1/AD-6 — never a DB column). Defined here, alongside
 * `Customer`, per AD-14 ("the Customer TS type and its
 * CustomerWithDistance extension... defined exactly once, in
 * customersRepository.ts"). Unlike `budget`/`note`/`countryCode`,
 * `distanceKm` is ALWAYS present on the object — explicit `null` when
 * the customer's town is unknown, never omitted (Consistency
 * Conventions / FR-7).
 */
export interface CustomerWithDistance extends Customer {
  distanceKm: number | null;
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
 * Converts a `pg`-returned string representation of a Postgres
 * `bigint`/`count`/`int8` value to a validated `number` (Consistency
 * Conventions: `pg` returns these as strings because Postgres's 64-bit
 * integer types exceed JS `number`'s safe precision of 2^53-1 — the
 * repository must explicitly coerce and validate before returning).
 * Pure and DB-independent, so it is unit-testable without a live
 * Postgres connection. Shared by `parseCountResult()` (`COUNT(*)`) and
 * `parseCustomerId()` (the `BIGSERIAL id` column) — one coercion/
 * validation rule for every bigint-shaped value this repository reads,
 * instead of two independently-drifting copies.
 *
 * `context` is only used to make the thrown error message identify
 * which value failed (e.g. `"COUNT(*)"` vs. `"customers.id"`).
 */
function parseSafeNonNegativeInteger(raw: string, context: string): number {
  // Require a plain, non-negative decimal digit string before even
  // attempting Number() conversion. Number()'s own coercion is too
  // lenient for validating an untrusted-shaped string: it accepts ""/
  // whitespace-only as 0, hex ("0x10"), and scientific notation ("1e2")
  // as valid numbers, and Number.isSafeInteger() alone does not reject
  // negative values — none of which COUNT(*) or a BIGSERIAL id can ever
  // legitimately return.
  if (!/^\d+$/.test(raw)) {
    throw new Error(`[database] ${context} returned a value that is not a safe, finite integer: "${raw}"`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
    throw new Error(`[database] ${context} returned a value that is not a safe, finite integer: "${raw}"`);
  }
  return value;
}

/**
 * Converts `pg`'s string-typed `COUNT(*)` result to a validated `number`.
 * Thin wrapper over `parseSafeNonNegativeInteger` — kept as its own
 * named export (rather than inlining the context string at every call
 * site) so its existing call sites/tests are unaffected by the Story
 * 2.4 refactor that introduced the shared helper.
 */
export function parseCountResult(raw: string): number {
  return parseSafeNonNegativeInteger(raw, 'COUNT(*)');
}

/**
 * Converts `pg`'s string-typed `BIGSERIAL id` column to a validated
 * `number`, same rigor as `parseCountResult()` (Consistency Conventions:
 * "the repository must explicitly convert [id] to a number and validate
 * it is finite/safely representable before returning it").
 */
export function parseCustomerId(raw: string): number {
  return parseSafeNonNegativeInteger(raw, 'customers.id');
}

/**
 * Returns the real number of rows currently in `customers` via a static,
 * parameter-free `SELECT COUNT(*)` — no dynamic value to bind, so this
 * is exempt from the parameterized-query requirement (AD-2/addendum.md
 * exemption for static, parameter-free `SELECT`s).
 */
export async function countCustomers(db: Queryable): Promise<number> {
  const result = await db.query<{ count: string }>('SELECT COUNT(*) FROM customers');
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('[database] COUNT(*) returned no rows');
  }
  return parseCountResult(row.count);
}

/** Raw shape of a `customers` row as `pg` returns it, before domain mapping. */
interface CustomerRow {
  id: string;
  name: string;
  telepules: string;
  lat: number | null;
  lon: number | null;
  budget: number | null;
  note: string | null;
  country_code: string | null;
}

/**
 * Maps one raw DB row to the `Customer` domain shape: `country_code` ->
 * `countryCode`, `id` coerced via `parseCustomerId` (AD-14/Consistency
 * Conventions). `lat`/`lon`/`budget` need no coercion — `pg` auto-parses
 * `double precision`/`integer` columns as JS `number` by default; only
 * `int8`/`bigint`-typed columns (here, just `id`) come back as strings.
 *
 * NULL-omission design decision (Story 2.4 Dev Notes): `budget`/`note`/
 * `countryCode` are set on the result object ONLY when the column is
 * non-NULL — a NULL column produces an absent key (`undefined`), never
 * an explicit `null`. This is what lets the route's `res.json()` omit
 * these keys "for free" per the Consistency Conventions response-shape
 * rule, with no special-casing at the serialization layer.
 */
export function mapRowToCustomer(row: CustomerRow): Customer {
  const customer: Customer = {
    id: parseCustomerId(row.id),
    name: row.name,
    telepules: row.telepules,
    lat: row.lat,
    lon: row.lon,
  };
  if (row.budget !== null) {
    customer.budget = row.budget;
  }
  if (row.note !== null) {
    customer.note = row.note;
  }
  if (row.country_code !== null) {
    customer.countryCode = row.country_code;
  }
  return customer;
}

/**
 * Returns every stored customer via a static, parameter-free
 * `SELECT ... FROM customers` — no `WHERE` clause, no dynamic value to
 * bind, so this is exempt from the parameterized-query requirement
 * (AD-2/addendum.md exemption for static, parameter-free `SELECT`s),
 * same exemption already used by `countCustomers()`. Column list is
 * explicit (not `SELECT *`) so the row shape this repository depends on
 * is visible at the call site and stays stable if the table gains
 * columns later.
 */
export async function findAll(db: Queryable): Promise<Customer[]> {
  const result = await db.query<CustomerRow>(
    'SELECT id, name, telepules, lat, lon, budget, note, country_code FROM customers',
  );
  return result.rows.map(mapRowToCustomer);
}
