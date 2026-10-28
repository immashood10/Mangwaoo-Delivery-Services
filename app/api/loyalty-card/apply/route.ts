import { NextResponse } from 'next/server';
import { enforceRateLimits } from '@/lib/rate-limit';
import { ADMIN_PAGES } from '@/lib/notification-types';
import { notifyAdminsAfterResponse } from '@/lib/notify';
import { applyForLoyaltyCard } from '@/lib/loyalty-card';
import { getCardCustomer } from '@/lib/loyalty-card-request';

/**
 * "Apply for my Loyalty Card": needs enough delivered orders (the rule is the admin's). The application waits for an admin,
 * who approves it or turns it down; every admin's bell is told there is one waiting.
 */
export async function POST() {
  const resolved = await getCardCustomer();
  if ('error' in resolved) return resolved.error;

  const limited = await enforceRateLimits(
    [{ scope: 'loyalty-card-apply', subject: resolved.customer.userId, limit: 10, windowSeconds: 3600 }],
    'You are doing that too often. Please wait a little and try again.'
  );

  if (limited) return limited;

  const result = await applyForLoyaltyCard(resolved.customer.id);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  notifyAdminsAfterResponse(async () => ({
    type: 'ACCOUNT' as const,
    title: 'Loyalty Card application waiting',
    message: `${result.customerName} applied for the Loyalty Card (${result.delivered} delivered orders).`,
    href: ADMIN_PAGES.loyaltyCards,
    refId: `loyalty-card:${result.cardId}`,
  }));

  return NextResponse.json({ ok: true, ref: result.ref }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
