import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RECHARGE_TITLE, riderHold } from '@/lib/rider-wallet-config';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'RIDER') return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const isAvailable = body?.isAvailable === true;
  const lat = typeof body?.lat === 'number' ? body.lat : null;
  const lng = typeof body?.lng === 'number' ? body.lng : null;
  if (lat !== null && (Math.abs(lat) > 90 || lng === null || Math.abs(lng) > 180)) {
    return NextResponse.json({ error: 'Invalid location.' }, { status: 400 });
  }

  const rider = await prisma.rider.findUnique({
    where: { userId: session.userId },
    select: { id: true, isApproved: true, orderAccess: true, paymentHold: true },
  });
  if (!rider) return NextResponse.json({ error: 'Rider account not found.' }, { status: 404 });
  if (isAvailable && !rider.isApproved) return NextResponse.json({ error: 'Account is pending approval.' }, { status: 403 });

  // Unpaid commission (or an admin's block) means no new orders, so there is nothing to be online for.
  const hold = isAvailable ? riderHold(rider) : null;

  if (hold) {
    return NextResponse.json(
      {
        error: hold === 'PAYMENT' ? `${RECHARGE_TITLE} to go online and receive new orders.` : 'Mangwaoo has put your account on hold. Please contact support.',
        hold,
      },
      { status: 403 }
    );
  }

  await prisma.rider.update({
    where: { id: rider.id },
    data: {
      isAvailable,
      ...(isAvailable && lat !== null && lng !== null ? { lastLatitude: lat, lastLongitude: lng, lastSeenAt: new Date() } : {}),
      ...(!isAvailable ? { lastSeenAt: null } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
