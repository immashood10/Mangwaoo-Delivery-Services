import { NextResponse } from 'next/server';
import { enforceRateLimits } from '@/lib/rate-limit';
import { redeemPoints } from '@/lib/points';
import { getPointsCustomer } from '@/lib/points-request';

/**
 * Cashes in Mangwaoo Points: the cost of one cashback (500 points to start with) is spent and a random Rs 1 to 10 goes into
 * the customer's wallet. The draw is made here, on the server, never in the browser.
 */
export async function POST() {
  const resolved = await getPointsCustomer();
  if ('error' in resolved) return resolved.error;

  const limited = await enforceRateLimits(
    [{ scope: 'points-redeem', subject: resolved.customer.userId, limit: 30, windowSeconds: 3600 }],
    'You are doing that too often. Please wait a little and try again.'
  );

  if (limited) return limited;

  const result = await redeemPoints(resolved.customer.id);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json(
    { ok: true, cashback: result.cashback, points: result.points, walletBalance: result.walletBalance, cost: result.cost },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
