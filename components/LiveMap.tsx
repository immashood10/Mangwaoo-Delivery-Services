'use client';

import { useEffect, useRef, useState } from 'react';
import { Bike, House, Store } from 'lucide-react';
import MapTiles, { MapAttribution } from '@/components/MapTiles';
import { fitView, isInsideView, viewPosition, type LatLng, type MapView } from '@/lib/map-math';

export type MapMarker = {
  id: string;
  kind: 'store' | 'customer' | 'rider';
  point: LatLng;
  /** Shown above the pin and read out for screen readers. */
  label: string;
  /** The rider's position is old: the pin is greyed and does not pulse. */
  faded?: boolean;
};

export type MapLine = {
  id: string;
  from: LatLng;
  to: LatLng;
  /** `route`: where the rider is heading. `plan`: the restaurant to the customer, as a faint guide. */
  style: 'route' | 'plan';
};

// Pixels kept clear around the points when the map fits them; a point closer to the edge than EDGE (the rider driving off the
// side) makes the map fit again, otherwise the view stays put and only the pins move.
const FIT_PADDING = 64;
const EDGE = 28;

const PIN_STYLE: Record<MapMarker['kind'], string> = {
  store: 'bg-brand-dark text-white',
  customer: 'bg-brand-red-primary text-white',
  rider: 'bg-white text-brand-red-primary ring-2 ring-brand-red-primary',
};

function samePlace(a: MapView, b: MapView) {
  return a.zoom === b.zoom && Math.abs(a.center.x - b.center.x) < 0.5 && Math.abs(a.center.y - b.center.y) < 0.5 && a.width === b.width && a.height === b.height;
}

/**
 * A small live map: the restaurant, the customer and the rider on OpenStreetMap tiles, framed to show all of them. The
 * rider's pin glides to each new position. There is no zooming or dragging: it is a picture of where things are, and the
 * order page links to Google Maps for anything more. If the tiles can't load, the pins and lines still show on a plain
 * background.
 */
export default function LiveMap({ markers, lines = [], className = '' }: { markers: MapMarker[]; lines?: MapLine[]; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [view, setView] = useState<MapView | null>(null);

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

  // The view is kept while every pin is still well inside it, so a moving rider does not make the tiles jump about; when a pin
  // gets near the edge (or the box changes size) the map is fitted again. (Adjusting state while rendering: React's own
  // pattern for state that follows props, and it settles at once because a fitted view always has every pin inside.)
  const points = markers.map((marker) => marker.point);

  if (size && size.width > 0 && size.height > 0 && points.length > 0) {
    const outdated = !view || view.width !== size.width || view.height !== size.height || points.some((point) => !isInsideView(view, point, EDGE));

    if (outdated) {
      const next = fitView(points, size, FIT_PADDING);

      if (next && (!view || !samePlace(view, next))) setView(next);
    }
  }

  const viewKey = view ? `${view.zoom}:${Math.round(view.center.x)}:${Math.round(view.center.y)}` : 'none';

  return (
    <div
      ref={boxRef}
      role="group"
      data-testid="live-map"
      aria-label={`Live map: ${markers.map((marker) => marker.label).join(', ')}`}
      className={`relative isolate overflow-hidden rounded-2xl bg-[#e6eaee] ${className}`}
    >
      {view ? (
        <>
          <MapTiles view={view} />

          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            {lines.map((line) => {
              const from = viewPosition(view, line.from);
              const to = viewPosition(view, line.to);

              return (
                <line
                  key={line.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={line.style === 'route' ? '#C1121F' : '#4b5563'}
                  strokeWidth={line.style === 'route' ? 4 : 3}
                  strokeLinecap="round"
                  strokeDasharray={line.style === 'route' ? undefined : '2 9'}
                  opacity={line.style === 'route' ? 0.85 : 0.7}
                />
              );
            })}
          </svg>

          {markers.map((marker) => {
            const { x, y } = viewPosition(view, marker.point);

            return (
              // After the map has been fitted again the pin is placed at once (new key); only a pin that moves inside the same view glides.
              <div
                key={`${marker.id}@${viewKey}`}
                data-marker={marker.id}
                className="pointer-events-none absolute left-0 top-0 transition-transform duration-[4000ms] ease-linear will-change-transform"
                style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}
              >
                <div className="-translate-x-1/2 -translate-y-1/2">
                  <span className="absolute bottom-full left-1/2 mb-1 max-w-[9rem] -translate-x-1/2 truncate whitespace-nowrap rounded-full bg-brand-dark/85 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {marker.label}
                  </span>
                  <span className={`relative flex h-9 w-9 items-center justify-center rounded-full shadow-lg ${PIN_STYLE[marker.kind]} ${marker.faded ? 'opacity-60 grayscale' : ''}`}>
                    {marker.kind === 'rider' && !marker.faded ? <span className="absolute inset-0 animate-ping rounded-full bg-brand-red-primary/30" /> : null}
                    {marker.kind === 'store' ? <Store className="relative h-4 w-4" /> : marker.kind === 'customer' ? <House className="relative h-4 w-4" /> : <Bike className="relative h-[18px] w-[18px]" />}
                  </span>
                </div>
              </div>
            );
          })}

          <MapAttribution />
        </>
      ) : null}
    </div>
  );
}
