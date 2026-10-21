'use client';

import { useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { useFavourites, type FavouriteKind } from '@/lib/favourites-context';

const VARIANT_CLASSES = {
  /** A round heart on top of a photo or card. */
  overlay: {
    base: 'flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 shadow ring-1 ring-black/5 backdrop-blur transition-colors',
    saved: 'text-accent',
    idle: 'text-ink hover:text-accent',
  },
  /** Heart with a "Save" label, readable on a dark banner. */
  glass: {
    base: 'inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-sm font-semibold backdrop-blur transition-colors',
    saved: 'text-white hover:bg-black/50',
    idle: 'text-white hover:bg-black/50',
  },
  /** Heart with a "Save" label on a plain page. */
  outline: {
    base: 'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors',
    saved: 'border-accent bg-brand-red-primary/10 text-accent',
    idle: 'border-gray-200 text-ink hover:border-accent hover:text-accent',
  },
} as const;

/** The ♡ that saves a restaurant or dish to the user's Favourites. Guests are asked to sign in first. */
export default function FavouriteButton({
  kind,
  id,
  name,
  variant = 'overlay',
  className = '',
}: {
  kind: FavouriteKind;
  id: string;
  /** What is being saved, for screen readers. */
  name: string;
  variant?: keyof typeof VARIANT_CLASSES;
  className?: string;
}) {
  const { isFavourite, toggle } = useFavourites();
  const saved = isFavourite(kind, id);
  const [error, setError] = useState('');
  const isBusy = useRef(false);
  const styles = VARIANT_CLASSES[variant];
  // The error bubble is positioned against this wrapper, so it must be positioned itself — but not
  // `relative` when the caller already places it (absolute), which would cancel that.
  const isPlacedByCaller = /\b(absolute|fixed|sticky)\b/.test(className);

  const handleClick = async (event: React.MouseEvent) => {
    // These hearts often sit on cards that are links themselves.
    event.preventDefault();
    event.stopPropagation();

    if (isBusy.current) return;
    isBusy.current = true;
    setError('');

    const result = await toggle(kind, id);
    if (!result.ok && result.error) setError(result.error);

    isBusy.current = false;
  };

  return (
    <div className={`${isPlacedByCaller ? '' : 'relative'} ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
        title={saved ? 'Saved to favourites' : 'Save to favourites'}
        className={`${styles.base} ${saved ? styles.saved : styles.idle}`}
      >
        <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
        {variant === 'overlay' ? null : <span>{saved ? 'Saved' : 'Save'}</span>}
      </button>
      {error ? (
        <p
          role="alert"
          className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-gray-100 bg-surface p-3 text-xs text-danger shadow-lg"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
