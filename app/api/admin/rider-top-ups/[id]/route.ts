import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyAfterResponse } from '@/lib/notify';
import { approveTopUp } from '@/lib/rider-wallet';
import { MAX_ADJUSTMENT_PKR, MAX_WALLET_NOTE_LENGTH, formatPkr } from '@/lib/rider-wallet-config';

/**
 * An admin checks a rider's recharge request against the money Mangwaoo received: `approve` adds it to the wallet (the
 * amount can be corrected to what really arrived), `reject` turns it down with a reason. The rider is told either way.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action === 'approve') {
    let override: number | null = null;

    if (body?.amount !== undefined && body?.amount !== null && body?.amount !== '') {
      const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);

      if (!Number.isInteger(amount) || amount < 1 || amount > MAX_ADJUSTMENT_PKR) {
        return NextResponse.json({ error: 'Enter the amount that arrived in whole rupees.' }, { status: 400 });
      }

      override = amount;
    }

    const result = await approveTopUp(id, override);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    const released = result.change?.endedHold && result.change.orderAccess === 'AUTO';

    notifyAfterResponse(async () => ({
      userId: result.riderUserId,
      type: 'ACCOUNT' as const,
      title: released ? 'Recharge approved — you can receive orders' : 'Recharge approved',
      message: released
        ? `${formatPkr(result.amount)} was added to your account. You can go online and receive new orders again.`
        : `${formatPkr(result.amount)} was added to your account.`,
      href: '/rider/wallet',
      refId: `rider-wallet:${result.riderId}`,
    }));

    return NextResponse.json({ ok: true });
  }

  if (action === 'reject') {
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, MAX_WALLET_NOTE_LENGTH) : '';
    const topUp = await prisma.riderTopUp.findUnique({ where: { id }, include: { rider: { select: { userId: true } } } });

    if (!topUp) return NextResponse.json({ error: 'Recharge request not found.' }, { status: 404 });

    const claimed = await prisma.riderTopUp.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', reviewedAt: new Date(), rejectionReason: reason || null },
    });

    if (claimed.count === 0) return NextResponse.json({ error: 'This request was already reviewed.' }, { status: 409 });

    notifyAfterResponse(async () => ({
      userId: topUp.rider.userId,
      type: 'ACCOUNT' as const,
      title: 'Recharge not accepted',
      message: `We could not find your ${formatPkr(topUp.amount)} payment (ID ${topUp.transactionId}).${reason ? ` ${reason}` : ''} Please check the transaction ID and send it again.`,
      href: '/rider/wallet',
      refId: `rider-wallet:${topUp.riderId}`,
    }));

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
