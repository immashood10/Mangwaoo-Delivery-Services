// Client-safe rules for stories, shared by the admin form, the story viewer and the API.

/** A story disappears this long after it was posted, like a WhatsApp status. */
export const STORY_LIFETIME_HOURS = 24;
export const MAX_ACTIVE_STORIES = 30;
export const MAX_STORY_CAPTION_LENGTH = 300;
export const MAX_STORY_IMAGE_BYTES = 3 * 1024 * 1024;
export const STORY_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** How long each story stays on screen before the next one starts. */
export const STORY_DURATION_MS = 5000;

// Fixed colours (not theme tokens): a story looks the same in light and dark mode, and white text stays readable on every one.
export const STORY_BACKGROUNDS = [
  { key: 'red', label: 'Red', from: '#9B0000', to: '#C1121F' },
  { key: 'orange', label: 'Orange', from: '#C2410C', to: '#EA580C' },
  { key: 'green', label: 'Green', from: '#047857', to: '#059669' },
  { key: 'blue', label: 'Blue', from: '#1D4ED8', to: '#2563EB' },
  { key: 'purple', label: 'Purple', from: '#6D28D9', to: '#9333EA' },
  { key: 'dark', label: 'Dark', from: '#111111', to: '#3F3F46' },
] as const;

export type StoryBackgroundKey = (typeof STORY_BACKGROUNDS)[number]['key'];

export const DEFAULT_STORY_BACKGROUND: StoryBackgroundKey = 'red';

export function isStoryBackground(value: unknown): value is StoryBackgroundKey {
  return STORY_BACKGROUNDS.some((background) => background.key === value);
}

/** The inline style that paints a TEXT story's background (unknown keys fall back to the default colour). */
export function storyBackgroundStyle(key: string | null | undefined) {
  const background = STORY_BACKGROUNDS.find((item) => item.key === key) ?? STORY_BACKGROUNDS[0];
  return { backgroundImage: `linear-gradient(135deg, ${background.from}, ${background.to})` };
}

export type StoryItem = {
  id: string;
  kind: 'IMAGE' | 'TEXT';
  /** The caption under a photo, or the message of a TEXT story. */
  caption: string | null;
  /** TEXT stories: a key from STORY_BACKGROUNDS. */
  background: string | null;
  createdAt: string;
  expiresAt: string;
  /** Where the story's button goes (an internal path). Ad stories link to their product. */
  href: string | null;
  /** The store that paid for a story ad; null for the admin's own stories. */
  sponsor: string | null;
  /** Whether the person asking has already watched it. */
  seen: boolean;
};

/** "just now", "5 min ago", "3 h ago" — how long ago a story was posted. */
export function storyAge(createdAt: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 60000));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  return `${Math.floor(minutes / 60)} h ago`;
}
