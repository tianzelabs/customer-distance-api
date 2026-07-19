/**
 * Offline, repo-bundled town -> coordinate reference.
 *
 * Seed-time only (AD-5): the seed entrypoint (Story 1.4) is the sole
 * consumer of this lookup. Query endpoints read the already-stored
 * lat/lon columns and never re-geocode at runtime (FR-3, NFR-1).
 *
 * Covers exactly the 15 towns present in seed-customers.json plus the
 * dedicated Budapest reference point (AD-13) — not a general-purpose
 * town database.
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
export const BUDAPEST_REF: TownCoordinate = { lat: 47.4979, lon: 19.0402 };

const TOWN_REFERENCE: Readonly<Record<string, TownCoordinate>> = Object.freeze({
  budapest: BUDAPEST_REF,
  vienna: { lat: 48.2082, lon: 16.3738 },
  munich: { lat: 48.1351, lon: 11.582 },
  milan: { lat: 45.4642, lon: 9.19 },
  barcelona: { lat: 41.3851, lon: 2.1734 },
  lyon: { lat: 45.764, lon: 4.8357 },
  krakow: { lat: 50.0647, lon: 19.945 },
  prague: { lat: 50.0755, lon: 14.4378 },
  lisbon: { lat: 38.7223, lon: -9.1393 },
  amsterdam: { lat: 52.3676, lon: 4.9041 },
  stockholm: { lat: 59.3293, lon: 18.0686 },
  ljubljana: { lat: 46.0569, lon: 14.5058 },
  bucharest: { lat: 44.4268, lon: 26.1025 },
  dublin: { lat: 53.3498, lon: -6.2603 },
  copenhagen: { lat: 55.6761, lon: 12.5683 },
});

/**
 * Looks up a coordinate by an already-normalized town key
 * (see normalizeTown.ts). Returns undefined — never throws — when the
 * town is unknown; callers decide how to handle a miss (Story 1.4:
 * lat/lon = null + a warning log).
 */
export function lookupTownCoordinate(normalizedTown: string): TownCoordinate | undefined {
  return TOWN_REFERENCE[normalizedTown];
}
