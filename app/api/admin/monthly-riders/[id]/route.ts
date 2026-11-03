import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { notifyAfterResponse } from '@/lib/notify';
import { changeMonthlyRider, closeMonthlyBooking, confirmMonthlyPayment, quoteMonthlyBooking } from '@/lib/monthly-rider';
import { MAX_MONTHLY_REASON_LENGTH, formatMonthlyDate, parseMonthlyQuote } from '@/lib/monthly-rider-config';
import { notifyMonthlyQuote, notifyMonthlyRiderChange } from '@/lib/monthly-rider-notices';

const CUSTOMER_PAGE = '/account/monthly-rider';

/** Puts the admin's reason after a sentence: "…. Reason." (a trailing full stop in the reason is not doubled). */
function withReason(reason: string) {
  return reason ? ` ${reason.replace(/[.!?\s]+$/, '')}.` : '';
}

/**
 * An admin deals with a monthly rider booking. `quote`: set the price and the rider (also changes them before the customer has
 * paid). `confirm`: the payment arrived, the month starts. `reject`: turn the request down. `end`: stop an active month early.
 * `change-rider`: give a booking to another rider. The people involved are told each time.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, MAX_MONTHLY_REASON_LENGTH) : '';

  if (body?.action === 'quote') {
    const parsed = parseMonthlyQuote(body);

    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const result = await quoteMonthlyBooking(id, { userId: session.userId }, parsed);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    notifyMonthlyQuote(id, result);

    return NextResponse.json({ ok: true });
  }

  if (body?.action === 'confirm') {
    const result = await confirmMonthlyPayment(id, session.userId);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    notifyAfterResponse(async () => [
      {
        userId: result.customerUserId,
        type: 'ACCOUNT' as const,
        title: 'Your monthly rider is ready',
        message: `Payment received for ${result.ref}. ${result.riderName ?? 'Your rider'} is your rider until ${formatMonthlyDate(result.endsAt)}. Order from the Chat window and it goes to them first.`,
        href: CUSTOMER_PAGE,
        refId: `monthly-rider:${id}`,
      },
      ...(result.riderUserId
        ? [
            {
              userId: result.riderUserId,
              type: 'ACCOUNT' as const,
              title: 'New monthly customer',
              message: `You are now the monthly rider of a customer (${result.ref}) until ${formatMonthlyDate(result.endsAt)}. Their orders come to you first.`,
              href: '/rider',
              refId: `monthly-rider-rider:${id}`,
            },
          ]
        : []),
    ]);

    return NextResponse.json({ ok: true });
  }

  if (body?.action === 'reject' || body?.action === 'end') {
    const kind = body.action === 'reject' ? 'reject' : 'end';
    const result = await closeMonthlyBooking(id, session.userId, kind, reason);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    notifyAfterResponse(async () => [
      {
        userId: result.customerUserId,
        type: 'ACCOUNT' as const,
        title: kind === 'reject' ? 'Monthly rider not accepted' : 'Your monthly rider ended',
        message:
          kind === 'reject'
            ? `Mangwaoo could not accept your monthly rider request ${result.ref}.${withReason(reason)} If you already paid, Mangwaoo will send your money back.`
            : `Your monthly rider ${result.ref} has ended.${withReason(reason)} Your orders go the usual way again.`,
        href: CUSTOMER_PAGE,
        refId: `monthly-rider:${id}`,
      },
      ...(kind === 'end' && result.riderUserId
        ? [
            {
              userId: result.riderUserId,
              type: 'ACCOUNT' as const,
              title: 'Monthly customer ended',
              message: `The monthly booking ${result.ref} has ended.`,
              href: '/rider',
              refId: `monthly-rider-rider:${id}`,
            },
          ]
        : []),
    ]);

    return NextResponse.json({ ok: true });
  }

  if (body?.action === 'change-rider') {
    const riderId = typeof body.riderId === 'string' ? body.riderId.trim() : '';

    if (!riderId) return NextResponse.json({ error: 'Please choose the rider.' }, { status: 400 });

    const result = await changeMonthlyRider(id, { userId: session.userId }, riderId);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    notifyMonthlyRiderChange(id, result);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
