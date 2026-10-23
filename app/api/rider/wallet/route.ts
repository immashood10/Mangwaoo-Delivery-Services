import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AD_PAYMENT, normalizePaymentRef } from '@/lib/ad-config';
import { ADMIN_PAGES } from '@/lib/notification-types';
import { notifyAdminsAfterResponse } from '@/lib/notify';
import { detectRasterImage } from '@/lib/image-signature';
import { enforceRateLimits } from '@/lib/rate-limit';
import { getWalletSettings } from '@/lib/rider-wallet';
import {
  MAX_PAYMENT_SCREENSHOT_BYTES,
  MAX_TOP_UP_PKR,
  MIN_TOP_UP_PKR,
  RIDER_TOP_UP_METHODS,
  formatPkr,
  riderHold,
} from '@/lib/rider-wallet-config';

const MAX_PENDING_TOP_UPS = 3;

async function currentRider() {
  const session = await getSession();

  if (!session || session.role !== 'RIDER') return null;

  return prisma.rider.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      user: { select: { name: true } },
      walletBalance: true,
      unpaidOrders: true,
      paymentHold: true,
      orderAccess: true,
    },
  });
}

/** The rider's wallet: standing, the rule, what they were charged and paid, and their recharge requests. */
export async function GET() {
  const rider = await currentRider();

  if (!rider) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const [settings, entries, topUps, completed] = await Promise.all([
    getWalletSettings(),
    prisma.riderLedgerEntry.findMany({
      where: { riderId: rider.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: { id: true, type: true, amount: true, baseAmount: true, note: true, createdAt: true },
    }),
    prisma.riderTopUp.findMany({
      where: { riderId: rider.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        amount: true,
        method: true,
        transactionId: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        screenshot: { select: { id: true } },
      },
    }),
    prisma.riderLedgerEntry.count({ where: { riderId: rider.id, type: 'COMMISSION' } }),
  ]);

  return NextResponse.json(
    {
      wallet: {
        balance: rider.walletBalance,
        unpaidOrders: rider.unpaidOrders,
        hold: riderHold(rider),
        completedOrders: completed,
        commissionPercent: settings.commissionPercent,
        ordersOnCredit: settings.ordersOnCredit,
      },
      entries: entries.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
      topUps: topUps.map(({ screenshot, ...topUp }) => ({ ...topUp, hasScreenshot: screenshot !== null, createdAt: topUp.createdAt.toISOString() })),
      payment: { method: AD_PAYMENT.method, accountNumber: AD_PAYMENT.accountNumber, accountName: AD_PAYMENT.accountName },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

/** "I sent Mangwaoo this money": a recharge request with the transaction id, which an admin checks and approves. */
export async function POST(request: NextRequest) {
  const rider = await currentRider();

  if (!rider) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  // The dashboard sends a form (so a screenshot can come along); plain JSON still works.
  let fields: { amount?: unknown; method?: unknown; transactionId?: unknown } | null;
  let screenshot: { mimeType: string; data: Uint8Array<ArrayBuffer> } | null = null;

  if ((request.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
    const form = await request.formData().catch(() => null);

    if (!form) return NextResponse.json({ error: 'Please fill in the recharge form.' }, { status: 400 });

    fields = { amount: form.get('amount'), method: form.get('method'), transactionId: form.get('transactionId') };

    const file = form.get('screenshot');

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_PAYMENT_SCREENSHOT_BYTES) {
        return NextResponse.json({ error: 'The screenshot is too large (max 3 MB).' }, { status: 400 });
      }

      const data = new Uint8Array(await file.arrayBuffer());
      // The type comes from the bytes, not from what the browser says the file is.
      const mimeType = detectRasterImage(data);

      if (!mimeType) {
        return NextResponse.json({ error: 'The screenshot must be a JPG, PNG or WebP picture.' }, { status: 400 });
      }

      screenshot = { mimeType, data };
    }
  } else {
    fields = await request.json().catch(() => null);
  }

  const amount = typeof fields?.amount === 'number' ? fields.amount : Number(fields?.amount);
  const method = typeof fields?.method === 'string' ? fields.method : '';
  const transactionId = normalizePaymentRef(fields?.transactionId);

  if (!Number.isInteger(amount) || amount < MIN_TOP_UP_PKR || amount > MAX_TOP_UP_PKR) {
    return NextResponse.json(
      { error: `Enter the amount you sent in whole rupees, between ${formatPkr(MIN_TOP_UP_PKR)} and ${formatPkr(MAX_TOP_UP_PKR)}.` },
      { status: 400 }
    );
  }

  if (!(RIDER_TOP_UP_METHODS as readonly string[]).includes(method)) {
    return NextResponse.json({ error: 'Please choose how you sent the money.' }, { status: 400 });
  }

  if (!transactionId) {
    return NextResponse.json({ error: 'Enter the transaction ID from your payment message (6 to 40 letters or numbers).' }, { status: 400 });
  }

  const limited = await enforceRateLimits([{ scope: 'rider-top-up', subject: rider.id, limit: 10, windowSeconds: 3600 }]);

  if (limited) return limited;

  const [pending, used] = await Promise.all([
    prisma.riderTopUp.count({ where: { riderId: rider.id, status: 'PENDING' } }),
    prisma.riderTopUp.findFirst({ where: { transactionId, status: { in: ['PENDING', 'APPROVED'] } }, select: { id: true } }),
  ]);

  if (pending >= MAX_PENDING_TOP_UPS) {
    return NextResponse.json({ error: 'You already have recharge requests waiting for Mangwaoo to check. Please wait for them first.' }, { status: 429 });
  }

  if (used) {
    return NextResponse.json({ error: 'This transaction ID has already been used.' }, { status: 409 });
  }

  const topUp = await prisma.riderTopUp.create({
    data: {
      riderId: rider.id,
      amount,
      method,
      transactionId,
      ...(screenshot ? { screenshot: { create: { mimeType: screenshot.mimeType, size: screenshot.data.byteLength, data: screenshot.data } } } : {}),
    },
  });

  notifyAdminsAfterResponse(async () => ({
    type: 'ACCOUNT' as const,
    title: 'Rider recharge waiting',
    message: `${rider.user.name} sent ${formatPkr(amount)} by ${method} (ID ${transactionId})${screenshot ? ', with a screenshot' : ''}.`,
    href: ADMIN_PAGES.riderWallets,
    refId: `rider-topup:${topUp.id}`,
  }));

  return NextResponse.json({ ok: true, topUp: { id: topUp.id } }, { status: 201 });
}
