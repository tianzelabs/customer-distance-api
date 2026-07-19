import { describe, expect, it } from 'vitest';
import { parseCountResult } from '../../src/repositories/customersRepository.js';

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
});
