import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimits } from '@/lib/rate-limit';
import { ADMIN_PAGES } from '@/lib/notification-types';
import { notifyAdminsAfterResponse } from '@/lib/notify';
import { cancelMonthlyRequest, submitMonthlyPayment } from '@/lib/monthly-rider';
import { formatPkr } from '@/lib/rider-wallet-config';
import { parseMonthlyPayment } from '@/lib/monthly-rider-config';
import { getMonthlyRiderCustomer } from '@/lib/monthly-rider-request';

/**
 * The customer's own actions on their booking. `cancel`: before they pay. `pay`: they sent the money to Mangwaoo and enter the
 * method and transaction id; every admin's bell is told to check it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await getMonthlyRiderCustomer();
  if ('error' in resolved) return resolved.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (body?.action === 'cancel') {
    const result = await cancelMonthlyRequest(resolved.customer.id, id);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ ok: true });
  }

  if (body?.action === 'pay') {
    const limited = await enforceRateLimits(
      [{ scope: 'monthly-rider-pay', subject: resolved.customer.userId, limit: 10, windowSeconds: 3600 }],
      'You are doing that too often. Please wait a little and try again.'
    );

    if (limited) return limited;

    const payment = parseMonthlyPayment(body);

    if ('error' in payment) return NextResponse.json({ error: payment.error }, { status: 400 });

    const result = await submitMonthlyPayment(resolved.customer.id, id, payment);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    notifyAdminsAfterResponse(async () => ({
      type: 'ACCOUNT' as const,
      title: 'Monthly rider payment to check',
      message: `${result.customerName} paid ${formatPkr(result.priceRs)} by ${payment.method} for ${result.ref} (ID ${payment.transactionId}).`,
      href: ADMIN_PAGES.monthlyRiders,
      refId: `monthly-rider:${id}`,
    }));

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
