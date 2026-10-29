'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, X } from 'lucide-react';
import PinMap, { type MapPlace } from '@/components/PinMap';
import type { LatLng } from '@/lib/map-math';
import type { PickedLocation } from '@/lib/picked-location';

/**
 * "Choose on map": a window with a map to put the pin on any place (not just where the visitor is, or what they can type),
 * the address of that place under it, and a button to use it. Used for the pickup and drop-off of an order and for sending a
 * place in the order chat. `start` is where the map opens (null: Karachi); if it is given, it can be used without moving the map.
 */
export default function MapPinPicker({
  title,
  start,
  onPick,
  onClose,
  confirmLabel = 'Use this location',
}: {
  title: string;
  start: LatLng | null;
  onPick: (location: PickedLocation) => void;
  onClose: () => void;
  confirmLabel?: string;
}) {
  const [place, setPlace] = useState<MapPlace | null>(null);
  const [moving, setMoving] = useState(false);

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

        <PinMap
          start={start}
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

        <div className="mt-2 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-100">
            Cancel
          </button>
          <button
            type="button"
            data-testid="map-picker-confirm"
            disabled={!place || moving}
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
