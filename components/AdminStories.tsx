'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CircleDashed, Eye, ImagePlus, Play, Trash2, Type } from 'lucide-react';
import StoryViewer from '@/components/StoryViewer';
import { compressImage } from '@/lib/client-image';
import type { AdminStory } from '@/lib/stories';
import {
  DEFAULT_STORY_BACKGROUND,
  MAX_STORY_CAPTION_LENGTH,
  MAX_STORY_IMAGE_BYTES,
  STORY_BACKGROUNDS,
  STORY_LIFETIME_HOURS,
  storyBackgroundStyle,
  type StoryBackgroundKey,
  type StoryItem,
} from '@/lib/story-types';

type Kind = 'IMAGE' | 'TEXT';

/** "45 min" or "3 h". */
const formatMinutes = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h`);

// Fixed time zone so the server render and the browser agree on the time.
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi',
  });

/** A small 9:16 phone-shaped frame, so the admin sees what people will see. */
function StoryPreview({
  kind,
  imageUrl,
  text,
  background,
}: {
  kind: Kind;
  imageUrl: string | null;
  text: string;
  background: StoryBackgroundKey;
}) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-44 overflow-hidden rounded-2xl bg-black text-white shadow-soft" aria-label="Story preview">
      {kind === 'IMAGE' ? (
        imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen file */}
            <img src={imageUrl} alt="" className="h-full w-full object-contain" />
            {text ? (
              <p className="absolute inset-x-0 bottom-0 line-clamp-4 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-8 text-center text-xs leading-snug">
                {text}
              </p>
            ) : null}
          </>
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-white/60">Choose a photo to preview it here</div>
        )
      ) : (
        <div className="flex h-full items-center justify-center px-4 text-center" style={storyBackgroundStyle(background)}>
          <p className="line-clamp-8 whitespace-pre-line break-words text-base font-bold leading-snug">
            {text || 'Your message'}
          </p>
        </div>
      )}
    </div>
  );
}

function StoryThumb({ story }: { story: AdminStory }) {
  return (
    <div className="h-20 w-[45px] shrink-0 overflow-hidden rounded-lg bg-black">
      {story.kind === 'IMAGE' ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by /api/stories/[id]/image
        <img src={`/api/stories/${story.id}/image`} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center p-1 text-center text-white" style={storyBackgroundStyle(story.background)}>
          <span className="line-clamp-5 break-words text-[7px] font-bold leading-tight">{story.caption}</span>
        </div>
      )}
    </div>
  );
}

/** Post stories on the website logo and take them down again. */
export default function AdminStories({ stories }: { stories: AdminStory[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>('IMAGE');
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [background, setBackground] = useState<StoryBackgroundKey>(DEFAULT_STORY_BACKGROUND);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Viewers see the oldest story first; the list below shows the newest first.
  const playOrder: StoryItem[] = [...stories].reverse().map((story) => ({
    id: story.id,
    kind: story.kind,
    caption: story.caption,
    background: story.background,
    href: story.href,
    sponsor: story.sponsor,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    seen: true,
  }));

  const chooseFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;

    setError('');
    setNotice('');
    setFile(chosen);

    if (!chosen) {
      setImageUrl(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setImageUrl(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(chosen);
  };

  const resetForm = () => {
    setFile(null);
    setImageUrl(null);
    setCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const post = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    const text = caption.trim();

    if (kind === 'TEXT' && !text) {
      setError('Write the message for your story.');
      return;
    }

    if (kind === 'IMAGE' && !file) {
      setError('Choose a photo for your story.');
      return;
    }

    setIsPosting(true);

    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('caption', text);

      if (kind === 'TEXT') {
        form.append('background', background);
      } else if (file) {
        // Phones take huge photos; shrink to a sharp full-screen size so the story opens fast.
        const photo = await compressImage(file, { maxDimension: 1920 });

        if (photo.size > MAX_STORY_IMAGE_BYTES) {
          setError('That photo is too large even after shrinking. Please choose a smaller one.');
          return;
        }

        form.append('image', photo, 'story.jpg');
      }

      const response = await fetch('/api/admin/stories', { method: 'POST', body: form });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Could not post the story. Please try again.');
        return;
      }

      resetForm();
      setNotice(`Posted. It is on the logo now and stays for ${STORY_LIFETIME_HOURS} hours.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : 'Could not reach the server. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const remove = async (story: AdminStory) => {
    if (!window.confirm('Delete this story now? People will no longer see it.')) return;

    setBusyId(story.id);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`/api/admin/stories/${story.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Could not delete the story. Please try again.');
        return;
      }

      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="new-story-heading" className="rounded-2xl bg-surface p-5 shadow-soft sm:p-6">
        <h2 id="new-story-heading" className="mb-4 text-sm font-bold uppercase tracking-wide text-ink">
          New story
        </h2>

        <div className="grid gap-6 md:grid-cols-[1fr_auto]">
          <form onSubmit={post} className="space-y-4">
            <div className="inline-flex rounded-full bg-brand-light p-1" role="group" aria-label="Story type">
              {(
                [
                  { value: 'IMAGE', label: 'Photo', icon: ImagePlus },
                  { value: 'TEXT', label: 'Text', icon: Type },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setKind(value);
                    setError('');
                    setNotice('');
                  }}
                  aria-pressed={kind === value}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                    kind === value ? 'bg-brand-dark text-white' : 'text-brand-gray hover:text-ink'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {kind === 'IMAGE' ? (
              <div>
                <label htmlFor="story-photo" className="mb-1.5 block text-sm font-semibold text-ink">
                  Photo
                </label>
                <input
                  ref={fileInputRef}
                  id="story-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={chooseFile}
                  className="block w-full text-sm text-brand-gray file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-brand-red-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent hover:file:bg-brand-red-primary/20"
                />
                <p className="mt-1.5 text-xs text-brand-gray">Tall (portrait) photos fill the screen best. JPG, PNG or WebP.</p>
              </div>
            ) : null}

            <div>
              <label htmlFor="story-caption" className="mb-1.5 block text-sm font-semibold text-ink">
                {kind === 'IMAGE' ? 'Caption (optional)' : 'Message'}
              </label>
              <textarea
                id="story-caption"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={MAX_STORY_CAPTION_LENGTH}
                rows={kind === 'IMAGE' ? 2 : 4}
                placeholder={kind === 'IMAGE' ? 'e.g. Eid special: free delivery today!' : 'e.g. New restaurants joined Mangwaoo this week'}
                className="w-full resize-none rounded-xl border border-gray-300 bg-transparent px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-red-100"
              />
              <p className="mt-1 text-right text-xs text-brand-gray">
                {caption.length}/{MAX_STORY_CAPTION_LENGTH}
              </p>
            </div>

            {kind === 'TEXT' ? (
              <fieldset>
                <legend className="mb-1.5 text-sm font-semibold text-ink">Background</legend>
                <div className="flex flex-wrap gap-2">
                  {STORY_BACKGROUNDS.map((item) => (
                    <label key={item.key} className="cursor-pointer" title={item.label}>
                      <input
                        type="radio"
                        name="story-background"
                        value={item.key}
                        checked={background === item.key}
                        onChange={() => setBackground(item.key)}
                        className="peer sr-only"
                      />
                      <span
                        className="block h-9 w-9 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-surface transition peer-checked:ring-brand-dark peer-focus-visible:ring-accent"
                        style={storyBackgroundStyle(item.key)}
                      />
                      <span className="sr-only">{item.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p role="status" className="text-sm text-success">
                {notice}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isPosting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-6 py-2.5 text-sm font-semibold text-white transition hover:shadow-lg disabled:opacity-60"
            >
              <CircleDashed className="h-4 w-4" />
              {isPosting ? 'Posting…' : 'Post story'}
            </button>
            <p className="text-xs text-brand-gray">It stays on the logo for {STORY_LIFETIME_HOURS} hours, then goes away on its own.</p>
          </form>

          <StoryPreview kind={kind} imageUrl={imageUrl} text={caption.trim()} background={background} />
        </div>
      </section>

      <section aria-labelledby="live-stories-heading">
        <h2 id="live-stories-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-ink">
          Live now ({stories.length})
        </h2>

        {stories.length === 0 ? (
          <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
            <CircleDashed className="mx-auto mb-3 h-8 w-8 text-brand-gray" />
            <p className="text-sm text-brand-gray">No stories are live. Post one and the Mangwaoo logo gets a ring.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {stories.map((story) => (
              <li key={story.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface p-4 shadow-soft">
                <StoryThumb story={story} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-gray">
                    {story.isAd ? `Story ad · ${story.sponsor ?? 'seller'}` : story.kind === 'IMAGE' ? 'Photo story' : 'Text story'}
                  </p>
                  <p className="line-clamp-2 break-words font-semibold text-ink">{story.caption ?? 'No caption'}</p>
                  <p className="mt-1 text-xs text-brand-gray">
                    Posted <time dateTime={story.createdAt}>{formatDateTime(story.createdAt)}</time>{' '}
                    {`(${formatMinutes(story.minutesAgo)} ago) · goes away in ${formatMinutes(story.minutesLeft)}`}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-ink">
                    <Eye className="h-3.5 w-3.5 text-brand-gray" />
                    {story.views} {story.views === 1 ? 'view' : 'views'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(stories.length - 1 - stories.indexOf(story))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Preview
                  </button>
                  {story.isAd ? (
                    // A paid story ad is ended from Ad Requests, so the seller's payment and the ad stay in step.
                    <Link
                      href="/admin/ads"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
                    >
                      Manage in Ad Requests
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void remove(story)}
                      disabled={busyId === story.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-red-600 hover:text-danger disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {busyId === story.id ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {previewIndex !== null && playOrder.length > 0 ? (
        <StoryViewer stories={playOrder} startIndex={previewIndex} onClose={() => setPreviewIndex(null)} />
      ) : null}
    </div>
  );
}
