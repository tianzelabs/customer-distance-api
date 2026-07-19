import { describe, expect, it } from 'vitest';
import { normalizeTown } from '../../src/geocoding/normalizeTown.js';

describe('normalizeTown', () => {
  it('lowercases and trims a plain town name', () => {
    expect(normalizeTown('Budapest')).toBe('budapest');
    expect(normalizeTown('  Vienna  ')).toBe('vienna');
  });

  it('strips diacritics so accented and unaccented variants match', () => {
    expect(normalizeTown('Kraków')).toBe('krakow');
    expect(normalizeTown('krakow')).toBe('krakow');
    expect(normalizeTown('Krakow')).toBe('krakow');
    expect(normalizeTown('Kraków')).toBe(normalizeTown('krakow'));
  });

  it('is case-insensitive', () => {
    expect(normalizeTown('MUNICH')).toBe('munich');
    expect(normalizeTown('MuNiCh')).toBe('munich');
    expect(normalizeTown('munich')).toBe('munich');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeTown('   Prague')).toBe('prague');
    expect(normalizeTown('Prague   ')).toBe('prague');
    expect(normalizeTown('\tPrague\n')).toBe('prague');
  });

  it('collapses internal multiple whitespace to a single space', () => {
    expect(normalizeTown('New   York')).toBe('new york');
    expect(normalizeTown('Los    Angeles')).toBe('los angeles');
  });

  it('combines all normalization steps together', () => {
    expect(normalizeTown('  KRAKÓW  ')).toBe('krakow');
    expect(normalizeTown('  Kraków   ')).toBe(normalizeTown('KRAKOW'));
  });

  it('does not throw and returns a string for an unknown/empty town name', () => {
    expect(() => normalizeTown('Nonexistentville')).not.toThrow();
    expect(normalizeTown('Nonexistentville')).toBe('nonexistentville');
    expect(() => normalizeTown('')).not.toThrow();
    expect(normalizeTown('')).toBe('');
    expect(normalizeTown('   ')).toBe('');
  });

  describe('Budapest district folding (optional FR-4 robustness extra)', () => {
    it('folds roman-numeral district notation onto "budapest"', () => {
      expect(normalizeTown('Budapest XIII.')).toBe('budapest');
      expect(normalizeTown('Budapest XIII')).toBe('budapest');
      expect(normalizeTown('budapest iii')).toBe('budapest');
    });

    it('folds arabic-numeral district notation onto "budapest"', () => {
      expect(normalizeTown('Budapest 13')).toBe('budapest');
      expect(normalizeTown('Budapest 1')).toBe('budapest');
      expect(normalizeTown('Budapest 23')).toBe('budapest');
    });

    it('folds comma-separated "kerület" notation onto "budapest"', () => {
      expect(normalizeTown('Budapest, XI. kerület')).toBe('budapest');
      expect(normalizeTown('Budapest, XI kerulet')).toBe('budapest');
    });

    it('still normalizes plain "Budapest" (no district) to "budapest"', () => {
      expect(normalizeTown('Budapest')).toBe('budapest');
      expect(normalizeTown('  budapest  ')).toBe('budapest');
    });

    it('does not fold unrelated town names that merely start with a similar prefix', () => {
      expect(normalizeTown('Budapest West')).not.toBe('budapest');
    });
  });
});
