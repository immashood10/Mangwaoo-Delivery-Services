import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyAfterResponse } from '@/lib/notify';
import { addLedgerEntry, setOrderAccess, type WalletChange } from '@/lib/rider-wallet';
import {
  MAX_ADJUSTMENT_PKR,
  MAX_WALLET_NOTE_LENGTH,
  RECHARGE_TITLE,
  formatPkr,
  rechargeMessage,
  riderHold,
  type RiderOrderAccess,
} from '@/lib/rider-wallet-config';

async function requireAdmin() {
  const session = await getSession();

  return session && session.role === 'ADMIN' ? session : null;
}

async function findRider(id: string) {
  const rider = await prisma.rider.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      walletBalance: true,
      unpaidOrders: true,
      paymentHold: true,
      orderAccess: true,
      user: { select: { name: true, deletedAt: true } },
    },
  });

  return rider && !rider.user.deletedAt ? rider : null;
}

function standing(rider: { walletBalance: number; unpaidOrders: number; paymentHold: boolean; orderAccess: RiderOrderAccess }) {
  return { balance: rider.walletBalance, unpaidOrders: rider.unpaidOrders, hold: riderHold(rider), orderAccess: rider.orderAccess };
}

/** One rider's money lines and recharge requests, for the "History" part of their card. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });

  const { id } = await params;
  const [entries, topUps] = await Promise.all([
    prisma.riderLedgerEntry.findMany({
      where: { riderId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: { id: true, type: true, amount: true, baseAmount: true, note: true, createdAt: true },
    }),
    prisma.riderTopUp.findMany({
      where: { riderId: id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, amount: true, method: true, transactionId: true, status: true, rejectionReason: true, createdAt: true },
    }),
  ]);

  return NextResponse.json(
    {
      entries: entries.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
      topUps: topUps.map((topUp) => ({ ...topUp, createdAt: topUp.createdAt.toISOString() })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

function notifyStanding(rider: { id: string; userId: string }, change: WalletChange, lead: string) {
  // What the rider reads: what happened, and whether they can receive orders again.
  const released = change.endedHold && change.orderAccess === 'AUTO';

  notifyAfterResponse(async () => ({
    userId: rider.userId,
    type: 'ACCOUNT' as const,
    title: released ? 'You can receive orders again' : 'Your account was updated',
    message: released ? `${lead} Your account is clear: you can go online and receive new orders.` : lead,
    href: '/rider/wallet',
    refId: `rider-wallet:${rider.id}`,
  }));
}

/**
 * What an admin can do to one rider's wallet:
 * - `payment`: money received outside the app (cash, a transfer), added to the wallet;
 * - `adjust`: a correction, positive or negative, with a reason;
 * - `access`: whether the rider may receive the next order (AUTO = by payments, ALLOWED, BLOCKED);
 * - `remind`: sends the rider "Please recharge your account".
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });

  const { id } = await params;
  const rider = await findRider(id);

  if (!rider) return NextResponse.json({ error: 'Rider not found.' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === 'string' ? body.action : '';
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, MAX_WALLET_NOTE_LENGTH) : '';
  const amount = typeof body?.amount === 'number' ? body.amount : Number(body?.amount);

  if (action === 'payment') {
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_ADJUSTMENT_PKR) {
      return NextResponse.json({ error: 'Enter the amount received in whole rupees.' }, { status: 400 });
    }

    const change = await addLedgerEntry({ riderId: id, type: 'TOP_UP', amount, note: note || 'Payment received by Mangwaoo' });
    notifyStanding(rider, change, `Mangwaoo received your payment: ${formatPkr(amount)} was added to your account.`);

    return NextResponse.json({ wallet: standing({ walletBalance: change.balance, unpaidOrders: change.unpaidOrders, paymentHold: change.paymentHold, orderAccess: change.orderAccess }) });
  }

  if (action === 'adjust') {
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAX_ADJUSTMENT_PKR) {
      return NextResponse.json({ error: 'Enter the correction in whole rupees (use a minus sign to take money away).' }, { status: 400 });
    }

    if (!note) {
      return NextResponse.json({ error: 'Please write the reason for the correction.' }, { status: 400 });
    }

    const change = await addLedgerEntry({ riderId: id, type: 'ADJUSTMENT', amount, note });
    notifyStanding(
      rider,
      change,
      amount > 0 ? `${formatPkr(amount)} was added to your account: ${note}` : `${formatPkr(-amount)} was taken from your account: ${note}`
    );

    return NextResponse.json({ wallet: standing({ walletBalance: change.balance, unpaidOrders: change.unpaidOrders, paymentHold: change.paymentHold, orderAccess: change.orderAccess }) });
  }

  if (action === 'access') {
    const access = body?.access;

    if (access !== 'AUTO' && access !== 'ALLOWED' && access !== 'BLOCKED') {
      return NextResponse.json({ error: 'Choose automatic, always allowed or blocked.' }, { status: 400 });
    }

    const updated = await setOrderAccess(id, access);

    if (access !== rider.orderAccess) {
      notifyAfterResponse(async () => ({
        userId: rider.userId,
        type: 'ACCOUNT' as const,
        title:
          access === 'BLOCKED'
            ? 'Your account is on hold'
            : riderHold(updated) === 'PAYMENT'
              ? RECHARGE_TITLE
              : 'You can receive orders',
        message:
          access === 'BLOCKED'
            ? 'Mangwaoo has put your account on hold, so you will not receive new orders. Please contact support.'
            : riderHold(updated) === 'PAYMENT'
              ? rechargeMessage({ balance: updated.walletBalance, unpaidOrders: updated.unpaidOrders })
              : 'Mangwaoo checked your account: you can go online and receive new orders.',
        href: '/rider/wallet',
        refId: `rider-wallet:${id}`,
      }));
    }

    return NextResponse.json({ wallet: standing(updated) });
  }

  if (action === 'remind') {
    if (rider.walletBalance >= 0 && !rider.paymentHold) {
      return NextResponse.json({ error: "This rider doesn't owe anything right now." }, { status: 400 });
    }

    // Folds with the automatic notice (same refId), so pressing it twice shows one notification, not two.
    notifyAfterResponse(async () => ({
      userId: rider.userId,
      type: 'ACCOUNT' as const,
      title: RECHARGE_TITLE,
      message: rechargeMessage({ balance: rider.walletBalance, unpaidOrders: rider.unpaidOrders }),
      href: '/rider/wallet',
      refId: `rider-recharge:${id}`,
    }));

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
