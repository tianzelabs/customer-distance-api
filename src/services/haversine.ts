/**
 * Pure Haversine great-circle distance calculation (AD-6). Takes plain
 * `{lat, lon}`-shaped coordinates and returns a plain `number` (km) or
 * `null` — no DB client, HTTP, or I/O dependency of any kind.
 *
 * `to` defaults to `BUDAPEST_REF` (imported from townReference.ts, never
 * redefined here — AD-13) because the app's one real use case (FR-8) is
 * always "distance from a customer's town to Budapest." The function
 * stays generic (both parameters are plain coordinates) so it is fully
 * testable in isolation from that use case.
 */

import { BUDAPEST_REF } from '../geocoding/townReference.js';
import type { TownCoordinate } from '../geocoding/townReference.js';

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Computes the great-circle distance between two coordinates in
 * kilometers using the Haversine formula. Returns `null` — never
 * throws — when either coordinate is `null` (the defined handling for
 * a customer with an unresolved town, per FR-9).
 */
export function haversineDistanceKm(
  from: TownCoordinate | null,
  to: TownCoordinate | null = BUDAPEST_REF,
): number | null {
  if (from === null || to === null) {
    return null;
  }

  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}
