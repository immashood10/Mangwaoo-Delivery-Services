'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, Search, X } from 'lucide-react';

export type PickedLocation = {
  label: string;
  lat: number;
  lng: number;
};

type Suggestion = PickedLocation & { id: string };

// Karachi bounding box (west, north, east, south) — keeps results relevant.
const KARACHI_VIEWBOX = '66.75,25.06,67.17,24.78';
const MIN_QUERY_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 400;

/** Address search (OpenStreetMap) plus a "use my current location" shortcut. */
export default function LocationPicker({
  value,
  onChange,
  placeholder = 'Search a shop, area or street',
  changeLabel = 'Change pickup location',
}: {
  value: PickedLocation | null;
  onChange: (location: PickedLocation | null) => void;
  placeholder?: string;
  /** Accessible name of the button that clears the chosen location. */
  changeLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState('');
  const lastSelectedRef = useRef('');

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH || trimmed === lastSelectedRef.current) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setError('');

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&viewbox=${KARACHI_VIEWBOX}&bounded=1&q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal, headers: { Accept: 'application/json' } }
        );
        if (!response.ok) throw new Error('search failed');

        const results = (await response.json()) as Array<{ place_id: number; display_name: string; lat: string; lon: string }>;
        setSuggestions(
          results.map((result) => ({
            id: String(result.place_id),
            label: result.display_name,
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
          }))
        );
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError('Could not search right now. Try “Use my current location”.');
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const select = (location: PickedLocation) => {
    lastSelectedRef.current = location.label;
    setSuggestions([]);
    setQuery('');
    onChange(location);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is not supported in this browser.');
      return;
    }

    setIsLocating(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        let label = 'My current location';
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`,
            { headers: { Accept: 'application/json' } }
          );
          if (response.ok) {
            const result = (await response.json()) as { display_name?: string };
            if (result.display_name) label = result.display_name;
          }
        } catch {
          // Keep the generic label; the coordinates are what matter.
        }
        setIsLocating(false);
        select({ label, lat: coords.latitude, lng: coords.longitude });
      },
      () => {
        setIsLocating(false);
        setError('Please allow location access, or search for the place instead.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  if (value) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-surface p-3 text-xs text-ink">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <p className="line-clamp-2 min-w-0 flex-1">{value.label}</p>
        <button
          type="button"
          onClick={() => {
            lastSelectedRef.current = '';
            onChange(null);
          }}
          className="shrink-0 rounded-full p-1 text-brand-gray hover:bg-gray-100 hover:text-ink"
          aria-label={changeLabel}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
        />
      </div>

      {suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-gray-200 bg-surface shadow-lg">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                onClick={() => select(suggestion)}
                className="block w-full px-3 py-2 text-left text-xs text-ink hover:bg-red-50"
              >
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={isLocating}
          className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-red-100 disabled:opacity-60"
        >
          <LocateFixed className={`h-3.5 w-3.5 ${isLocating ? 'animate-pulse' : ''}`} />
          {isLocating ? 'Locating…' : 'Use my current location'}
        </button>
        {isSearching ? <span className="text-xs text-brand-gray">Searching…</span> : null}
      </div>

      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
