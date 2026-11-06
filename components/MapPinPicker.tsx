'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Search, X } from 'lucide-react';
import PinMap, { type MapPlace } from '@/components/PinMap';
import type { LatLng } from '@/lib/map-math';
import type { PickedLocation } from '@/lib/picked-location';
import { SERVICE_AREA_MESSAGE, isInServiceArea } from '@/lib/service-area';
import { MIN_PLACE_QUERY_LENGTH, PLACE_SEARCH_DEBOUNCE_MS, searchPlaces, type PlaceResult } from '@/lib/place-search';

/**
 * "Choose on map": a window with a map to put the pin on any place (not just where the visitor is, or what they can type),
 * a search box to jump to a place by name ("North Karachi"), the address of that place under the map, and a button to use it. Used for the pickup and drop-off of an order and for sending a
 * place in the order chat. `start` is where the map opens (null: Karachi); if it is given, it can be used without moving the map.
 */
export default function MapPinPicker({
  title,
  start,
  onPick,
  onClose,
  confirmLabel = 'Use this location',
  allowOutsideServiceArea = false,
}: {
  allowOutsideServiceArea?: boolean;
  title: string;
  start: LatLng | null;
  onPick: (location: PickedLocation) => void;
  onClose: () => void;
  confirmLabel?: string;
}) {
  const [place, setPlace] = useState<MapPlace | null>(null);
  const [moving, setMoving] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [focus, setFocus] = useState<{ id: string; point: LatLng } | null>(null);
  const searches = useRef(0);
  // The pin is on a place outside the area Mangwaoo delivers in (Karachi): it can't be used.
  const outsideArea = !allowOutsideServiceArea && place !== null && !isInServiceArea(place);
  // The text of the place that was just chosen from the list: it is not searched for again.
  const chosenText = useRef('');

  const runSearch = useCallback(async (text: string, signal?: AbortSignal) => {
    setIsSearching(true);
    setSearchMessage('');

    try {
      const found = await searchPlaces(text, signal, allowOutsideServiceArea);

      if (signal?.aborted) return;

      setResults(found);
      if (found.length === 0) setSearchMessage('No place found. Try another name, or move the map.');
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;

      setResults([]);
      setSearchMessage('Could not search right now. You can still move the map to the place.');
    } finally {
      if (!signal?.aborted) setIsSearching(false);
    }
  }, [allowOutsideServiceArea]);

  // Search as the visitor types (after a short pause).
  useEffect(() => {
    const text = query.trim();

    if (text.length < MIN_PLACE_QUERY_LENGTH || text === chosenText.current) {
      setResults([]);
      setSearchMessage('');
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => void runSearch(text, controller.signal), PLACE_SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, runSearch]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();

    const text = query.trim();

    if (text.length >= MIN_PLACE_QUERY_LENGTH) void runSearch(text);
  };

  /** Moves the map to a place chosen from the list and makes it the picked place (its address is already known). */
  const choose = (result: PlaceResult) => {
    chosenText.current = result.label;
    searches.current += 1;
    setQuery(result.label);
    setResults([]);
    setSearchMessage('');
    setMoving(false);
    setPlace({ id: `${result.lat.toFixed(6)},${result.lng.toFixed(6)}`, label: result.label, postalCode: result.postalCode, lat: result.lat, lng: result.lng });
    setFocus({ id: `${result.id}:${searches.current}`, point: { lat: result.lat, lng: result.lng } });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;

    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={title} data-testid="map-picker" className="w-full max-w-md rounded-2xl bg-surface p-3 shadow-2xl sm:p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-gray-200 p-2 text-ink hover:bg-gray-100" aria-label="Close the map">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submitSearch} className="relative mb-2" role="search">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a place, e.g. North Karachi"
            aria-label="Search for a place"
            data-testid="map-picker-search"
            autoComplete="off"
            className="w-full rounded-xl border border-gray-300 bg-transparent py-2.5 pl-9 pr-9 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                chosenText.current = '';
                setQuery('');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-brand-gray hover:bg-gray-100 hover:text-ink"
              aria-label="Clear the search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}

          {results.length > 0 ? (
            <ul data-testid="map-picker-results" className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-gray-200 bg-surface shadow-lg">
              {results.map((result) => (
                <li key={result.id}>
                  <button type="button" onClick={() => choose(result)} className="block w-full px-3 py-2 text-left text-xs text-ink hover:bg-red-50">
                    {result.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {isSearching || searchMessage ? (
            <p className="absolute left-0 top-full z-20 mt-1 rounded-lg bg-surface px-2 py-1 text-xs text-brand-gray shadow" role="status">
              {isSearching ? 'Searching…' : searchMessage}
            </p>
          ) : null}
        </form>

        <PinMap
          start={start}
          focus={focus}
          settleOnMount
          onMoveStart={() => setMoving(true)}
          onSettle={(settled) => {
            setPlace(settled);
            setMoving(false);
          }}
          className="h-[52vh] max-h-[26rem] min-h-64"
        />

        <p aria-live="polite" data-testid="map-picker-address" className="mt-3 flex min-h-10 items-start gap-2 text-xs text-ink">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0 break-words">
            {moving ? 'Moving the pin…' : place ? place.label : 'Move the map to put the pin on the place, then use it.'}
          </span>
        </p>
        {outsideArea && !moving ? (
          <p role="alert" data-testid="map-picker-outside" className="mt-1 text-xs font-semibold text-danger">
            {SERVICE_AREA_MESSAGE}
          </p>
        ) : null}

        <div className="mt-2 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-100">
            Cancel
          </button>
          <button
            type="button"
            data-testid="map-picker-confirm"
            disabled={!place || moving || outsideArea}
            onClick={() => place && onPick({ label: place.label, lat: place.lat, lng: place.lng })}
            className="rounded-full bg-[#9b0000] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-red-200 hover:bg-[#840000] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
