import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isRealLocation } from '@/lib/geo';

/**
 * The rider's position while they are delivering an order (they have an ACTIVE order chat), sent by the rider dashboard
 * every few seconds so the customer can follow them live. It works even when the rider has switched themselves offline for
 * new orders: it only writes the position, never their availability, so it can't put them back in front of new requests.
 * A rider with no order in hand shares nothing: the answer says `sharing: false` and the dashboard stops.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'RIDER') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const lat = typeof body?.lat === 'number' ? body.lat : NaN;
  const lng = typeof body?.lng === 'number' ? body.lng : NaN;

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !isRealLocation({ lat, lng })) {
    return NextResponse.json({ error: 'Invalid location.' }, { status: 400 });
  }

  // One statement: only an approved rider who has an order in hand gets their position written.
  const written = await prisma.rider.updateMany({
    where: { userId: session.userId, isApproved: true, riderChats: { some: { status: 'ACTIVE' } } },
    data: { lastLatitude: lat, lastLongitude: lng, locationUpdatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, sharing: written.count > 0 });
}
