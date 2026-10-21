import type { DeliveryAddress } from '@/lib/delivery-address-context';

/** A problem getting the visitor's location, with a message that is safe to show them. */
export class LocationError extends Error {}

function getPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new LocationError('Location access is not supported in this browser. Please type your address instead.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      (error) =>
        reject(
          new LocationError(
            error.code === error.PERMISSION_DENIED
              ? 'Location access was denied. You can type your address instead.'
              : 'Could not detect your location. Please type your address instead.'
          )
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

type ReverseGeocodeResult = {
  display_name?: string;
  address?: {
    postcode?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    town?: string;
    village?: string;
    city?: string;
  };
};

/**
 * Asks the browser for the visitor's position (this shows the browser's own permission
 * question) and names it, e.g. "Block 5, Clifton". If naming fails the coordinates are
 * still used — they are what matters for finding what is nearby.
 */
export async function detectCurrentLocation(): Promise<DeliveryAddress> {
  const { latitude, longitude } = await getPosition();
  let label = 'My current location';
  let postalCode = '';

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${latitude}&lon=${longitude}`,
      { headers: { Accept: 'application/json' } }
    );

    if (response.ok) {
      const result = (await response.json()) as ReverseGeocodeResult;
      const address = result.address ?? {};
      const areaName =
        address.suburb ||
        address.neighbourhood ||
        address.city_district ||
        address.town ||
        address.village ||
        address.city ||
        '';
      label = [address.house_number, areaName].filter(Boolean).join(', ') || result.display_name || label;
      postalCode = address.postcode ?? '';
    }
  } catch {
    // Keep the generic label.
  }

  return { id: `current-${latitude}-${longitude}`, label, postalCode, lat: latitude, lng: longitude };
}

// ── What we remember between visits ─────────────────────────────────────────
// Whether the visitor has been asked for their location, and the spot they shared, so the question is
// asked once and the delivery address is still set when they come back. This lives in the database
// (see /api/visitor); the browser only holds an opaque cookie that says which visitor it is.

export type VisitorState = { prompted: boolean; location: DeliveryAddress | null };

export async function fetchVisitorState(): Promise<VisitorState> {
  const response = await fetch('/api/visitor');
  if (!response.ok) {
    throw new Error('Could not load visitor details');
  }

  const data = (await response.json()) as {
    prompted?: boolean;
    location?: { label: string; postalCode?: string; lat: number; lng: number } | null;
  };

  return {
    prompted: Boolean(data.prompted),
    location: data.location
      ? {
          id: `current-${data.location.lat}-${data.location.lng}`,
          label: data.location.label,
          postalCode: data.location.postalCode ?? '',
          lat: data.location.lat,
          lng: data.location.lng,
        }
      : null,
  };
}

/** Remembers an answer (and optionally the location) for this visitor. A failure is not worth interrupting anyone for. */
export async function saveVisitorState(update: { prompted?: true; location?: DeliveryAddress | null }) {
  try {
    await fetch('/api/visitor', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(update.prompted ? { prompted: true } : {}),
        ...(update.location === undefined
          ? {}
          : {
              location: update.location
                ? { label: update.location.label, postalCode: update.location.postalCode, lat: update.location.lat, lng: update.location.lng }
                : null,
            }),
      }),
    });
  } catch {
    // Offline or server trouble: they'll just be asked again next time.
  }
}
