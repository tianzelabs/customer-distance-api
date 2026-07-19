import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assembleCustomersWithDistance,
  getCustomerCount,
  roundToOneDecimal,
} from '../../src/services/customersService.js';
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

  it('rounds to 1 decimal without the naive Math.round(x*10)/10 footgun (calls the real, exported roundToOneDecimal)', () => {
    // Regression guard for the classic float-representation rounding bug.
    // A value intended to be exactly 2.45 (which should round to 2.5)
    // can arrive as 2.4499999999999997 after upstream floating-point
    // arithmetic — verified directly here: `2.4 + 0.05` (not a literal
    // "2.45") produces exactly that value in IEEE-754 double precision.
    const nearBoundary = 2.4 + 0.05;
    expect(nearBoundary).toBe(2.4499999999999997); // confirms the float-error premise

    const naiveRounding = Math.round(nearBoundary * 10) / 10;
    expect(naiveRounding).toBe(2.4); // proves the footgun is real in plain JS

    // Calls the actual shipped function (not a reimplementation of the
    // formula) — a future edit that silently reverted it to the naive
    // form would fail this assertion.
    expect(roundToOneDecimal(nearBoundary)).toBe(2.5);
  });

  it('roundToOneDecimal behaves correctly at ordinary, non-boundary magnitudes too', () => {
    expect(roundToOneDecimal(214.044)).toBe(214);
    expect(roundToOneDecimal(2469.44)).toBe(2469.4);
    expect(roundToOneDecimal(0)).toBe(0);
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

  it('keeps a falsy-but-present budget/note (0, "") rather than treating them as omitted — proves the strict !== null check, not a truthiness check', () => {
    const result = assembleCustomersWithDistance([
      customer({ id: 1, name: 'Zero Budget', lat: 48.2082, lon: 16.3738, budget: 0, note: '' }),
    ]);

    expect('budget' in result[0]).toBe(true);
    expect(result[0].budget).toBe(0);
    expect('note' in result[0]).toBe(true);
    expect(result[0].note).toBe('');
  });

  it('sorts by name using plain code-unit order, not locale-aware order — demonstrates the documented (surprising) behavior', () => {
    // Plain `<`/`>` puts all uppercase ASCII before all lowercase ASCII
    // (code points 65-90 vs 97-122), unlike localeCompare's alphabetical
    // "aA, bB, ..." collation. Same distanceKm (identical coordinates)
    // isolates the name comparator from any distance-based ordering.
    const result = assembleCustomersWithDistance([
      customer({ id: 1, name: 'apple', lat: 48.2082, lon: 16.3738 }),
      customer({ id: 2, name: 'Banana', lat: 48.2082, lon: 16.3738 }),
    ]);

    // Code-unit order: 'B' (66) < 'a' (97), so 'Banana' sorts BEFORE
    // 'apple' — the opposite of case-insensitive alphabetical order.
    expect(result.map((c) => c.name)).toEqual(['Banana', 'apple']);
  });

  it('returns an empty array for an empty input, without throwing', () => {
    expect(assembleCustomersWithDistance([])).toEqual([]);
  });

  it('treats a non-finite stored coordinate (NaN/Infinity) as an unknown town (distanceKm null), not a computation error', () => {
    // Defends against the CHECK constraint's three-valued-logic gap:
    // 'NaN'::double precision BETWEEN -90 AND 90 evaluates to NULL/
    // unknown, which Postgres CHECK treats as passing, not rejecting.
    const result = assembleCustomersWithDistance([
      customer({ id: 1, name: 'NaN Lat Customer', lat: Number.NaN, lon: 16.3738 }),
      customer({ id: 2, name: 'Infinity Lon Customer', lat: 48.2082, lon: Number.POSITIVE_INFINITY }),
    ]);

    expect(result.find((c) => c.id === 1)?.distanceKm).toBeNull();
    expect(result.find((c) => c.id === 2)?.distanceKm).toBeNull();
  });
});

/**
 * Exercises the "unreachable in practice" defensive throw in
 * `computeDistanceKm` — real, non-null, finite coordinates always
 * produce a real `haversineDistanceKm` result, so this branch can only
 * be forced via a mock of the haversine module, proving the guard
 * itself actually works if that contract were ever violated.
 */
describe('assembleCustomersWithDistance — defensive throw when haversineDistanceKm unexpectedly returns null', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws a clear error rather than silently producing a wrong distance', async () => {
    vi.resetModules();
    vi.doMock('../../src/services/haversine.js', () => ({
      haversineDistanceKm: () => null,
    }));

    const { assembleCustomersWithDistance: assembleWithMockedHaversine } = await import(
      '../../src/services/customersService.js'
    );

    expect(() =>
      assembleWithMockedHaversine([
        { id: 1, name: 'Any Customer', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 },
      ]),
    ).toThrow(/haversineDistanceKm unexpectedly returned null/);

    vi.doUnmock('../../src/services/haversine.js');
    vi.resetModules();
  });
});
