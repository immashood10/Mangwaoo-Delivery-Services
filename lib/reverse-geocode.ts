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

/** The address at `point`, or null when it can't be found (offline, nothing there, a request that was aborted). */
export async function reverseGeocode(point: LatLng, signal?: AbortSignal): Promise<ReverseGeocoded | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&lat=${point.lat}&lon=${point.lng}`,
      { signal, headers: { Accept: 'application/json' } }
    );

    if (!response.ok) return null;

    const result = (await response.json()) as { display_name?: string; address?: { postcode?: string } };

    if (!result.display_name) return null;

    return { label: result.display_name.slice(0, MAX_PLACE_LABEL_LENGTH), postalCode: result.address?.postcode ?? '' };
  } catch {
    return null;
  }
}
