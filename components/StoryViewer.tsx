'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { STORY_DURATION_MS, storyAge, storyBackgroundStyle, type StoryItem } from '@/lib/story-types';

// A press shorter than this is a tap (go to the next / previous story); a longer one is "hold to pause".
const TAP_MAX_MS = 250;
// Part of the width, from the left edge, where a tap goes back.
const BACK_TAP_ZONE = 0.33;
// If the tab was in the background the clock jumped; never move more than this per frame.
const MAX_FRAME_MS = 100;

/**
 * A full-screen story player, like a WhatsApp status: one bar per story fills while it is on screen, tap
 * the right side for the next story and the left for the previous one, hold to pause, Esc to close.
 */
export default function StoryViewer({
  stories,
  startIndex = 0,
  onClose,
  onWatch,
}: {
  stories: StoryItem[];
  startIndex?: number;
  onClose: () => void;
  /** Called when a story comes on screen (the site records that it was watched). Pass a stable function. */
  onWatch?: (story: StoryItem) => void;
}) {
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), stories.length - 1));
  const [isHolding, setIsHolding] = useState(false);
  // Anyone who asked their device for less motion starts paused and moves on by hand.
  const [isPaused, setIsPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // The story whose photo has loaded (or failed to), so the timer waits for the picture.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const elapsedRef = useRef(0);
  const pressRef = useRef<number | null>(null);

  const story = stories[index];
  const isReady = story.kind === 'TEXT' || loadedId === story.id;
  const isStopped = isHolding || isPaused || !isReady;

  const goTo = useCallback(
    (next: number) => {
      if (next >= stories.length) {
        onClose();
        return;
      }

      elapsedRef.current = 0;
      setIndex(Math.max(0, next));
    },
    [stories.length, onClose]
  );

  // Bars before the current story are full, the ones after are empty; the current one is filled by the timer below.
  useEffect(() => {
    barRefs.current.forEach((bar, position) => {
      if (bar) bar.style.width = position < index ? '100%' : '0%';
    });
  }, [index]);

  useEffect(() => {
    if (isStopped) return;

    let frame = 0;
    let last = performance.now();

    const tick = (time: number) => {
      elapsedRef.current += Math.min(time - last, MAX_FRAME_MS);
      last = time;

      const fraction = Math.min(1, elapsedRef.current / STORY_DURATION_MS);
      const bar = barRefs.current[index];
      if (bar) bar.style.width = `${fraction * 100}%`;

      if (fraction >= 1) {
        goTo(index + 1);
        return;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [index, isStopped, goTo]);

  useEffect(() => {
    onWatch?.(story);
  }, [story, onWatch]);

  // Have the next photo ready before it is needed.
  useEffect(() => {
    const next = stories[index + 1];

    if (next?.kind === 'IMAGE') {
      new Image().src = `/api/stories/${next.id}/image`;
    }
  }, [index, stories]);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowRight') {
        goTo(index + 1);
      } else if (event.key === 'ArrowLeft') {
        goTo(index - 1);
      } else if (event.key === 'Tab') {
        // Keep keyboard focus inside the player while it is open.
        const buttons = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])].filter(
          (button) => button.getClientRects().length > 0
        );
        const first = buttons[0];
        const last = buttons[buttons.length - 1];

        if (!first || !last) return;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, goTo, onClose]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pressRef.current = performance.now();
    setIsHolding(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const pressedAt = pressRef.current;
    pressRef.current = null;
    setIsHolding(false);

    if (pressedAt === null || performance.now() - pressedAt >= TAP_MAX_MS) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;

    goTo(fraction < BACK_TAP_ZONE ? index - 1 : index + 1);
  };

  const handlePointerCancel = () => {
    pressRef.current = null;
    setIsHolding(false);
  };

  const hasFailed = failedId === story.id;
  // The story's button only ever opens a page of this site.
  const href = story.href && story.href.startsWith('/') && !story.href.startsWith('//') ? story.href : null;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Mangwaoo stories"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 md:gap-4"
      onClick={(event) => {
        // A click on the dark area around the story closes it.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={() => goTo(index - 1)}
        disabled={index === 0}
        aria-label="Previous story"
        className="hidden h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-30 md:flex"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      <div className="relative h-dvh w-full max-w-[440px] overflow-hidden bg-black text-white md:h-[min(92dvh,820px)] md:rounded-2xl">
        {/* The story itself. Taps and holds are read here; the controls on top sit above it. */}
        <div
          className="absolute inset-0 select-none"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onContextMenu={(event) => event.preventDefault()}
        >
          {story.kind === 'IMAGE' && !hasFailed ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 scale-125 bg-cover bg-center opacity-60 blur-2xl"
              style={{ backgroundImage: `url(/api/stories/${story.id}/image)` }}
            />
          ) : null}

          {story.kind === 'IMAGE' ? (
            // eslint-disable-next-line @next/next/no-img-element -- served by /api/stories/[id]/image
            <img
              key={story.id}
              src={`/api/stories/${story.id}/image`}
              // The caption is shown (and read out) below the photo, so it isn't repeated as the description.
              alt={story.caption ? '' : 'Story from Mangwaoo'}
              draggable={false}
              onLoad={() => setLoadedId(story.id)}
              onError={() => {
                setFailedId(story.id);
                setLoadedId(story.id);
              }}
              className={`pointer-events-none h-full w-full object-contain ${hasFailed ? 'hidden' : ''}`}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center px-8 text-center"
              style={storyBackgroundStyle(story.background)}
            >
              <p className="whitespace-pre-line break-words text-2xl font-bold leading-snug sm:text-3xl">{story.caption}</p>
            </div>
          )}

          {story.kind === 'IMAGE' && !isReady ? (
            <div className="absolute inset-0 flex items-center justify-center" role="status" aria-label="Loading story">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/25 border-t-white" />
            </div>
          ) : null}

          {hasFailed ? (
            <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-white/80">
              This story could not be loaded.
            </div>
          ) : null}
        </div>

        {/* Bars and header */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent px-3 pb-8 pt-3">
          <div className="flex gap-1" aria-hidden="true">
            {stories.map((item, position) => (
              <div key={item.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
                <div
                  ref={(element) => {
                    barRefs.current[position] = element;
                  }}
                  className="h-full w-0 rounded-full bg-white"
                />
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-red-primary to-brand-red-secondary">
              <span className="text-sm font-bold text-white">{(story.sponsor ?? 'M').charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{story.sponsor ?? 'Mangwaoo'}</p>
              <p className="text-xs text-white/75">
                {story.sponsor ? 'Featured · ' : ''}
                {storyAge(story.createdAt, now)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPaused((paused) => !paused)}
              aria-label={isPaused ? 'Play stories' : 'Pause stories'}
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/15"
            >
              {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close stories"
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/15"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {(story.kind === 'IMAGE' && story.caption) || href ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 to-transparent px-5 pb-8 pt-16 text-center">
            {story.kind === 'IMAGE' && story.caption ? (
              <p className="whitespace-pre-line break-words text-base leading-snug">{story.caption}</p>
            ) : null}
            {href ? (
              <Link
                href={href}
                onClick={onClose}
                className="pointer-events-auto mt-4 inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black shadow-lg transition hover:bg-white/90"
              >
                View product
              </Link>
            ) : null}
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          Story {index + 1} of {stories.length}
        </p>
      </div>

      <button
        type="button"
        onClick={() => goTo(index + 1)}
        aria-label={index === stories.length - 1 ? 'Close stories' : 'Next story'}
        className="hidden h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 md:flex"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>,
    document.body
  );
}
