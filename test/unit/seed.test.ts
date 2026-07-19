import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveCoordinates } from '../../src/seed.js';
import { BUDAPEST_REF } from '../../src/geocoding/townReference.js';

// This file deliberately imports only from src/seed.js's pure exports
// (resolveCoordinates), never src/db/pool.js — so it needs no
// DATABASE_URL / running Postgres at all (see Story 1.4 Dev Notes on
// why seed.ts defers the db/pool.js import into main()).

describe('resolveCoordinates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves a known town regardless of diacritics/case/whitespace', () => {
    expect(resolveCoordinates('  Budapest  ')).toEqual({ lat: BUDAPEST_REF.lat, lon: BUDAPEST_REF.lon });
    expect(resolveCoordinates('KRAKOW')).toEqual(resolveCoordinates('Kraków'));
  });

  it('returns null lat/lon and warns with the exact [seed] message for an unknown town, without throwing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    let result: ReturnType<typeof resolveCoordinates> | undefined;
    expect(() => {
      result = resolveCoordinates('Nonexistentville');
    }).not.toThrow();

    expect(result).toEqual({ lat: null, lon: null });
    expect(warnSpy).toHaveBeenCalledWith('[seed] Unknown town: "Nonexistentville"');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('does not warn for a known town', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    resolveCoordinates('Dublin');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
