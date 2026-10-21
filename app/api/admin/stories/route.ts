import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { refreshStories } from '@/lib/catalog-cache';
import { detectImageType } from '@/lib/stories';
import {
  MAX_ACTIVE_STORIES,
  MAX_STORY_CAPTION_LENGTH,
  MAX_STORY_IMAGE_BYTES,
  STORY_IMAGE_TYPES,
  STORY_LIFETIME_HOURS,
  isStoryBackground,
} from '@/lib/story-types';

const HOUR_MS = 60 * 60 * 1000;
// Expired stories are useless, and their photos are big: each new post clears out the ones that ended a while ago.
const KEEP_EXPIRED_FOR_MS = 24 * HOUR_MS;

/**
 * Posts a story on the website logo. Expects multipart/form-data: `kind` ("IMAGE" or "TEXT"), then for a
 * photo the `image` file and an optional `caption`, or for a text story the `caption` (the message) and a `background` colour.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);

  if (!form) {
    return NextResponse.json({ error: 'Please fill in the story form.' }, { status: 400 });
  }

  const kind = form.get('kind');
  const rawCaption = form.get('caption');
  const caption = typeof rawCaption === 'string' ? rawCaption.trim() : '';

  if (kind !== 'IMAGE' && kind !== 'TEXT') {
    return NextResponse.json({ error: 'Choose a photo story or a text story.' }, { status: 400 });
  }

  if (caption.length > MAX_STORY_CAPTION_LENGTH) {
    return NextResponse.json({ error: `Keep it to ${MAX_STORY_CAPTION_LENGTH} characters or fewer.` }, { status: 400 });
  }

  // Paid story ads don't use up the admin's room: a seller who paid always gets their day.
  const liveStories = await prisma.story.count({ where: { expiresAt: { gt: new Date() }, adId: null } });

  if (liveStories >= MAX_ACTIVE_STORIES) {
    return NextResponse.json({ error: `${MAX_ACTIVE_STORIES} stories are already live. Delete one to post another.` }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + STORY_LIFETIME_HOURS * HOUR_MS);
  let created: { id: string };

  if (kind === 'TEXT') {
    const background = form.get('background');

    if (!caption) {
      return NextResponse.json({ error: 'Write the message for your story.' }, { status: 400 });
    }

    if (!isStoryBackground(background)) {
      return NextResponse.json({ error: 'Choose a background colour.' }, { status: 400 });
    }

    created = await prisma.story.create({ data: { kind, caption, background, expiresAt }, select: { id: true } });
  } else {
    const file = form.get('image');

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Please choose a photo for your story.' }, { status: 400 });
    }

    if (file.size > MAX_STORY_IMAGE_BYTES) {
      return NextResponse.json({ error: 'That photo is too large (max 3 MB).' }, { status: 400 });
    }

    const data = new Uint8Array(await file.arrayBuffer());
    // The photo is served from our own address, so go by what the bytes are, not by what the upload claims.
    const mimeType = detectImageType(data);

    if (!mimeType || !(STORY_IMAGE_TYPES as readonly string[]).includes(mimeType)) {
      return NextResponse.json({ error: 'The story photo must be a JPG, PNG or WebP image.' }, { status: 400 });
    }

    created = await prisma.story.create({
      data: { kind, caption: caption || null, mimeType, size: data.length, data, expiresAt },
      select: { id: true },
    });
  }

  await prisma.story.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - KEEP_EXPIRED_FOR_MS) } } }).catch(() => undefined);
  refreshStories();

  return NextResponse.json({ story: { id: created.id, expiresAt: expiresAt.toISOString() } }, { status: 201 });
}
