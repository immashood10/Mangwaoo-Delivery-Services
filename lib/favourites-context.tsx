'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './auth-context';

export type FavouriteKind = 'RESTAURANT' | 'DISH';

type ToggleResult = { ok: true } | { ok: false; error: string };

type FavouritesContextValue = {
  isFavourite: (kind: FavouriteKind, id: string) => boolean;
  /** Saves or removes a favourite. Guests are asked to sign in instead. */
  toggle: (kind: FavouriteKind, id: string) => Promise<ToggleResult>;
};

const FavouritesContext = createContext<FavouritesContextValue | null>(null);

const keyOf = (kind: FavouriteKind, id: string) => `${kind}:${id}`;

/**
 * Which restaurants and dishes the signed-in user has saved, so every heart on the site can show
 * its state. The list lives in the database (nothing in the browser): it is loaded after login and
 * each change is saved straight away.
 */
export function FavouritesProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading, openSignIn } = useAuth();
  const userId = user?.id ?? null;
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const savedRef = useRef(saved);

  useEffect(() => {
    savedRef.current = saved;
  });

  // Logging in or out swaps whose favourites are shown.
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (!isAuthLoading && shownFor !== userId) {
    setShownFor(userId);
    setSaved(new Set());
  }

  useEffect(() => {
    if (isAuthLoading || !userId) return;

    let cancelled = false;

    fetch('/api/favourites')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Could not load favourites'))))
      .then((data: { restaurants?: string[]; dishes?: string[] }) => {
        if (cancelled) return;

        setSaved((current) => {
          const next = new Set(current);
          for (const id of data.restaurants ?? []) next.add(keyOf('RESTAURANT', id));
          for (const id of data.dishes ?? []) next.add(keyOf('DISH', id));
          return next;
        });
      })
      .catch(() => {
        // The hearts just start empty; saving still works.
      });

    return () => {
      cancelled = true;
    };
  }, [userId, isAuthLoading]);

  const isFavourite = useCallback((kind: FavouriteKind, id: string) => saved.has(keyOf(kind, id)), [saved]);

  const toggle = useCallback(
    async (kind: FavouriteKind, id: string): Promise<ToggleResult> => {
      if (isAuthLoading) return { ok: false, error: '' };

      if (!userId) {
        openSignIn();
        return { ok: false, error: '' };
      }

      const key = keyOf(kind, id);
      const next = !savedRef.current.has(key);

      const apply = (isSaved: boolean) =>
        setSaved((current) => {
          const updated = new Set(current);
          if (isSaved) updated.add(key);
          else updated.delete(key);
          return updated;
        });

      // Optimistic: the heart flips right away and goes back if the server says no.
      apply(next);

      try {
        const response = await fetch('/api/favourites', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, id, saved: next }),
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error ?? 'Could not save your favourite.');
        }

        return { ok: true };
      } catch (caught) {
        apply(!next);
        return { ok: false, error: caught instanceof Error ? caught.message : 'Could not save your favourite.' };
      }
    },
    [isAuthLoading, userId, openSignIn]
  );

  const value = useMemo(() => ({ isFavourite, toggle }), [isFavourite, toggle]);

  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

export function useFavourites() {
  const context = useContext(FavouritesContext);
  if (!context) {
    throw new Error('useFavourites must be used within a FavouritesProvider');
  }
  return context;
}
