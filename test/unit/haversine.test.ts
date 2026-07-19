import { describe, expect, it } from 'vitest';
import { normalizeTown } from '../../src/geocoding/normalizeTown.js';
import { BUDAPEST_REF, lookupTownCoordinate } from '../../src/geocoding/townReference.js';
import { haversineDistanceKm } from '../../src/services/haversine.js';

// Reuse the exact coordinates the app actually looks up at seed time
// (townReference.ts, Story 1.3) rather than a second, hand-typed copy —
// keeps the test grounded in the same data the running app uses.
const vienna = lookupTownCoordinate(normalizeTown('Vienna'))!;
const munich = lookupTownCoordinate(normalizeTown('Munich'))!;

describe('haversineDistanceKm', () => {
  it('FR-9: Budapest–Vienna is approximately 214 km, within ±1 km', () => {
    const distance = haversineDistanceKm(vienna, BUDAPEST_REF);

    expect(distance).not.toBeNull();
    expect(distance as number).toBeGreaterThanOrEqual(213);
    expect(distance as number).toBeLessThanOrEqual(215);
  });

  it('FR-9: Budapest–Budapest is exactly 0 km', () => {
    expect(haversineDistanceKm(BUDAPEST_REF, BUDAPEST_REF)).toBe(0);
  });

  it('FR-9: a null coordinate is handled without throwing, returning null', () => {
    expect(() => haversineDistanceKm(null, BUDAPEST_REF)).not.toThrow();
    expect(haversineDistanceKm(null, BUDAPEST_REF)).toBeNull();

    expect(() => haversineDistanceKm(vienna, null)).not.toThrow();
    expect(haversineDistanceKm(vienna, null)).toBeNull();

    expect(haversineDistanceKm(null, null)).toBeNull();
  });

  it('is symmetric: distance(A, B) equals distance(B, A)', () => {
    expect(haversineDistanceKm(vienna, BUDAPEST_REF)).toBe(
      haversineDistanceKm(BUDAPEST_REF, vienna),
    );
  });

  it('defaults the second parameter to BUDAPEST_REF, matching the explicit call', () => {
    expect(haversineDistanceKm(vienna)).toBe(haversineDistanceKm(vienna, BUDAPEST_REF));
  });

  it('sanity check: a third, independent city pair (Budapest–Munich) matches an independently computed value', () => {
    const distance = haversineDistanceKm(munich, BUDAPEST_REF);

    expect(distance).not.toBeNull();
    // Independently computed via a separate Python Haversine implementation
    // during story creation: ~561.15 km.
    expect(distance as number).toBeGreaterThanOrEqual(560);
    expect(distance as number).toBeLessThanOrEqual(562);
  });
});
