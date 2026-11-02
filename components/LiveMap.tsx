'use client';

import { useEffect, useRef, useState } from 'react';
import { GOOGLE_MAP_ID, loadGoogleMaps, type GoogleAdvancedMarker, type GoogleMapInstance, type GooglePolyline } from '@/lib/google-maps-loader';
import type { LatLng } from '@/lib/map-math';

export type MapMarker = { id: string; kind: 'store' | 'customer' | 'rider'; point: LatLng; label: string; faded?: boolean };
export type MapLine = { id: string; from: LatLng; to: LatLng; style: 'route' | 'plan' };

function markerContent(marker: MapMarker) {
  const root = document.createElement('div');
  root.className = `relative flex h-9 w-9 items-center justify-center rounded-full shadow-lg ${marker.kind === 'store' ? 'bg-brand-dark text-white' : marker.kind === 'customer' ? 'bg-brand-red-primary text-white' : 'bg-surface text-accent ring-2 ring-accent'} ${marker.faded ? 'opacity-60 grayscale' : ''}`;
  root.setAttribute('aria-label', marker.label);
  const icon = document.createElement('span');
  icon.innerHTML = marker.kind === 'store' ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h18M5 10v10h14V10M3 10l2-7h14l2 7M9 20v-6h6v6"/></svg>' : marker.kind === 'customer' ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>' : '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="m5 17 5-8h5l4 8M8 12h8M10 9l-2-2"/></svg>';
  root.append(icon);
  const label = document.createElement('span');
  label.className = 'absolute bottom-full left-1/2 mb-1 max-w-36 -translate-x-1/2 truncate whitespace-nowrap rounded-full bg-brand-dark/85 px-2 py-0.5 text-[11px] font-semibold text-white';
  label.textContent = marker.label;
  root.append(label);
  return root;
}

/** Google live map for rider, customer and pickup points. */
export default function LiveMap({ markers, lines = [], className = '' }: { markers: MapMarker[]; lines?: MapLine[]; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRefs = useRef(new Map<string, GoogleAdvancedMarker>());
  const lineRefs = useRef(new Map<string, GooglePolyline>());
  const fittedMarkerIds = useRef<string | null>(null);
  const [error, setError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const markersRef = useRef(markers);
  markersRef.current = markers;

  useEffect(() => {
    let alive = true;
    loadGoogleMaps().then((maps) => {
      if (!alive || !hostRef.current) return;
      const map = new maps.Map(hostRef.current, {
        center: markersRef.current[0]?.point ?? { lat: 24.8607, lng: 67.0011 },
        zoom: 13,
        mapId: GOOGLE_MAP_ID,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: 'none',
        keyboardShortcuts: false,
        zoomControl: false,
      });
      mapRef.current = map;
      setMapReady(true);
      void maps.importLibrary('marker').then(({ AdvancedMarkerElement }) => {
        if (!alive) return;
        (map as GoogleMapInstance & { __advancedMarker?: typeof AdvancedMarkerElement }).__advancedMarker = AdvancedMarkerElement;
      });
    }).catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : 'Google Maps could not load.'); });
    return () => { alive = false; markerRefs.current.forEach((marker) => { marker.map = null; }); lineRefs.current.forEach((line) => line.setMap(null)); markerRefs.current.clear(); lineRefs.current.clear(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const map = mapRef.current as (GoogleMapInstance & { __advancedMarker?: new (options: Record<string, unknown>) => GoogleAdvancedMarker }) | null;
      if (!map || !hostRef.current) return;
      const maps = await loadGoogleMaps();
      const { AdvancedMarkerElement } = await maps.importLibrary('marker');
      if (!alive) return;
      const wanted = new Set(markers.map((marker) => marker.id));
      markerRefs.current.forEach((existing, id) => { if (!wanted.has(id)) { existing.map = null; markerRefs.current.delete(id); } });
      for (const marker of markers) {
        let existing = markerRefs.current.get(marker.id);
        if (!existing) {
          existing = new AdvancedMarkerElement({ map, position: marker.point, content: markerContent(marker), title: marker.label });
          markerRefs.current.set(marker.id, existing);
        } else {
          existing.position = marker.point;
          existing.title = marker.label;
          existing.content = markerContent(marker);
        }
      }
      const wantedLines = new Set(lines.map((line) => line.id));
      lineRefs.current.forEach((existing, id) => { if (!wantedLines.has(id)) { existing.setMap(null); lineRefs.current.delete(id); } });
      for (const line of lines) {
        const options = { map, path: [line.from, line.to], geodesic: true, strokeColor: line.style === 'route' ? '#C1121F' : '#4b5563', strokeOpacity: line.style === 'route' ? 0.85 : 0.7, strokeWeight: line.style === 'route' ? 4 : 3, ...(line.style === 'plan' ? { icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 4 }, offset: '0', repeat: '14px' }] } : {}) };
        const existing = lineRefs.current.get(line.id);
        if (existing) { (existing as GooglePolyline & { setOptions(options: Record<string, unknown>): void }).setOptions(options); }
        else lineRefs.current.set(line.id, new maps.Polyline(options));
      }
      const markerIds = markers.map((marker) => marker.id).sort().join('|');
      if (markers.length && fittedMarkerIds.current !== markerIds) {
        const bounds = new maps.LatLngBounds();
        markers.forEach((marker) => bounds.extend(marker.point));
        map.fitBounds(bounds, 64);
        if (markers.length === 1) map.setZoom(15);
        fittedMarkerIds.current = markerIds;
      }
    };
    void sync().catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : 'Google Maps could not load.'); });
    return () => { alive = false; };
  }, [markers, lines, mapReady]);

  return <div role="group" data-testid="live-map" aria-label={`Live map: ${markers.map((marker) => marker.label).join(', ')}`} className={`relative isolate overflow-hidden rounded-2xl bg-[#e6eaee] ${className}`}>
    <div ref={hostRef} className="absolute inset-0" />
    {error ? <div role="alert" className="absolute inset-x-3 bottom-3 rounded-lg bg-surface/95 p-2 text-xs text-danger shadow">{error}</div> : null}
  </div>;
}
