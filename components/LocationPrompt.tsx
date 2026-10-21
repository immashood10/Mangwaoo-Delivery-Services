'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Keyboard, LocateFixed, MapPin } from 'lucide-react';

/**
 * The first-visit question: may we use your location? It comes before the browser's own
 * permission box, so the visitor knows why it is being asked and can still choose to type an address.
 */
export default function LocationPrompt({
  isLocating,
  error,
  onUseCurrentLocation,
  onChooseManually,
  onDismiss,
}: {
  isLocating: boolean;
  error: string;
  onUseCurrentLocation: () => void;
  onChooseManually: () => void;
  onDismiss: () => void;
}) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  // The parent passes a new function every render; keep the latest one without re-running the effect below.
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    primaryRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-prompt-title"
        aria-describedby="location-prompt-text"
        className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl"
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
          <MapPin className="h-6 w-6" />
        </div>

        <h2 id="location-prompt-title" className="text-xl font-bold text-ink">
          Where should we deliver?
        </h2>
        <p id="location-prompt-text" className="mt-2 text-sm text-brand-gray">
          Share your location and we&apos;ll show the restaurants and shops nearest to you, and deliver to the right place.
        </p>

        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-5 space-y-2">
          <button
            ref={primaryRef}
            type="button"
            onClick={onUseCurrentLocation}
            disabled={isLocating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-5 py-3 text-sm font-semibold text-white transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
          >
            <LocateFixed className={`h-4 w-4 ${isLocating ? 'animate-pulse' : ''}`} />
            {isLocating ? 'Finding your location…' : 'Use my current location'}
          </button>
          <button
            type="button"
            onClick={onChooseManually}
            disabled={isLocating}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent disabled:opacity-60"
          >
            <Keyboard className="h-4 w-4" />
            Enter my address instead
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={isLocating}
            className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-brand-gray transition hover:text-ink disabled:opacity-60"
          >
            Not now
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
