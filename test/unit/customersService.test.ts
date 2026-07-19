import { describe, expect, it } from 'vitest';
import { getCustomerCount } from '../../src/services/customersService.js';
import type { Queryable } from '../../src/repositories/customersRepository.js';

/**
 * `getCustomerCount()` is a deliberate thin pass-through (AD-1's
 * unconditional route -> service -> repository rule; see
 * src/services/customersService.ts's own docstring for the rationale).
 * A fake `Queryable` isolates that it genuinely delegates and returns the
 * repository's value, independent of the full HTTP stack (covered
 * separately by test/integration/customersCount.test.ts).
 */
describe('getCustomerCount (unit, fake Queryable)', () => {
  it('delegates to the repository and returns its count', async () => {
    const fakeDb: Queryable = {
      query: async () => ({ rows: [{ count: '7' }] }) as never,
    } as unknown as Queryable;

    await expect(getCustomerCount(fakeDb)).resolves.toBe(7);
  });

  it('propagates a repository-level error rather than swallowing it', async () => {
    const brokenDb: Queryable = {
      query: async () => ({ rows: [] }) as never,
    } as unknown as Queryable;

    await expect(getCustomerCount(brokenDb)).rejects.toThrow(/COUNT\(\*\) returned no rows/);
  });
});
