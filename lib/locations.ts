// Where a seller's store is based (shown on the store page and on each ad).
// Client-safe: shared by the signup form, the store-profile editor and the API.

export const DEFAULT_COUNTRY = 'Pakistan';
export const MAX_PLACE_LENGTH = 60;

export const PAKISTAN_CITIES = [
  'Karachi',
  'Lahore',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Hyderabad',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Gujranwala',
] as const;

/** Trims and collapses whitespace; anything that isn't a string becomes ''. */
export function cleanPlace(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/** A shop / kitchen pinned on the map. */
export type StoreLocation = { label: string; lat: number; lng: number };

export const MAX_LOCATION_LABEL_LENGTH = 300;

/**
 * Reads a pinned location from request JSON:
 *  - `undefined` when the field is absent (leave the stored location alone),
 *  - `null` when it is explicitly cleared,
 *  - a clean location when valid, otherwise `'invalid'`.
 */
export function parseStoreLocation(value: unknown): StoreLocation | null | undefined | 'invalid' {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return 'invalid';

  const { label, lat, lng } = value as Record<string, unknown>;
  const cleanLabel = cleanPlace(label);

  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180 ||
    !cleanLabel ||
    cleanLabel.length > MAX_LOCATION_LABEL_LENGTH
  ) {
    return 'invalid';
  }

  return { label: cleanLabel, lat, lng };
}

/** "Karachi, Pakistan" — or just the country when the seller hasn't set a city. */
export function formatLocation(city: string | null | undefined, country: string | null | undefined) {
  return [city, country].filter(Boolean).join(', ');
}
