// "Find a place by name": OpenStreetMap's Nominatim search, kept to Karachi (the area Mangwaoo delivers in), so "North Karachi" or
// "Dolmen Mall" can be typed instead of dragging the map there. Client-side only; the Content-Security-Policy already allows
// Nominatim. Client-safe.

import { MAX_PLACE_LABEL_LENGTH } from '@/lib/reverse-geocode';

export type PlaceResult = { id: string; label: string; postalCode: string; lat: number; lng: number };

/** Karachi bounding box (west, north, east, south): keeps the results relevant. */
const KARACHI_VIEWBOX = '66.75,25.06,67.17,24.78';

export const MIN_PLACE_QUERY_LENGTH = 3;
export const PLACE_SEARCH_DEBOUNCE_MS = 400;

type NominatimResult = { place_id?: number; display_name?: string; lat?: string; lon?: string; address?: { postcode?: string } };

/**
 * Up to 5 places that match `query`, best first. Throws when the service can't be reached (a request that was aborted throws
 * an AbortError, which callers ignore); an empty list means nothing matched.
 */
export async function searchPlaces(query: string, signal?: AbortSignal, allowOutsideServiceArea = false): Promise<PlaceResult[]> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&viewbox=${KARACHI_VIEWBOX}&bounded=${allowOutsideServiceArea ? '0&countrycodes=pk' : '1'}&q=${encodeURIComponent(query.trim())}`,
    { signal, headers: { Accept: 'application/json' } }
  );

  if (!response.ok) throw new Error('Place search failed');

  const results = (await response.json()) as NominatimResult[];

  return results.flatMap((result) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);

    if (!result.display_name || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];

    return [
      {
        id: String(result.place_id ?? `${lat},${lng}`),
        label: result.display_name.slice(0, MAX_PLACE_LABEL_LENGTH),
        postalCode: result.address?.postcode ?? '',
        lat,
        lng,
      },
    ];
  });
}
