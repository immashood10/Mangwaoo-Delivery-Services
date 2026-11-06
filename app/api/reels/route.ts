import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { enforceRateLimits } from '@/lib/rate-limit';
import { notifyAdminsAfterResponse } from '@/lib/notify';
import { PUBLIC_REEL, REEL_SELECT, readReelForm, reelUser, serializeReels } from '@/lib/reels';
import { MAX_REEL_BYTES, detectReelVideo } from '@/lib/reel-config';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const session = await getSession();
  const mine = query.get('mine') === '1';
  if (mine && !session) return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  const cursor = query.get('cursor'); const id = query.get('id');
  const rows = await prisma.reel.findMany({ where: { ...(mine ? { authorId: session!.userId } : PUBLIC_REEL), ...(id ? { id } : {}) }, select: REEL_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 8, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  return NextResponse.json({ reels: await serializeReels(rows, session?.userId), nextCursor: rows.length === 8 ? rows[7].id : null }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function POST(request: Request) {
  const auth = await reelUser(); if ('error' in auth) return auth.error;
  const limited = await enforceRateLimits([{ scope: 'reel-upload', subject: auth.session.userId, limit: 5, windowSeconds: 86400 }]);
  if (limited) return limited;
  const form = await readReelForm(request);
  const caption = typeof form?.get('caption') === 'string' ? String(form.get('caption')).trim() : '';
  const productId = typeof form?.get('productId') === 'string' ? String(form.get('productId')).trim() : '';
  const file = form?.get('video');
  if (!caption || caption.length > 500 || !(file instanceof File) || !file.size || file.size > MAX_REEL_BYTES) return NextResponse.json({ error: 'Add a caption (1-500 characters) and an MP4/WebM video up to 3 MB.' }, { status: 400 });
  const data = new Uint8Array(await file.arrayBuffer()); const mimeType = detectReelVideo(data);
  if (!mimeType) return NextResponse.json({ error: 'Choose a valid MP4 or WebM video.' }, { status: 400 });
  if (productId && !await prisma.gulplazaProduct.findFirst({ where: { id: productId, isActive: true, seller: { isApproved: true, user: { isActive: true, deletedAt: null } } }, select: { id: true } })) return NextResponse.json({ error: 'That dish is no longer available.' }, { status: 400 });
  const result = await prisma.$transaction(async tx => {
    // Uploads are infrequent; serialize the storage budget so simultaneous posts cannot overrun it.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73190421)`;
    const [storage, pending] = await Promise.all([tx.reelVideo.aggregate({ _sum: { size: true } }), tx.reel.count({ where: { authorId: auth.session.userId, status: 'PENDING' } })]);
    if (pending >= 3) return { error: 'You already have 3 reels awaiting review.' };
    if ((storage._sum.size ?? 0) + file.size > 128 * 1024 * 1024) return { error: 'Reel storage is full. Please contact Mangwaoo Support.' };
    const reel = await tx.reel.create({ data: { authorId: auth.session.userId, caption, linkedProductId: productId || null, video: { create: { data, size: data.length, mimeType } } }, select: { id: true } });
    return { reel };
  }, { timeout: 30000 });
  if ('error' in result) return NextResponse.json(result, { status: 409 });
  notifyAdminsAfterResponse(async () => ({ type: 'ACCOUNT', title: 'Food reel awaiting approval', message: caption.slice(0, 140), href: '/admin/reels', refId: 'reel:' + result.reel.id }));
  return NextResponse.json({ reel: result.reel, message: 'Your reel is waiting for admin approval.' }, { status: 201 });
}
