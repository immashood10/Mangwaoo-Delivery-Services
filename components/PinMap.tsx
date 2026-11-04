'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, Minus, Plus } from 'lucide-react';
import { setWorkerUrl } from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { PICKER_MAP_STYLE_URL } from '@/lib/map-config';
import type { PickedLocation } from '@/lib/picked-location';
import { coordinateLabel, reverseGeocode } from '@/lib/reverse-geocode';

/** Karachi, where the map opens when no place is known yet. */
export const KARACHI_CENTER = { lat: 24.8607, lng: 67.0011 };
const ZOOM_WITH_PLACE = 16;
const ZOOM_CITY = 12;
const MIN_ZOOM = 3;
const MAX_ZOOM = 20;
/** How long the map must stand still before the place under the pin is looked up. */
const SETTLE_MS = 450;
const FOCUS_EASE_MS = 600;
/** Two points closer than this many degrees (about 5 m) are the same spot. */
const FOCUS_SAME_SPOT = 0.00005;
export type MapPlace = PickedLocation & { id: string; postalCode: string };

type Props = {
  start: { lat: number; lng: number } | null;
  focus?: { id: string; point: { lat: number; lng: number } } | null;
  settleOnMount?: boolean;
  onSettle: (place: MapPlace) => void;
  onMoveStart?: () => void;
  className?: string;
};

