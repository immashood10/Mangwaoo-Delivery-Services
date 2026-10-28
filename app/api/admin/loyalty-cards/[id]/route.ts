import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { notifyAfterResponse } from '@/lib/notify';
import { approveLoyaltyCard, rejectLoyaltyCard, revokeLoyaltyCard } from '@/lib/loyalty-card';
import { MAX_CARD_REASON_LENGTH } from '@/lib/loyalty-card-config';

const PAGE = '/account/loyalty-card';

/** Puts the admin's reason after a sentence: "…. Reason." (a trailing full stop in the reason is not doubled). */
function withReason(reason: string) {
  return reason ? ` ${reason.replace(/[.!?\s]+$/, '')}.` : '';
}

/**
 * An admin deals with a customer's Loyalty Card. `approve`: a waiting application becomes an active card (also gives a
 * taken-back card back). `reject`: the application is turned down and the customer may apply again. `revoke`: an active card
 * is taken back. The customer is told each time.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, MAX_CARD_REASON_LENGTH) : '';

  if (body?.action === 'approve') {
    const result = await approveLoyaltyCard(id, session.userId);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    notifyAfterResponse(async () => ({
      userId: result.customerUserId,
      type: 'ACCOUNT' as const,
      title: 'Your Loyalty Card is ready',
      message: `Mangwaoo approved your Loyalty Card ${result.ref}. From now on every order you place gets a surprise discount.`,
      href: PAGE,
      refId: `loyalty-card:${id}`,
    }));

    return NextResponse.json({ ok: true });
  }

  if (body?.action === 'reject') {
    const result = await rejectLoyaltyCard(id, session.userId, reason);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    notifyAfterResponse(async () => ({
      userId: result.customerUserId,
      type: 'ACCOUNT' as const,
      title: 'Loyalty Card not approved',
      message: `Mangwaoo could not approve your Loyalty Card application.${withReason(reason)} You can apply again.`,
      href: PAGE,
      refId: `loyalty-card:${id}`,
    }));

    return NextResponse.json({ ok: true });
  }

  if (body?.action === 'revoke') {
    const result = await revokeLoyaltyCard(id, session.userId, reason);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    notifyAfterResponse(async () => ({
      userId: result.customerUserId,
      type: 'ACCOUNT' as const,
      title: 'Your Loyalty Card was taken back',
      message: `Mangwaoo took back your Loyalty Card ${result.ref}.${withReason(reason)} Your orders no longer get the discount.`,
      href: PAGE,
      refId: `loyalty-card:${id}`,
    }));

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
