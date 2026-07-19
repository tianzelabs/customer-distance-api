import { describe, expect, it } from 'vitest';
import {
  countCustomers,
  mapRowToCustomer,
  parseCountResult,
  parseCustomerId,
  type Queryable,
} from '../../src/repositories/customersRepository.js';

/**
 * `parseCountResult()` is the pure, DB-independent slice of
 * `countCustomers()` (Consistency Conventions: `pg` returns `COUNT(*)`
 * as a string; the repository must coerce to `number` and validate
 * finite/safe-integer before returning). The real `SELECT COUNT(*)`
 * call itself is proven against a live Postgres by
 * test/integration/customersCount.test.ts — this suite only isolates
 * the coercion/validation logic, which needs no DB connection.
 */
describe('parseCountResult (unit)', () => {
  it('converts a valid numeric string to a number', () => {
    expect(parseCountResult('15')).toBe(15);
  });

  it('converts "0" to 0 (empty-table case)', () => {
    expect(parseCountResult('0')).toBe(0);
  });

  it('converts a large but still-safe numeric string correctly', () => {
    expect(parseCountResult('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('throws for a non-numeric string', () => {
    expect(() => parseCountResult('not-a-number')).toThrow(/not a safe, finite integer/);
  });

  it('throws for a value beyond Number.MAX_SAFE_INTEGER (unsafe bigint precision)', () => {
    expect(() => parseCountResult('9007199254740993')).toThrow(/not a safe, finite integer/);
  });

  it('throws for a non-integer numeric string', () => {
    expect(() => parseCountResult('1.5')).toThrow(/not a safe, finite integer/);
  });

  it('throws for a negative numeric string (COUNT(*) can never be negative)', () => {
    expect(() => parseCountResult('-1')).toThrow(/not a safe, finite integer/);
  });

  it('throws for an empty or whitespace-only string, rather than silently coercing to 0', () => {
    expect(() => parseCountResult('')).toThrow(/not a safe, finite integer/);
    expect(() => parseCountResult('   ')).toThrow(/not a safe, finite integer/);
  });

  it('throws for hex or scientific-notation strings, which Number() alone would accept', () => {
    expect(() => parseCountResult('0x10')).toThrow(/not a safe, finite integer/);
    expect(() => parseCountResult('1e2')).toThrow(/not a safe, finite integer/);
  });
});

/**
 * `countCustomers()`'s own logic beyond `parseCountResult()`: dereferencing
 * `result.rows[0]`. `SELECT COUNT(*)` always returns exactly one row in
 * practice, so this branch needs a fake `Queryable` to exercise — a live
 * Postgres would never naturally produce a zero-row COUNT(*) result.
 */
describe('countCustomers (unit, fake Queryable)', () => {
  it('throws a clear error instead of an unguarded TypeError when the query returns no rows', async () => {
    const emptyResultDb: Queryable = {
      query: async () => ({ rows: [] }) as never,
    } as unknown as Queryable;

    await expect(countCustomers(emptyResultDb)).rejects.toThrow(/COUNT\(\*\) returned no rows/);
  });

  it('delegates to parseCountResult and returns its coerced value', async () => {
    const fakeDb: Queryable = {
      query: async () => ({ rows: [{ count: '42' }] }) as never,
    } as unknown as Queryable;

    await expect(countCustomers(fakeDb)).resolves.toBe(42);
  });
});

/**
 * `parseCustomerId()` (Story 2.4) shares `parseCountResult()`'s
 * extracted `parseSafeNonNegativeInteger` helper — same rigor, applied
 * to the `BIGSERIAL id` column instead of `COUNT(*)`. Mirrors the case
 * list above; error messages differ only in the "customers.id" vs.
 * "COUNT(*)" context label.
 */
describe('parseCustomerId (unit)', () => {
  it('converts a valid numeric string to a number', () => {
    expect(parseCustomerId('1')).toBe(1);
  });

  it('converts a large but still-safe numeric string correctly', () => {
    expect(parseCustomerId('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('throws for a value beyond Number.MAX_SAFE_INTEGER (unsafe bigint precision)', () => {
    expect(() => parseCustomerId('9007199254740993')).toThrow(/not a safe, finite integer/);
  });

  it('throws for a non-numeric string', () => {
    expect(() => parseCustomerId('not-an-id')).toThrow(/not a safe, finite integer/);
  });

  it('throws for a negative numeric string (a BIGSERIAL id can never be negative)', () => {
    expect(() => parseCustomerId('-1')).toThrow(/not a safe, finite integer/);
  });

  it('throws for a non-integer numeric string', () => {
    expect(() => parseCustomerId('1.5')).toThrow(/not a safe, finite integer/);
  });

  it('error message identifies the id context, not COUNT(*)', () => {
    expect(() => parseCustomerId('bad')).toThrow(/customers\.id/);
  });
});

/**
 * `mapRowToCustomer()` (Story 2.4): the pure row->domain mapping
 * `findAll()` uses. Proves the NULL-omission design decision (Dev
 * Notes: budget/note/countryCode become an ABSENT key, not an explicit
 * `null`, when the DB column is NULL) without needing a live Postgres
 * connection. The real `SELECT` itself is proven against a live DB by
 * test/integration/customersByDistance.test.ts.
 */
describe('mapRowToCustomer (unit)', () => {
  it('maps a fully-populated row, including id string -> number coercion', () => {
    const customer = mapRowToCustomer({
      id: '7',
      name: 'Anna Kovács',
      telepules: 'Budapest',
      lat: 47.4979,
      lon: 19.0402,
      budget: 5000,
      note: 'VIP',
      country_code: 'HU',
    });

    expect(customer).toEqual({
      id: 7,
      name: 'Anna Kovács',
      telepules: 'Budapest',
      lat: 47.4979,
      lon: 19.0402,
      budget: 5000,
      note: 'VIP',
      countryCode: 'HU',
    });
    expect(typeof customer.id).toBe('number');
  });

  it('omits budget/note/countryCode keys entirely when the columns are NULL (not explicit null)', () => {
    const customer = mapRowToCustomer({
      id: '1',
      name: 'Unknown Town Customer',
      telepules: 'Nowhereville',
      lat: null,
      lon: null,
      budget: null,
      note: null,
      country_code: null,
    });

    expect('budget' in customer).toBe(false);
    expect('note' in customer).toBe(false);
    expect('countryCode' in customer).toBe(false);
    // lat/lon are core, always-present fields (not optional-on-NULL like
    // budget/note/countryCode) — they stay explicit null.
    expect(customer.lat).toBeNull();
    expect(customer.lon).toBeNull();
  });

  it('maps each optional field independently — a partial NULL mix is handled correctly', () => {
    const customer = mapRowToCustomer({
      id: '2',
      name: 'Partial Customer',
      telepules: 'Vienna',
      lat: 48.2082,
      lon: 16.3738,
      budget: null,
      note: 'has a note',
      country_code: null,
    });

    expect('budget' in customer).toBe(false);
    expect(customer.note).toBe('has a note');
    expect('countryCode' in customer).toBe(false);
  });

  it('keeps a falsy-but-non-null budget/note (0, "") rather than treating them as NULL — proves the strict !== null check', () => {
    const customer = mapRowToCustomer({
      id: '3',
      name: 'Zero Budget Row',
      telepules: 'Vienna',
      lat: 48.2082,
      lon: 16.3738,
      budget: 0,
      note: '',
      country_code: null,
    });

    expect('budget' in customer).toBe(true);
    expect(customer.budget).toBe(0);
    expect('note' in customer).toBe(true);
    expect(customer.note).toBe('');
  });
});
