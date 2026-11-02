'use client';

export type GooglePoint = { lat: number; lng: number };

export type GoogleMapInstance = {
  addListener(eventName: string, handler: () => void): { remove(): void };
  getCenter(): { lat(): number; lng(): number } | null;
  getZoom(): number | undefined;
  getBounds(): GoogleBounds | undefined;
  setCenter(point: GooglePoint): void;
  panTo(point: GooglePoint): void;
  setZoom(zoom: number): void;
  fitBounds(bounds: GoogleBounds, padding?: number): void;
};

export type GoogleBounds = {
  extend(point: GooglePoint): void;
  contains(point: GooglePoint): boolean;
};

export type GoogleAdvancedMarker = {
  map: GoogleMapInstance | null;
  position: GooglePoint | null;
  content: Node | null;
  title: string;
  gmpDraggable: boolean;
  addListener(eventName: string, handler: () => void): { remove(): void };
};

export type GooglePolyline = {
  setMap(map: GoogleMapInstance | null): void;
};

export type GoogleMapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
  LatLngBounds: new () => GoogleBounds;
  Polyline: new (options: Record<string, unknown>) => GooglePolyline;
  importLibrary(name: 'marker'): Promise<{ AdvancedMarkerElement: new (options: Record<string, unknown>) => GoogleAdvancedMarker }>;
};

declare global {
  interface Window {
    google?: { maps: GoogleMapsApi };
  }
}

export const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID';

let apiPromise: Promise<GoogleMapsApi> | null = null;

/** Loads Google's map script once per page and returns its map namespace. */
export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps can only load in a browser.'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (apiPromise) return apiPromise;

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error('Google Maps is not configured. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to the site environment.'));

  apiPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'mangwaoo-google-maps-api';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error('Google Maps did not initialize. Check the API key and enabled APIs.'));
    };
    script.onerror = () => reject(new Error('Could not load Google Maps. Check your connection and API key.'));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    apiPromise = null;
    throw error;
  });

  return apiPromise;
}
