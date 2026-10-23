import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { notifyAfterResponse } from '@/lib/notify';
import { saveWalletSettings } from '@/lib/rider-wallet';
import { MAX_ORDERS_ON_CREDIT, RECHARGE_TITLE, rechargeMessage } from '@/lib/rider-wallet-config';

/**
 * Saves the commission rule: Mangwaoo's percentage of each order's delivery charge and how many finished orders a
 * rider may leave unpaid. It applies to orders finished from now on; riders it puts on hold (or releases) are told.
 */
export async function PUT(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const commissionPercent = typeof body?.commissionPercent === 'number' ? body.commissionPercent : Number(body?.commissionPercent);
  const ordersOnCredit = typeof body?.ordersOnCredit === 'number' ? body.ordersOnCredit : Number(body?.ordersOnCredit);

  if (!Number.isInteger(commissionPercent) || commissionPercent < 1 || commissionPercent > 100) {
    return NextResponse.json({ error: 'The commission must be a whole number between 1 and 100 percent.' }, { status: 400 });
  }

  if (!Number.isInteger(ordersOnCredit) || ordersOnCredit < 0 || ordersOnCredit > MAX_ORDERS_ON_CREDIT) {
    return NextResponse.json({ error: `Orders allowed before paying must be a whole number from 0 to ${MAX_ORDERS_ON_CREDIT}.` }, { status: 400 });
  }

  const changes = await saveWalletSettings(commissionPercent, ordersOnCredit);

  for (const { riderId, riderUserId, change } of changes) {
    if (change.orderAccess !== 'AUTO') continue;

    notifyAfterResponse(async () => ({
      userId: riderUserId,
      type: 'ACCOUNT' as const,
      title: change.startedHold ? RECHARGE_TITLE : 'You can receive orders again',
      message: change.startedHold
        ? rechargeMessage({ balance: change.balance, unpaidOrders: change.unpaidOrders })
        : 'Mangwaoo changed the payment rule: you can go online and receive new orders.',
      href: '/rider/wallet',
      refId: `rider-wallet:${riderId}`,
    }));
  }

  return NextResponse.json({ ok: true, settings: { commissionPercent, ordersOnCredit }, changedRiders: changes.length });
}
