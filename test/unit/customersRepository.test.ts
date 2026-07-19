import { describe, expect, it } from 'vitest';
import { countCustomers, parseCountResult, type Queryable } from '../../src/repositories/customersRepository.js';

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
