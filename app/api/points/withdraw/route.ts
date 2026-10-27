import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimits } from '@/lib/rate-limit';
import { ADMIN_PAGES } from '@/lib/notification-types';
import { notifyAdminsAfterResponse } from '@/lib/notify';
import { requestWithdrawal } from '@/lib/points';
import { PAYOUT_LABELS, formatPkr } from '@/lib/points-config';
import { getPointsCustomer } from '@/lib/points-request';

/**
 * "Send my wallet money to my JazzCash / EasyPaisa": the amount leaves the wallet at once and a request is opened for an
 * admin, who sends the money by hand and marks it paid (or turns it down, and the money goes back).
 */
export async function POST(request: NextRequest) {
  const resolved = await getPointsCustomer();
  if ('error' in resolved) return resolved.error;

  const body = await request.json().catch(() => null);

  const limited = await enforceRateLimits(
    [{ scope: 'points-withdraw', subject: resolved.customer.userId, limit: 10, windowSeconds: 3600 }],
    'You are doing that too often. Please wait a little and try again.'
  );

  if (limited) return limited;

  const result = await requestWithdrawal(resolved.customer.id, {
    amount: body?.amount,
    method: body?.method,
    accountNumber: body?.accountNumber,
    accountName: body?.accountName,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const name = resolved.customer.user.name;

  notifyAdminsAfterResponse(async () => ({
    type: 'ACCOUNT' as const,
    title: 'Wallet withdrawal waiting',
    message: `${name} asked for ${formatPkr(result.amount)} to their ${PAYOUT_LABELS[result.method]} ${result.accountNumber}.`,
    href: ADMIN_PAGES.walletPayouts,
    refId: `withdrawal:${result.withdrawalId}`,
  }));

  return NextResponse.json(
    { ok: true, withdrawal: { id: result.withdrawalId, amount: result.amount }, walletBalance: result.walletBalance },
    { status: 201, headers: { 'Cache-Control': 'no-store' } }
  );
}
