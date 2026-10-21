import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { notifyAfterResponse } from '@/lib/notify';
import { SELLER_PAGES } from '@/lib/notification-types';
import { AD_PLACEMENTS, nextAdPeriod } from '@/lib/ad-config';
import { endAdStory, publishAdStory } from '@/lib/ad-stories';
import { refreshStories } from '@/lib/catalog-cache';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_REASON_LENGTH = 200;
// Making a story copies the product's photo, which can be a few MB over a slow link to the database.
const STORY_TRANSACTION = { timeout: 20000, maxWait: 10000 };

// Admin review of a paid ad: approve it (it runs for its period, from now), reject it, end a running one early,
// or put an ended / declined one back on (it runs for its period from now, like a fresh approval). A Story ad also
// becomes a story on the logo while it runs.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, MAX_REASON_LENGTH) : '';

  if (action !== 'approve' && action !== 'reject' && action !== 'end' && action !== 'restore') {
    return NextResponse.json({ error: 'Choose approve, reject, end or restore.' }, { status: 400 });
  }

  // A request an admin deleted from the list is gone as far as the admin is concerned.
  const ad = await prisma.productAd.findFirst({
    where: { id, deletedAt: null },
    include: { product: { select: { name: true, isActive: true } }, seller: { select: { userId: true } } },
  });

  if (!ad) {
    return NextResponse.json({ error: 'Ad request not found.' }, { status: 404 });
  }

  const now = new Date();
  const placement = AD_PLACEMENTS[ad.placement];
  const isStoryAd = ad.placement === 'STORY';

  if (action === 'approve') {
    if (!ad.product.isActive) {
      return NextResponse.json({ error: 'This product was removed by the seller, so the ad can’t run.' }, { status: 409 });
    }

    const endsAt = new Date(now.getTime() + placement.durationDays * DAY_MS);
    // The status guard makes a double click (or two admins) approve only once.
    const approved = await prisma.$transaction(async (tx) => {
      const result = await tx.productAd.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'ACTIVE', startsAt: now, endsAt, reviewedAt: now, rejectionReason: null },
      });

      if (result.count === 0) return false;
      if (isStoryAd) await publishAdStory(tx, ad, now, endsAt);

      return true;
    }, STORY_TRANSACTION);

    if (!approved) {
      return NextResponse.json({ error: 'This request was already reviewed.' }, { status: 409 });
    }

    revalidatePath('/');
    if (isStoryAd) refreshStories();
    notifyAfterResponse(async () => ({
      userId: ad.seller.userId,
      type: 'AD' as const,
      title: 'Your ad is live',
      message: `${ad.product.name} is Featured (${placement.label}) for ${nextAdPeriod(placement.durationDays)}.`,
      href: SELLER_PAGES.ads,
      refId: `ad:${ad.id}`,
    }));

    return NextResponse.json({ ad: { id, status: 'ACTIVE', startsAt: now.toISOString(), endsAt: endsAt.toISOString() } });
  }

  if (action === 'restore') {
    if (!ad.product.isActive) {
      return NextResponse.json({ error: 'This product was removed by the seller, so the ad can’t run.' }, { status: 409 });
    }

    // The same rules as when a seller asks: one ad per product and spot at a time, and a transaction id
    // can only be behind one request that isn't declined.
    const [running, sameRef] = await Promise.all([
      prisma.productAd.findFirst({
        where: {
          id: { not: id },
          productId: ad.productId,
          placement: ad.placement,
          OR: [{ status: 'PENDING' }, { status: 'ACTIVE', endsAt: { gt: now } }],
        },
        select: { status: true },
      }),
      prisma.productAd.findFirst({
        where: { id: { not: id }, paymentRef: ad.paymentRef, status: { in: ['PENDING', 'ACTIVE'] } },
        select: { id: true },
      }),
    ]);

    if (running) {
      return NextResponse.json(
        {
          error:
            running.status === 'PENDING'
              ? 'This product already has a newer request for that spot waiting for review. Approve or decline that one instead.'
              : 'This product already has an ad running in that spot. Put this one back once it ends.',
        },
        { status: 409 }
      );
    }

    if (sameRef) {
      return NextResponse.json({ error: 'This transaction ID is now behind another ad request, so this one can’t be put back.' }, { status: 409 });
    }

    const wasDeclined = ad.status === 'REJECTED';
    const endsAt = new Date(now.getTime() + placement.durationDays * DAY_MS);
    // Only an ended or declined request can be put back; the guard makes a double click do it once.
    const restored = await prisma.$transaction(async (tx) => {
      const result = await tx.productAd.updateMany({
        where: { id, OR: [{ status: 'REJECTED' }, { status: 'ACTIVE', endsAt: { lte: now } }] },
        data: { status: 'ACTIVE', startsAt: now, endsAt, reviewedAt: now, rejectionReason: null },
      });

      if (result.count === 0) return false;
      if (isStoryAd) await publishAdStory(tx, ad, now, endsAt);

      return true;
    }, STORY_TRANSACTION);

    if (!restored) {
      return NextResponse.json({ error: 'Only an ended or declined ad can be put back.' }, { status: 409 });
    }

    revalidatePath('/');
    if (isStoryAd) refreshStories();
    notifyAfterResponse(async () => ({
      userId: ad.seller.userId,
      type: 'AD' as const,
      title: wasDeclined ? 'Your ad is live' : 'Your ad is live again',
      message: `${ad.product.name} is Featured (${placement.label}) ${wasDeclined ? '' : 'again '}for ${nextAdPeriod(placement.durationDays)}.`,
      href: SELLER_PAGES.ads,
      refId: `ad:${ad.id}`,
    }));

    return NextResponse.json({ ad: { id, status: 'ACTIVE', startsAt: now.toISOString(), endsAt: endsAt.toISOString() } });
  }

  if (action === 'reject') {
    const result = await prisma.productAd.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', reviewedAt: now, rejectionReason: reason || null },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'This request was already reviewed.' }, { status: 409 });
    }

    notifyAfterResponse(async () => ({
      userId: ad.seller.userId,
      type: 'AD' as const,
      title: 'Your ad request was declined',
      message: reason ? `${ad.product.name}: ${reason}` : `${ad.product.name}: the payment could not be confirmed.`,
      href: SELLER_PAGES.ads,
      refId: `ad:${ad.id}`,
    }));

    return NextResponse.json({ ad: { id, status: 'REJECTED' } });
  }

  // end: stop a running ad now (a Story ad's story leaves the logo with it)
  const ended = await prisma.$transaction(async (tx) => {
    const result = await tx.productAd.updateMany({
      where: { id, status: 'ACTIVE', endsAt: { gt: now } },
      data: { endsAt: now },
    });

    if (result.count === 0) return false;
    if (isStoryAd) await endAdStory(tx, id, now);

    return true;
  });

  if (!ended) {
    return NextResponse.json({ error: 'This ad is not running.' }, { status: 409 });
  }

  revalidatePath('/');
  if (isStoryAd) refreshStories();

  return NextResponse.json({ ad: { id, status: 'ACTIVE', endsAt: now.toISOString() } });
}

/**
 * Deletes an ended or declined request from the admin's list. The record is kept (marked deletedAt) rather than
 * erased: an ended ad's transaction id was paid for, and it must keep counting as used.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const now = new Date();

  const result = await prisma.productAd.updateMany({
    where: { id, deletedAt: null, OR: [{ status: 'REJECTED' }, { status: 'ACTIVE', endsAt: { lte: now } }] },
    data: { deletedAt: now },
  });

  if (result.count === 0) {
    const exists = await prisma.productAd.findFirst({ where: { id, deletedAt: null }, select: { id: true } });

    return exists
      ? NextResponse.json({ error: 'Only an ended or declined ad can be deleted. End or decline it first.' }, { status: 409 })
      : NextResponse.json({ error: 'Ad request not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
