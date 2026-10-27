import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { normalizePaymentRef } from '@/lib/ad-config';
import { notifyAfterResponse } from '@/lib/notify';
import { markWithdrawalPaid, rejectWithdrawal } from '@/lib/points';
import { MAX_REJECTION_REASON_LENGTH, PAYOUT_LABELS, formatPkr } from '@/lib/points-config';

/**
 * An admin deals with a customer's withdrawal request. `paid`: the money was sent by hand to the customer's JazzCash /
 * EasyPaisa account (the transfer's transaction id is kept). `reject`: it is turned down and the money goes back into the
 * customer's wallet. The customer is told either way.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (body?.action === 'paid') {
    const transactionId = normalizePaymentRef(body?.transactionId);

    if (!transactionId) {
      return NextResponse.json({ error: 'Enter the transaction ID of the money you sent (6 to 40 letters or numbers).' }, { status: 400 });
    }

    const result = await markWithdrawalPaid(id, session.userId, transactionId);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    notifyAfterResponse(async () => ({
      userId: result.customerUserId,
      type: 'ACCOUNT' as const,
      title: 'Your money was sent',
      message: `${formatPkr(result.amount)} was sent to your ${PAYOUT_LABELS[result.method]} account ${result.accountNumber}. Transaction ID: ${transactionId}.`,
      href: '/account/points',
      refId: `withdrawal:${id}`,
    }));

    return NextResponse.json({ ok: true });
  }

  if (body?.action === 'reject') {
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, MAX_REJECTION_REASON_LENGTH) : '';
    const result = await rejectWithdrawal(id, session.userId, reason);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    notifyAfterResponse(async () => ({
      userId: result.customerUserId,
      type: 'ACCOUNT' as const,
      title: 'Withdrawal not sent',
      message: `We could not send ${formatPkr(result.amount)} to your ${PAYOUT_LABELS[result.method]} ${result.accountNumber}.${reason ? ` ${reason.replace(/[.!?\s]+$/, '')}.` : ''} The money is back in your wallet.`,
      href: '/account/points',
      refId: `withdrawal:${id}`,
    }));

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
