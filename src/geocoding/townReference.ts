/**
 * Offline, repo-bundled town -> coordinate reference.
 *
 * Seed-time only (AD-5): the seed entrypoint (Story 1.4) is the sole
 * consumer of this lookup. Query endpoints read the already-stored
 * lat/lon columns and never re-geocode at runtime (FR-3, NFR-1).
 *
 * Covers exactly the 15 towns present in seed-customers.json (Budapest
 * is one of the 15, keyed via the dedicated BUDAPEST_REF constant per
 * AD-13) — not a general-purpose town database.
 *
 * Keys are the *normalized* form produced by normalizeTown() (AD-12);
 * callers must always normalize before looking up here.
 */

export interface TownCoordinate {
  lat: number;
  lon: number;
}

/**
 * Single Budapest reference coordinate (AD-13). Both this reference
 * table's own "budapest" entry and any future consumer (e.g. the
 * Haversine distance service in Story 2.1) import this exact constant
 * — no second, divergent copy is ever defined.
 */
export const BUDAPEST_REF: TownCoordinate = Object.freeze({ lat: 47.4979, lon: 19.0402 });

/** Freezes a coordinate literal so no consumer can mutate the shared reference data. */
function coord(lat: number, lon: number): TownCoordinate {
  return Object.freeze({ lat, lon });
}

// Object.create(null) — no Object.prototype in the chain, so a lookup key
// like "constructor"/"toString"/"__proto__" cannot resolve to an inherited
// method instead of a real entry.
const TOWN_REFERENCE: Readonly<Record<string, TownCoordinate>> = Object.freeze(
  Object.assign(Object.create(null), {
    budapest: BUDAPEST_REF,
    vienna: coord(48.2082, 16.3738),
    munich: coord(48.1351, 11.582),
    milan: coord(45.4642, 9.19),
    barcelona: coord(41.3851, 2.1734),
    lyon: coord(45.764, 4.8357),
    krakow: coord(50.0647, 19.945),
    prague: coord(50.0755, 14.4378),
    lisbon: coord(38.7223, -9.1393),
    amsterdam: coord(52.3676, 4.9041),
    stockholm: coord(59.3293, 18.0686),
    ljubljana: coord(46.0569, 14.5058),
    bucharest: coord(44.4268, 26.1025),
    dublin: coord(53.3498, -6.2603),
    copenhagen: coord(55.6761, 12.5683),
  }),
);

/**
 * Looks up a coordinate by an already-normalized town key
 * (see normalizeTown.ts). Returns undefined — never throws — when the
 * town is unknown; callers decide how to handle a miss (Story 1.4:
 * lat/lon = null + a warning log). Safe against prototype-chain keys
 * ("constructor", "toString", ...) since TOWN_REFERENCE has no prototype.
 */
export function lookupTownCoordinate(normalizedTown: string): TownCoordinate | undefined {
  return TOWN_REFERENCE[normalizedTown];
}
