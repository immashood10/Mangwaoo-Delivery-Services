'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, Minus, Plus } from 'lucide-react';
import MapTiles, { MapAttribution } from '@/components/MapTiles';
import { clampZoom, mapPlaceId, panCenter, project, unproject, type LatLng, type MapView } from '@/lib/map-math';
import type { PickedLocation } from '@/lib/picked-location';
import { coordinateLabel, reverseGeocode } from '@/lib/reverse-geocode';

/** Karachi, where the map opens when no place is known yet. */
export const KARACHI_CENTER: LatLng = { lat: 24.8607, lng: 67.0011 };

const ZOOM_WITH_PLACE = 16;
const ZOOM_CITY = 12;
/** How long the map has to stand still before the place under the pin is looked up. */
const SETTLE_MS = 650;
const KEY_PAN_PX = 80;
/** Less than this many pixels of dragging is a tap, not a drag. */
const DRAG_THRESHOLD_PX = 4;

/** The place under the pin once the map stood still: its address (or its coordinates when none is found) and where it is. */
export type MapPlace = PickedLocation & { id: string; postalCode: string };

type Props = {
  /** Where the map first opens (null: Karachi). Only read when the map is first shown. */
  start: LatLng | null;
  /** Moves the map to a place chosen somewhere else (typing, "locate me", a saved address). A new `id` moves it; a place this map chose itself is ignored. */
  focus?: { id: string; point: LatLng } | null;
  /** Also look up the place at `start` as soon as the map is shown, so it can be confirmed without touching the map. */
  settleOnMount?: boolean;
  /** The visitor let go of the map (or zoomed, or located themselves) and it stood still: the place under the pin. Never fired before they have touched it. */
  onSettle: (place: MapPlace) => void;
  /** They began moving the map (again): the last place is stale until `onSettle` answers. */
  onMoveStart?: () => void;
  /** Size of the box (a height is needed). */
  className?: string;
};

