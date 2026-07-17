import { describe, it, expect } from 'vitest';
import { haversineKm, distanceKmFromOrigin, attachDistances, CustomerRow } from '../../src/services/distance';
import { BUDAPEST } from '../../src/geocode/reference';

describe('haversineKm', () => {
  it('calculates the distance between Budapest and Vienna as approximately 214 km', () => {
    const vienna = { lat: 48.2082, lon: 16.3738 };
    const km = haversineKm(BUDAPEST.lat, BUDAPEST.lon, vienna.lat, vienna.lon);
    expect(km).toBeGreaterThan(212);
    expect(km).toBeLessThan(216);
  });

  it('returns 0 for identical coordinates (Budapest to Budapest)', () => {
    const km = haversineKm(BUDAPEST.lat, BUDAPEST.lon, BUDAPEST.lat, BUDAPEST.lon);
    expect(km).toBe(0);
  });
});

describe('distanceKmFromOrigin', () => {
  it('returns null when lat or lon is null', () => {
    expect(distanceKmFromOrigin(null, null, BUDAPEST)).toBeNull();
    expect(distanceKmFromOrigin(47.5, null, BUDAPEST)).toBeNull();
    expect(distanceKmFromOrigin(null, 19.0, BUDAPEST)).toBeNull();
  });

  it('rounds the distance to one decimal place', () => {
    const vienna = { lat: 48.2082, lon: 16.3738 };
    const km = distanceKmFromOrigin(vienna.lat, vienna.lon, BUDAPEST);
    expect(km).not.toBeNull();
    expect(String(km)).toMatch(/^\d+(\.\d)?$/);
  });
});

describe('attachDistances', () => {
  it('sorts ascending by distance, puts null-distance customers last, and tie-breaks by name', () => {
    const customers: CustomerRow[] = [
      { id: 1, name: 'Zoltan', telepules: 'Unknown City', lat: null, lon: null, budget: null, note: null },
      { id: 2, name: 'Anna', telepules: 'Budapest', lat: BUDAPEST.lat, lon: BUDAPEST.lon, budget: null, note: null },
      { id: 3, name: 'Bela', telepules: 'Unknown City 2', lat: null, lon: null, budget: null, note: null },
    ];

    const result = attachDistances(customers, BUDAPEST);

    expect(result.map((c) => c.name)).toEqual(['Anna', 'Bela', 'Zoltan']);
    expect(result[0].distanceKm).toBe(0);
    expect(result[1].distanceKm).toBeNull();
    expect(result[2].distanceKm).toBeNull();
  });
});
