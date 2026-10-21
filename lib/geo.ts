export type Coordinates = {
  lat: number;
  lng: number;
};

/** Reads a lat/lng pair from URL query values; anything missing or out of range gives null. */
export function parseCoordinates(lat: string | string[] | undefined, lng: string | string[] | undefined): Coordinates | null {
  const latValue = typeof lat === 'string' && lat.trim() !== '' ? Number(lat) : NaN;
  const lngValue = typeof lng === 'string' && lng.trim() !== '' ? Number(lng) : NaN;

  if (!Number.isFinite(latValue) || !Number.isFinite(lngValue) || Math.abs(latValue) > 90 || Math.abs(lngValue) > 180) {
    return null;
  }

  return { lat: latValue, lng: lngValue };
}

/** "650 m" under a kilometre, "3.4 km" up to ten, then whole kilometres. */
export function formatDistance(km: number) {
  const metres = Math.max(50, Math.round((km * 1000) / 50) * 50);
  if (metres < 1000) return `${metres} m`;
  return km < 10 ? `${Math.max(km, 1).toFixed(1)} km` : `${Math.round(km)} km`;
}

export function distanceInKm(from: Coordinates, to: Coordinates) {
  const earthRadiusKm = 6371;
  const latDistance = ((to.lat - from.lat) * Math.PI) / 180;
  const lngDistance = ((to.lng - from.lng) * Math.PI) / 180;
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;

  const haversine =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(fromLat) *
      Math.cos(toLat) *
      Math.sin(lngDistance / 2) *
      Math.sin(lngDistance / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