function spread(pointers: Map<number, { x: number; y: number }>) {
  const [a, b] = [...pointers.values()];

  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * A map to choose a place on: the pin stays in the middle and the visitor moves the map under it (drag, tap a spot, scroll,
 * the + / - buttons, a pinch or the arrow keys), or jumps to where they are. When it stands still the place under the pin
 * is looked up (OpenStreetMap's address service) and handed to `onSettle`. Pictures: OpenStreetMap tiles (components/MapTiles.tsx).
 */
export default function PinMap({ start, focus = null, settleOnMount = false, onSettle, onMoveStart, className = 'h-72' }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [center, setCenter] = useState<LatLng>(start ?? KARACHI_CENTER);
  const [zoom, setZoom] = useState(start ? ZOOM_WITH_PLACE : ZOOM_CITY);
  const [touched, setTouched] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const [emittedId, setEmittedId] = useState<string | null>(null);
  const [appliedFocus, setAppliedFocus] = useState<string | null>(null);

  // What the timers and handlers below need to read without being recreated at every move.
  const latest = useRef({ center, zoom, onSettle, onMoveStart });
  const timer = useRef<number | undefined>(undefined);
  const lookup = useRef<AbortController | null>(null);
  const moving = useRef(false);
  const drag = useRef<{ x: number; y: number; center: LatLng } | null>(null);
  const dragging = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);

  useEffect(() => {
    latest.current = { center, zoom, onSettle, onMoveStart };
  });

  useEffect(() => {
    const box = boxRef.current;

    if (!box) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;

      setSize((current) => (current && Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1 ? current : { width, height }));
    });

    observer.observe(box);

    return () => observer.disconnect();
  }, []);

  const settle = useCallback(async () => {
    timer.current = undefined;
    moving.current = false;

    const point = latest.current.center;

    lookup.current?.abort();

    const controller = new AbortController();

    lookup.current = controller;

    const found = await reverseGeocode(point, controller.signal);

    if (controller.signal.aborted) return;

    const id = mapPlaceId(point);

    setEmittedId(id);
    latest.current.onSettle({
      id,
      label: found?.label ?? coordinateLabel(point),
      postalCode: found?.postalCode ?? '',
      lat: point.lat,
      lng: point.lng,
    });
  }, []);

  // Every way of moving the map ends here: the first move tells the parent, and a still map (for a moment) is looked up.
  const scheduleSettle = useCallback(() => {
    setTouched(true);

    if (!moving.current) {
      moving.current = true;
      latest.current.onMoveStart?.();
    }

    lookup.current?.abort();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void settle(), SETTLE_MS);
  }, [settle]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      lookup.current?.abort();
    },
    []
  );

  // A parent that wants the start confirmed at once (the "choose on map" window) asks for a first lookup.
  useEffect(() => {
    if (!settleOnMount || !start) return;

    const timeout = window.setTimeout(() => void settle(), 0);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the map is first shown
  }, []);

  // A place chosen somewhere else moves the map there (adjusting state while rendering, React's pattern for state that follows props).
  if (focus && focus.id !== appliedFocus) {
    setAppliedFocus(focus.id);

    if (focus.id !== emittedId) {
      setCenter(focus.point);
      setZoom((current) => Math.max(current, ZOOM_WITH_PLACE));
    }
  }

  const zoomBy = useCallback(
    (delta: number) => {
      setZoom((current) => clampZoom(current + delta));
      scheduleSettle();
    },
    [scheduleSettle]
  );

  // The mouse wheel zooms. (A listener of its own: React's wheel handler is passive and could not stop the page from scrolling.)
  useEffect(() => {
    const box = boxRef.current;

    if (!box) return;

    let last = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      const now = performance.now();

      if (now - last < 220) return;

      last = now;
      zoomBy(event.deltaY < 0 ? 1 : -1);
    };

    box.addEventListener('wheel', onWheel, { passive: false });

    return () => box.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-map-control]')) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 1) {
      drag.current = { x: event.clientX, y: event.clientY, center: latest.current.center };
      dragging.current = false;
    } else if (pointers.current.size === 2) {
      drag.current = null;
      pinch.current = spread(pointers.current);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;

    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // Two fingers: spreading them zooms in, pinching zooms out (a step each time they have moved far enough).
    if (pointers.current.size >= 2 && pinch.current !== null) {
      const now = spread(pointers.current);

      if (now > pinch.current * 1.7) {
        zoomBy(1);
        pinch.current = now;
      } else if (now < pinch.current * 0.6) {
        zoomBy(-1);
        pinch.current = now;
      }

      return;
    }

    const origin = drag.current;

    if (!origin) return;

    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;

    if (!dragging.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD_PX) return;

    dragging.current = true;
    setCenter(panCenter(origin.center, latest.current.zoom, dx, dy));
    scheduleSettle();
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;

    if (pointers.current.size < 2) pinch.current = null;

    // A tap (the finger or mouse hardly moved) puts the pin on the tapped spot: the map moves so that spot is under it.
    if (event.type === 'pointerup' && pointers.current.size === 0 && drag.current && !dragging.current) {
      const box = boxRef.current;

      if (box) {
        const rect = box.getBoundingClientRect();
        const world = project(latest.current.center, latest.current.zoom);
        const tapped = unproject(
          { x: world.x + (event.clientX - rect.left - rect.width / 2), y: world.y + (event.clientY - rect.top - rect.height / 2) },
          latest.current.zoom
        );

        setCenter(panCenter(tapped, latest.current.zoom, 0, 0));
        scheduleSettle();
      }
    }

    if (pointers.current.size === 1) {
      const [only] = [...pointers.current.values()];

      drag.current = { x: only.x, y: only.y, center: latest.current.center };
      dragging.current = true;
    } else if (pointers.current.size === 0) {
      drag.current = null;
      dragging.current = false;
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const pan = (dx: number, dy: number) => {
      event.preventDefault();
      setCenter(panCenter(latest.current.center, latest.current.zoom, dx, dy));
      scheduleSettle();
    };

    if (event.key === 'ArrowLeft') pan(KEY_PAN_PX, 0);
    else if (event.key === 'ArrowRight') pan(-KEY_PAN_PX, 0);
    else if (event.key === 'ArrowUp') pan(0, KEY_PAN_PX);
    else if (event.key === 'ArrowDown') pan(0, -KEY_PAN_PX);
    else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(1);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomBy(-1);
    }
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
        setLocating(false);
        setCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
        setZoom(17);
        scheduleSettle();
      },
      () => {
        setLocating(false);
        setLocateError('Please allow location access, or move the map to the place instead.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  const view: MapView | null = size && size.width > 0 && size.height > 0 ? { zoom, center: project(center, zoom), width: size.width, height: size.height } : null;
  const controlClass =
    'flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink shadow-md ring-1 ring-black/5 transition hover:bg-brand-light disabled:cursor-wait disabled:opacity-70';

  return (
    <div
      ref={boxRef}
      role="application"
      tabIndex={0}
      data-testid="pin-map"
      data-lat={center.lat.toFixed(6)}
      data-lng={center.lng.toFixed(6)}
      data-zoom={zoom}
      aria-label="Map. Drag the map, or tap a spot, to put the pin on the place you want. Arrow keys move the map; plus and minus zoom."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onKeyDown={onKeyDown}
      className={`relative isolate cursor-grab touch-none select-none overflow-hidden rounded-xl bg-[#e6eaee] outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing ${className}`}
    >
      {view ? (
        <>
          <MapTiles view={view} />

          {/* The pin: its tip is the exact middle of the map, which is the place that gets chosen. */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40" aria-hidden="true" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[92%]" aria-hidden="true" data-testid="pin-map-pin">
            <MapPin className="h-10 w-10 fill-brand-red-primary text-white drop-shadow-lg" strokeWidth={1.5} />
          </div>

          {!touched ? (
            <p className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-dark/80 px-3 py-1 text-xs font-semibold text-white">
              Drag the map to put the pin on the place
            </p>
          ) : null}

          <div data-map-control className="absolute right-2 top-2 flex flex-col gap-1.5">
            <button type="button" onClick={() => zoomBy(1)} disabled={zoom >= 18} className={controlClass} aria-label="Zoom in" title="Zoom in">
              <Plus className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => zoomBy(-1)} disabled={zoom <= 3} className={controlClass} aria-label="Zoom out" title="Zoom out">
              <Minus className="h-4 w-4" />
            </button>
          </div>
          <div data-map-control className="absolute bottom-5 left-2">
            <button type="button" onClick={locateMe} disabled={locating} className={controlClass} aria-label="Show my location" title="Show my location">
              <LocateFixed className={`h-4 w-4 ${locating ? 'animate-pulse text-accent' : ''}`} />
            </button>
          </div>
          {locateError ? (
            <p role="alert" className="absolute bottom-5 left-12 right-2 rounded-lg bg-white/95 px-2 py-1 text-xs text-danger shadow">
              {locateError}
            </p>
          ) : null}

          <MapAttribution />
        </>
      ) : null}
    </div>
  );
}
