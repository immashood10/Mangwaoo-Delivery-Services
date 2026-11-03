// "What is at this spot?": the address of a point on the map, from OpenStreetMap's Nominatim (the same service the address
// search uses; the Content-Security-Policy already allows it). Client-side only. Client-safe.

import type { LatLng } from '@/lib/map-math';

export type ReverseGeocoded = { label: string; postalCode: string };

/** The longest address text kept (a chat message, an order's address). */
export const MAX_PLACE_LABEL_LENGTH = 200;

/** How a spot with no address is named: the coordinates, so the rider still knows exactly where. */
export function coordinateLabel(point: LatLng) {
  return `Pinned place (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`;
}

// The answers of this page visit, kept in memory only (never in browser storage): moving the pin back to a place it was just
// on, or choosing the same place twice, must not ask the free address service again (it allows about one request a second).
const RECENT_LIMIT = 24;
const recent = new Map<string, ReverseGeocoded>();

/** The address at `point`, or null when it can't be found (offline, nothing there, a request that was aborted). */
export async function reverseGeocode(point: LatLng, signal?: AbortSignal): Promise<ReverseGeocoded | null> {
  const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`; // about a metre
  const known = recent.get(key);

  if (known) return known;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&lat=${point.lat}&lon=${point.lng}`,
      { signal, headers: { Accept: 'application/json' } }
    );

    if (!response.ok) return null;

    const result = (await response.json()) as { display_name?: string; address?: { postcode?: string } };

    if (!result.display_name) return null;

    const found = { label: result.display_name.slice(0, MAX_PLACE_LABEL_LENGTH), postalCode: result.address?.postcode ?? '' };

    recent.set(key, found);
    if (recent.size > RECENT_LIMIT) recent.delete(recent.keys().next().value as string);

    return found;
  } catch {
    return null;
  }
}
