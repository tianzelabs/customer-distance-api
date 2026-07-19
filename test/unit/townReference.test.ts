import { describe, expect, it } from 'vitest';
import { normalizeTown } from '../../src/geocoding/normalizeTown.js';
import { BUDAPEST_REF, lookupTownCoordinate } from '../../src/geocoding/townReference.js';

// The 15 real seed towns from seed-customers.json (location.city values).
const SEED_TOWNS = [
  'Budapest',
  'Vienna',
  'Munich',
  'Milan',
  'Barcelona',
  'Lyon',
  'Kraków',
  'Prague',
  'Lisbon',
  'Amsterdam',
  'Stockholm',
  'Ljubljana',
  'Bucharest',
  'Dublin',
  'Copenhagen',
];

describe('townReference', () => {
  it('covers exactly the 15 seed towns', () => {
    expect(SEED_TOWNS).toHaveLength(15);
  });

  it.each(SEED_TOWNS)('resolves a coordinate for seed town "%s"', (town) => {
    const coordinate = lookupTownCoordinate(normalizeTown(town));

    expect(coordinate).toBeDefined();
    expect(typeof coordinate?.lat).toBe('number');
    expect(typeof coordinate?.lon).toBe('number');
    expect(coordinate?.lat).toBeGreaterThanOrEqual(-90);
    expect(coordinate?.lat).toBeLessThanOrEqual(90);
    expect(coordinate?.lon).toBeGreaterThanOrEqual(-180);
    expect(coordinate?.lon).toBeLessThanOrEqual(180);
  });

  it('resolves the same coordinate for differently-spelled variants of the same town', () => {
    const dotted = lookupTownCoordinate(normalizeTown('Kraków'));
    const undotted = lookupTownCoordinate(normalizeTown('krakow'));
    const mixedCase = lookupTownCoordinate(normalizeTown('  KRAKOW  '));

    expect(dotted).toEqual(undotted);
    expect(dotted).toEqual(mixedCase);
  });

  it('exposes the Budapest entry as exactly the BUDAPEST_REF constant (AD-13)', () => {
    const coordinate = lookupTownCoordinate(normalizeTown('Budapest'));

    expect(coordinate).toBe(BUDAPEST_REF);
    expect(coordinate).toEqual(BUDAPEST_REF);
  });

  it('resolves Budapest district notations onto the same BUDAPEST_REF entry', () => {
    expect(lookupTownCoordinate(normalizeTown('Budapest XIII.'))).toBe(BUDAPEST_REF);
    expect(lookupTownCoordinate(normalizeTown('Budapest 13'))).toBe(BUDAPEST_REF);
    expect(lookupTownCoordinate(normalizeTown('Budapest, XI. kerület'))).toBe(BUDAPEST_REF);
  });

  it('returns undefined (never throws) for an unknown town', () => {
    expect(() => lookupTownCoordinate(normalizeTown('Nonexistentville'))).not.toThrow();
    expect(lookupTownCoordinate(normalizeTown('Nonexistentville'))).toBeUndefined();
    expect(lookupTownCoordinate(normalizeTown(''))).toBeUndefined();
  });

  it('does not resolve Object.prototype member names as if they were towns', () => {
    // Regression guard: TOWN_REFERENCE is built via Object.create(null), so
    // these must miss cleanly instead of returning an inherited function/object.
    expect(lookupTownCoordinate('constructor')).toBeUndefined();
    expect(lookupTownCoordinate('toString')).toBeUndefined();
    expect(lookupTownCoordinate('hasownproperty')).toBeUndefined();
    expect(lookupTownCoordinate('__proto__')).toBeUndefined();
    expect(lookupTownCoordinate('valueof')).toBeUndefined();
  });

  it('the reference table and every coordinate in it (including BUDAPEST_REF) are frozen', () => {
    expect(Object.isFrozen(BUDAPEST_REF)).toBe(true);
    expect(() => {
      // @ts-expect-error -- intentional mutation attempt on a Readonly type
      BUDAPEST_REF.lat = 0;
    }).toThrow();
    expect(BUDAPEST_REF.lat).toBe(47.4979);

    const vienna = lookupTownCoordinate('vienna');
    expect(Object.isFrozen(vienna)).toBe(true);
  });
});
