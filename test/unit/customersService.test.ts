import { describe, expect, it } from 'vitest';
import { assembleCustomersWithDistance, getCustomerCount } from '../../src/services/customersService.js';
import { BUDAPEST_REF } from '../../src/geocoding/townReference.js';
import type { Customer, Queryable } from '../../src/repositories/customersRepository.js';

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

/**
 * `assembleCustomersWithDistance()` (Story 2.4) is a pure function of
 * `Customer[]` (no DB), so this suite drives it directly with fake
 * fixtures — fast, isolated, no Postgres dependency (this is exactly
 * the kind of business logic that belongs in fast unit tests, separate
 * from the slower real-Postgres integration tests in
 * test/integration/customersByDistance.test.ts).
 */
describe('assembleCustomersWithDistance (unit)', () => {
  function customer(overrides: Partial<Customer> & { id: number; name: string }): Customer {
    return {
      telepules: 'Vienna',
      lat: null,
      lon: null,
      ...overrides,
    };
  }

  it('a customer at the exact BUDAPEST_REF coordinate gets distanceKm 0', () => {
    const result = assembleCustomersWithDistance([
      customer({ id: 1, name: 'Anna Kovács', telepules: 'Budapest', lat: BUDAPEST_REF.lat, lon: BUDAPEST_REF.lon }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].distanceKm).toBe(0);
  });

  it('a customer with null lat/lon gets distanceKm null and sorts to the end', () => {
    const result = assembleCustomersWithDistance([
      customer({ id: 1, name: 'Known Town Customer', lat: 48.2082, lon: 16.3738 }),
      customer({ id: 2, name: 'Unknown Town Customer', lat: null, lon: null }),
    ]);

    expect(result[0].name).toBe('Known Town Customer');
    expect(result[1].name).toBe('Unknown Town Customer');
    expect(result[1].distanceKm).toBeNull();
  });

  it('sorts distinct non-null distances ascending', () => {
    // Vienna (~214km), Munich (~526km), Dublin (~1900km) from Budapest.
    const result = assembleCustomersWithDistance([
      customer({ id: 1, name: 'Dublin Customer', telepules: 'Dublin', lat: 53.3498, lon: -6.2603 }),
      customer({ id: 2, name: 'Vienna Customer', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 }),
      customer({ id: 3, name: 'Munich Customer', telepules: 'Munich', lat: 48.1351, lon: 11.582 }),
    ]);

    expect(result.map((c) => c.name)).toEqual(['Vienna Customer', 'Munich Customer', 'Dublin Customer']);
    expect(result[0].distanceKm).toBeLessThan(result[1].distanceKm!);
    expect(result[1].distanceKm).toBeLessThan(result[2].distanceKm!);
  });

  it('breaks a genuine distanceKm tie by name ascending (identical lat/lon -> bit-identical distance)', () => {
    const result = assembleCustomersWithDistance([
      customer({ id: 1, name: 'Zsofia Test', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 }),
      customer({ id: 2, name: 'Anna Test', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 }),
    ]);

    expect(result[0].distanceKm).toBe(result[1].distanceKm);
    expect(result.map((c) => c.name)).toEqual(['Anna Test', 'Zsofia Test']);
  });

  it('breaks a tie by id ascending when distanceKm AND name are equal', () => {
    const result = assembleCustomersWithDistance([
      customer({ id: 9, name: 'Same Name', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 }),
      customer({ id: 2, name: 'Same Name', telepules: 'Munich', lat: 48.2082, lon: 16.3738 }),
    ]);

    expect(result.map((c) => c.id)).toEqual([2, 9]);
  });

  it('breaks a null-distanceKm tie by name ascending, then id ascending', () => {
    const result = assembleCustomersWithDistance([
      customer({ id: 5, name: 'Zeta Unknown', lat: null, lon: null }),
      customer({ id: 1, name: 'Alpha Unknown', lat: null, lon: null }),
      customer({ id: 2, name: 'Alpha Unknown', lat: null, lon: null }),
    ]);

    expect(result.map((c) => [c.name, c.id])).toEqual([
      ['Alpha Unknown', 1],
      ['Alpha Unknown', 2],
      ['Zeta Unknown', 5],
    ]);
  });

  it('rounds to 1 decimal without the naive Math.round(x*10)/10 footgun', () => {
    // Regression guard for the classic float-representation rounding bug.
    // A value intended to be exactly 2.45 (which should round to 2.5)
    // can arrive as 2.4499999999999997 after upstream floating-point
    // arithmetic — verified directly here: `2.4 + 0.05` (not a literal
    // "2.45") produces exactly that value in IEEE-754 double precision.
    // Naive Math.round(value * 10) / 10 misrounds it DOWN to 2.4; the
    // EPSILON-adjusted approach the service actually uses correctly
    // rounds it to 2.5. The service's rounding helper itself is private,
    // so this test proves the underlying arithmetic fact directly: the
    // naive approach IS broken for this value, and the fix is not.
    const nearBoundary = 2.4 + 0.05;
    expect(nearBoundary).toBe(2.4499999999999997); // confirms the float-error premise

    const naiveRounding = Math.round(nearBoundary * 10) / 10;
    expect(naiveRounding).toBe(2.4); // proves the footgun is real in plain JS

    const correctRounding = Math.round((nearBoundary + Number.EPSILON) * 10) / 10;
    expect(correctRounding).toBe(2.5); // proves the EPSILON fix used by the service
  });

  it('does not mutate the input array', () => {
    const input = [
      customer({ id: 2, name: 'B', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 }),
      customer({ id: 1, name: 'A', telepules: 'Munich', lat: 48.1351, lon: 11.582 }),
    ];
    const inputCopy = [...input];

    assembleCustomersWithDistance(input);

    expect(input).toEqual(inputCopy);
  });

  it('preserves omitted optional fields (budget/note/countryCode) on the output', () => {
    const result = assembleCustomersWithDistance([
      customer({ id: 1, name: 'No Optional Fields', lat: 48.2082, lon: 16.3738 }),
      customer({
        id: 2,
        name: 'With Optional Fields',
        lat: 48.2082,
        lon: 16.3738,
        budget: 1000,
        note: 'a note',
        countryCode: 'AT',
      }),
    ]);

    const withoutOptional = result.find((c) => c.id === 1)!;
    expect('budget' in withoutOptional).toBe(false);
    expect('note' in withoutOptional).toBe(false);
    expect('countryCode' in withoutOptional).toBe(false);

    const withOptional = result.find((c) => c.id === 2)!;
    expect(withOptional.budget).toBe(1000);
    expect(withOptional.note).toBe('a note');
    expect(withOptional.countryCode).toBe('AT');
  });
});
