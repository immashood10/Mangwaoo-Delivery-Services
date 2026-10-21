import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { refreshStories } from '@/lib/catalog-cache';

/** Takes a story down before its day is up (the views go with it). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  // A paid story ad is ended from Ad Requests, so the seller's ad and its story can't get out of step.
  const { count } = await prisma.story.deleteMany({ where: { id, adId: null } });

  if (count === 0) {
    const isAd = await prisma.story.findFirst({ where: { id, adId: { not: null } }, select: { id: true } });

    return isAd
      ? NextResponse.json({ error: 'This is a paid story ad. End the ad in Ad Requests instead.' }, { status: 409 })
      : NextResponse.json({ error: 'Story not found.' }, { status: 404 });
  }

  refreshStories();

  return NextResponse.json({ ok: true });
}
