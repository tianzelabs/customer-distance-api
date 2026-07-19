/**
 * Single, pure normalization entry point for all town-name matching
 * against the local coordinate reference (AD-12). No caller may
 * re-implement any part of this logic inline — every layer that needs
 * to match a town name against townReference.ts imports this function.
 */

/**
 * Matches Unicode combining diacritical marks (U+0300-U+036F) left
 * behind by NFD decomposition, e.g. turns "Kraków" (NFD: "Kraków")
 * into "Krakow" once the combining mark is stripped.
 */
const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g;

const WHITESPACE_RUN_PATTERN = /\s+/g;

/**
 * Optional robustness extra (FR-4): folds Budapest district notations
 * onto the plain "budapest" key, e.g. "Budapest XIII.", "Budapest 13",
 * "Budapest, XI. kerület". Matches roman numerals I-XXIII or arabic
 * numerals 1-23 (Budapest has 23 districts), with optional separating
 * comma/whitespace, an optional trailing period, and an optional
 * "kerulet" (accent-stripped "kerület") suffix. No per-district
 * reference entry is created — everything collapses to "budapest".
 */
const BUDAPEST_DISTRICT_PATTERN =
  /^budapest[\s,]*([ivxlcdm]{1,6}|\d{1,2})\.?(?:\s*kerulet\.?)?$/;

/**
 * Normalizes a town name for reference lookup: trims, lowercases,
 * strips Unicode diacritics, and collapses internal whitespace to a
 * single space. Never throws — always returns a string (possibly
 * empty for empty/whitespace-only input).
 */
export function normalizeTown(input: string): string {
  const normalized = input
    .normalize('NFD')
    .replace(COMBINING_MARKS_PATTERN, '')
    .trim()
    .toLowerCase()
    .replace(WHITESPACE_RUN_PATTERN, ' ');

  return foldBudapestDistrict(normalized);
}

function foldBudapestDistrict(normalized: string): string {
  return BUDAPEST_DISTRICT_PATTERN.test(normalized) ? 'budapest' : normalized;
}
