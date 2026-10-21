'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import StoryViewer from '@/components/StoryViewer';
import type { StoryItem } from '@/lib/story-types';

// A tab left open picks up new stories again when it is looked at after this long.
const REFRESH_AFTER_MS = 2 * 60 * 1000;

/** The stories up right now with this visitor's seen flags; null when they could not be loaded (the logo then stays plain). */
async function fetchStories(): Promise<StoryItem[] | null> {
  try {
    const response = await fetch('/api/stories', { cache: 'no-store' });
    if (!response.ok) return null;

    const data: { stories?: StoryItem[] } = await response.json();
    return Array.isArray(data.stories) ? data.stories : [];
  } catch {
    return null;
  }
}

/**
 * The Mangwaoo logo in the navbar. While the admin has stories up, the "M" gets a ring (red until you have
 * seen them all, grey after) and opens the story player; the name still goes home. Without stories it is
 * the plain logo link. Which stories were watched is kept in the database, nothing in the browser.
 */
export default function StoryLogo() {
  const [stories, setStories] = useState<StoryItem[]>([]);
  // What the player was opened with, so stories that come or go meanwhile don't shift it under the viewer.
  const [player, setPlayer] = useState<{ stories: StoryItem[]; startIndex: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const loadedAtRef = useRef(0);
  const watchedRef = useRef(new Set<string>());

  useEffect(() => {
    let isCurrent = true;

    const refresh = () => {
      void fetchStories().then((loaded) => {
        if (loaded && isCurrent) {
          loadedAtRef.current = Date.now();
          setStories(loaded);
        }
      });
    };

    refresh();

    const handleVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - loadedAtRef.current > REFRESH_AFTER_MS) {
        refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      isCurrent = false;
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, []);

  const handleWatch = useCallback((story: StoryItem) => {
    if (story.seen || watchedRef.current.has(story.id)) return;

    watchedRef.current.add(story.id);
    setStories((current) => current.map((item) => (item.id === story.id ? { ...item, seen: true } : item)));
    void fetch(`/api/stories/${story.id}/view`, { method: 'POST', keepalive: true }).catch(() => undefined);
  }, []);

  const handleClose = useCallback(() => {
    setPlayer(null);
    triggerRef.current?.focus();
  }, []);

  const openPlayer = () => {
    // Start at the first story not watched yet, or from the beginning when everything was seen.
    const firstUnseen = stories.findIndex((story) => !story.seen);
    setPlayer({ stories, startIndex: firstUnseen === -1 ? 0 : firstUnseen });
  };

  if (stories.length === 0) {
    return (
      <Link href="/" className="mr-2 flex items-center space-x-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-red-primary to-brand-red-secondary">
          <span className="text-sm font-bold text-white">M</span>
        </div>
        <span className="text-lg font-bold text-ink">Mangwaoo</span>
      </Link>
    );
  }

  const hasUnseen = stories.some((story) => !story.seen);

  return (
    <div className="mr-2 flex items-center gap-2">
      {/* The ring is drawn with padding and cancelled by the negative margin, so the logo doesn't move when it appears. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openPlayer}
        aria-haspopup="dialog"
        aria-label={hasUnseen ? 'Watch new Mangwaoo stories' : 'Watch Mangwaoo stories again'}
        title="Stories"
        className={`-m-1 rounded-xl p-[2px] transition ${
          hasUnseen ? 'bg-gradient-to-tr from-amber-400 via-brand-red-secondary to-brand-red-primary' : 'bg-gray-300'
        }`}
      >
        <span className="block rounded-[10px] bg-surface p-[2px]">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-red-primary to-brand-red-secondary">
            <span className="text-sm font-bold text-white">M</span>
          </span>
        </span>
      </button>
      <Link href="/" className="text-lg font-bold text-ink">
        Mangwaoo
      </Link>

      {player ? <StoryViewer stories={player.stories} startIndex={player.startIndex} onClose={handleClose} onWatch={handleWatch} /> : null}
    </div>
  );
}
