import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getVisitorId } from '@/lib/visitor';
import { STORIES_TAG } from '@/lib/catalog-cache';
import type { StoryItem } from '@/lib/story-types';

// Stories the admin puts on the website logo. Everything lives in the database: the stories, the photos
// (bytes in Story.data, served by /api/stories/[id]/image) and who watched what (StoryView).

type ActiveStory = Omit<StoryItem, 'seen'>;

// Every page load asks for the stories, so the list is cached; posting or removing a story expires it at once.
const getCachedActiveStories = unstable_cache(
  async (): Promise<ActiveStory[]> => {
    const rows = await prisma.story.findMany({
      where: {
        expiresAt: { gt: new Date() },
        // A paid story ad is shown only while its product can still be bought, like the other ads.
        OR: [{ adId: null }, { ad: { product: { isActive: true, stock: { gt: 0 } } } }],
      },
      orderBy: { createdAt: 'asc' },
      // No `data`: the photo bytes never travel with the list.
      select: {
        id: true,
        kind: true,
        caption: true,
        background: true,
        href: true,
        createdAt: true,
        expiresAt: true,
        ad: { select: { seller: { select: { businessName: true } } } },
      },
    });

    return rows.map(({ ad, ...row }) => ({
      ...row,
      sponsor: ad?.seller.businessName ?? null,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    }));
  },
  ['active-stories'],
  { revalidate: 60, tags: [STORIES_TAG] }
);

/** The stories that are up right now, oldest first. A cached copy can be a little old, so expiry is checked again here. */
export async function getActiveStories() {
  const stories = await getCachedActiveStories();
  const now = Date.now();

  return stories.filter((story) => Date.parse(story.expiresAt) > now);
}

/** Who is asking: "u:<user id>" for a logged-in account, "v:<visitor id>" for a browser with a visitor cookie, otherwise null. */
export async function getViewerKey() {
  const session = await getSession();
  if (session) return `u:${session.userId}`;

  const visitorId = await getVisitorId();
  return visitorId ? `v:${visitorId}` : null;
}

/** The live stories, each marked with whether the person asking has already watched it. */
export async function getStoriesForViewer(): Promise<StoryItem[]> {
  const [stories, viewerKey] = await Promise.all([getActiveStories(), getViewerKey()]);

  if (stories.length === 0 || !viewerKey) {
    return stories.map((story) => ({ ...story, seen: false }));
  }

  const views = await prisma.storyView.findMany({
    where: { viewerKey, storyId: { in: stories.map((story) => story.id) } },
    select: { storyId: true },
  });
  const seenIds = new Set(views.map((view) => view.storyId));

  return stories.map((story) => ({ ...story, seen: seenIds.has(story.id) }));
}

export type AdminStory = ActiveStory & {
  /** A paid story ad (managed in Ad Requests) rather than one the admin posted. */
  isAd: boolean;
  /** How many different people watched it. */
  views: number;
  minutesAgo: number;
  minutesLeft: number;
};

/** The live stories for the admin page, newest first, with how many people watched each. */
export async function getAdminStories(): Promise<AdminStory[]> {
  const now = Date.now();
  const rows = await prisma.story.findMany({
    where: { expiresAt: { gt: new Date(now) } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      kind: true,
      caption: true,
      background: true,
      href: true,
      adId: true,
      createdAt: true,
      expiresAt: true,
      ad: { select: { seller: { select: { businessName: true } } } },
      _count: { select: { views: true } },
    },
  });

  // The minutes are worked out here, once, so the server render and the browser show the same numbers.
  return rows.map(({ _count, ad, adId, ...row }) => ({
    ...row,
    sponsor: ad?.seller.businessName ?? null,
    isAd: adId !== null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    views: _count.views,
    minutesAgo: Math.max(0, Math.floor((now - row.createdAt.getTime()) / 60000)),
    minutesLeft: Math.max(0, Math.ceil((row.expiresAt.getTime() - now) / 60000)),
  }));
}

/** Which image format the bytes really are (not what the upload claims), or null if it isn't one we serve. */
export function detectImageType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';

  const isPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (isPng) return 'image/png';

  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';

  return null;
}