/** Free vector map picker with a fixed center pin; address lookup uses the existing Nominatim service. */
export default function PinMap({ start, focus = null, settleOnMount = false, onSettle, onMoveStart, className = 'h-72' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const callbacks = useRef({ onSettle, onMoveStart });
  const focusId = useRef<string | null>(null);
  /** True while the map is moving to the `focus` place by itself. */
  const followingFocus = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const loadTimer = useRef<number | undefined>(undefined);
  const lookup = useRef<AbortController | null>(null);
  const initialPoint = start ?? KARACHI_CENTER;
  const [center, setCenter] = useState(initialPoint);
  const [zoom, setZoom] = useState(start ? ZOOM_WITH_PLACE : ZOOM_CITY);
  const [mapReady, setMapReady] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    callbacks.current = { onSettle, onMoveStart };
  }, [onSettle, onMoveStart]);

  const settle = useCallback(async (point: { lat: number; lng: number }) => {
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    const found = await reverseGeocode(point, controller.signal);
    if (controller.signal.aborted) return;

    const id = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
    callbacks.current.onSettle({ id, label: found?.label ?? coordinateLabel(point), postalCode: found?.postalCode ?? '', ...point });
    setMoving(false);
  }, []);

  useEffect(() => {
    let alive = true;
    let map: MapLibreMap | null = null;

    void import('maplibre-gl')
      .then((maplibregl) => {
        if (!alive || !hostRef.current) return;

        setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());
        const mapInstance = new maplibregl.Map({
          container: hostRef.current,
          style: PICKER_MAP_STYLE_URL,
          center: [initialPoint.lng, initialPoint.lat],
          zoom: start ? ZOOM_WITH_PLACE : ZOOM_CITY,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          attributionControl: {},
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          cooperativeGestures: false,
        });
        map = mapInstance;
        mapRef.current = mapInstance;

        // The map moving by itself to a place whose address is already known (see the `focus` effect) is not the visitor
        // moving the pin: it must not clear the chosen address or look it up again. A drag, wheel or key press carries
        // `originalEvent`, so it is never mistaken for that.
        const handleMoveStart = (event: { originalEvent?: unknown }) => {
          if (followingFocus.current && !event.originalEvent) return;

          callbacks.current.onMoveStart?.();
          setMoving(true);
          window.clearTimeout(timer.current);
          lookup.current?.abort();
        };
        const handleMoveEnd = (event: { originalEvent?: unknown }) => {
          const point = mapInstance.getCenter();
          if (!point) return;

          setCenter({ lat: point.lat, lng: point.lng });
          setZoom(Math.round(mapInstance.getZoom()));

          if (followingFocus.current && !event.originalEvent) {
            followingFocus.current = false;
            return;
          }

          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            void settle({ lat: point.lat, lng: point.lng });
          }, SETTLE_MS);
        };
        const handleLoad = () => {
          window.clearTimeout(loadTimer.current);
          setLoadingError('');
          setMapReady(true);
          if (settleOnMount) {
            const point = mapInstance.getCenter();
            if (point) void settle({ lat: point.lat, lng: point.lng });
          }
        };

        mapInstance.on('movestart', handleMoveStart);
        mapInstance.on('moveend', handleMoveEnd);
        mapInstance.once('load', handleLoad);
        loadTimer.current = window.setTimeout(() => {
          if (alive && !map?.isStyleLoaded()) setLoadingError('The free map is taking too long to load. Please try again.');
        }, 15000);
      })
      .catch((error: unknown) => {
        if (alive) setLoadingError(error instanceof Error ? error.message : 'The free map could not load.');
      });

    return () => {
      alive = false;
      window.clearTimeout(timer.current);
      window.clearTimeout(loadTimer.current);
      lookup.current?.abort();
      map?.remove();
      mapRef.current = null;
    };
  // The map is created once for this picker; initial coordinates are captured at mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapReady || !map || !focus || focus.id === focusId.current) return;
    focusId.current = focus.id;

    // The place the visitor just put the pin on is already under the pin: nothing to move to (moving anyway zoomed the map
    // in by itself and started another address lookup).
    const here = map.getCenter();

    if (Math.abs(here.lat - focus.point.lat) < FOCUS_SAME_SPOT && Math.abs(here.lng - focus.point.lng) < FOCUS_SAME_SPOT) return;

    // An address lookup for the spot the map is leaving must not land on the place being moved to.
    window.clearTimeout(timer.current);
    lookup.current?.abort();
    followingFocus.current = true;
    window.setTimeout(() => {
      followingFocus.current = false;
    }, FOCUS_EASE_MS + 800);
    map.easeTo({
      center: [focus.point.lng, focus.point.lat],
      zoom: Math.max(map.getZoom(), ZOOM_WITH_PLACE),
      duration: FOCUS_EASE_MS,
    });
  }, [focus, mapReady]);

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.zoomTo(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, map.getZoom() + delta)));
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      setLocateError('Location is not supported in this browser.');
      return;
    }

    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        mapRef.current?.easeTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 17,
          duration: 600,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocateError('Please allow location access, or move the map to the place instead.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  const controlClass = 'flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink shadow-md ring-1 ring-black/5 transition hover:bg-brand-light disabled:cursor-wait disabled:opacity-70';

  return (
    <div className={`relative isolate overflow-hidden rounded-xl bg-[#e6eaee] ${className}`}>
      {/* MapLibre's own stylesheet sets `position: relative` on the element it draws in, and (not being in a CSS layer) it beats
          Tailwind's `absolute inset-0` on that same element: the map ended up 0 px high, blank and impossible to drag. So the
          map's element is plain and only fills this absolutely placed box. */}
      <div className="absolute inset-0">
        <div
          ref={hostRef}
          role="application"
          tabIndex={0}
          data-testid="pin-map"
          data-lat={center.lat.toFixed(6)}
          data-lng={center.lng.toFixed(6)}
          data-zoom={zoom}
          aria-label="Map. Drag to move the map under the pin and choose a place."
          className="h-full w-full"
        />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[92%]" aria-hidden="true" data-testid="pin-map-pin">
        <MapPin className="h-10 w-10 fill-brand-red-primary text-white drop-shadow-lg" strokeWidth={1.5} />
      </div>
      {!moving ? (
        <p className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-dark/80 px-3 py-1 text-xs font-semibold text-white">
          Drag the map to put the pin on the place
        </p>
      ) : null}
      <div className="absolute right-2 top-2 flex flex-col gap-1.5">
        <button type="button" onClick={() => zoomBy(1)} className={controlClass} aria-label="Zoom in">
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} className={controlClass} aria-label="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
        {/* Not at the bottom: the map's credit text opens there and covered this button on a phone. */}
        <button type="button" onClick={locateMe} disabled={locating} className={controlClass} aria-label="Show my location">
          <LocateFixed className={`h-4 w-4 ${locating ? 'animate-pulse text-accent' : ''}`} />
        </button>
      </div>
      {locateError || loadingError ? (
        <p role="alert" className="absolute bottom-8 left-2 right-2 rounded-lg bg-surface/95 px-2 py-1 text-xs text-danger shadow">
          {locateError || loadingError}
        </p>
      ) : null}
    </div>
  );
}
