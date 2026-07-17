export interface CustomerRow {
  id: number;
  name: string;
  telepules: string;
  lat: number | null;
  lon: number | null;
  budget: number | null;
  note: string | null;
}

export interface CustomerWithDistance extends CustomerRow {
  distanceKm: number | null;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function distanceKmFromOrigin(
  lat: number | null,
  lon: number | null,
  origin: { lat: number; lon: number }
): number | null {
  if (lat === null || lon === null) {
    return null;
  }
  return roundToOneDecimal(haversineKm(origin.lat, origin.lon, lat, lon));
}

export function sortByDistance(customers: CustomerWithDistance[]): CustomerWithDistance[] {
  return [...customers].sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) {
      return a.name.localeCompare(b.name, 'hu');
    }
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    return a.name.localeCompare(b.name, 'hu');
  });
}

export function attachDistances(
  customers: CustomerRow[],
  origin: { lat: number; lon: number }
): CustomerWithDistance[] {
  const withDistances: CustomerWithDistance[] = customers.map((c) => ({
    ...c,
    distanceKm: distanceKmFromOrigin(c.lat, c.lon, origin),
  }));
  return sortByDistance(withDistances);
}
