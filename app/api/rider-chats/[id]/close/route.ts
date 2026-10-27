import { NextResponse } from 'next/server';
import { resolveRiderChatAccess } from '@/lib/rider-chat';
import { notifyAdminsAfterResponse, notifyAfterResponse } from '@/lib/notify';
import { ADMIN_PAGES } from '@/lib/notification-types';
import { closeOrderChat } from '@/lib/rider-wallet';
import { RECHARGE_TITLE, formatPkr, rechargeMessage } from '@/lib/rider-wallet-config';

/**
 * Finishes a delivered order: the rider's "Complete order" or the customer's "Order received". When a rider had taken
 * the order this is the moment Mangwaoo's commission is charged to the rider's wallet. The delivery charge it is a
 * percentage of comes from the order itself (the chat's delivery charge, see `deliveryChargeForChat`); nothing the rider
 * sends is read. An admin's "Close" only closes the chat (no commission: use Rider Wallets > Adjust if one is due).
 * "End chat" is NOT this: it cancels the order and deletes the chat (`/cancel`).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await resolveRiderChatAccess(id);
  if ('error' in access) return access.error;

  // Riders can only close chats they have claimed, not open requests.
  if (access.role === 'RIDER' && access.chat.riderId !== access.riderId) {
    return NextResponse.json({ error: 'Reply first to take this order.' }, { status: 403 });
  }

  const { found, commission: result, finished } = await closeOrderChat(id, { charge: access.role !== 'ADMIN' });

  if (!found) {
    return NextResponse.json({ error: 'This order chat is no longer available.' }, { status: 404 });
  }

  // The rider says it is delivered: the customer may not be looking at the chat, so they are told and asked to rate the ride.
  if (access.role === 'RIDER' && finished) {
    notifyAfterResponse(async () => ({
      userId: finished.customerUserId,
      type: 'ORDER' as const,
      title: 'Order delivered',
      message: `${finished.riderName} marked your order as delivered. How was the ride? Please rate your rider.`,
      href: `/rate-rider/${id}`,
      refId: `rate:${id}`,
    }));
  }

  if (result?.change?.startedHold && result.change.orderAccess === 'AUTO') {
    const { change } = result;

    // The rider is told to recharge; the admins see who is now on hold.
    notifyAfterResponse(async () => ({
      userId: result.riderUserId,
      type: 'ACCOUNT' as const,
      title: RECHARGE_TITLE,
      message: rechargeMessage({ balance: change.balance, unpaidOrders: change.unpaidOrders }),
      href: '/rider/wallet',
      refId: `rider-recharge:${result.riderId}`,
    }));
    notifyAdminsAfterResponse(async () => ({
      type: 'ACCOUNT' as const,
      title: 'Rider needs to recharge',
      message: `${result.riderName} owes ${formatPkr(Math.max(0, -change.balance))} (${change.unpaidOrders} unpaid orders) and can't receive new orders until paid.`,
      href: ADMIN_PAGES.riderWallets,
      refId: `rider-hold:${result.riderId}`,
    }));
  }

  return NextResponse.json({
    ok: true,
    ...(result && result.commission > 0 && access.role === 'RIDER'
      ? {
          commission: {
            amount: result.commission,
            baseFee: result.baseFee,
            percent: result.percent,
            balance: result.change?.balance ?? null,
            onHold: result.change ? result.change.paymentHold && result.change.orderAccess === 'AUTO' : false,
          },
        }
      : {}),
  });
}
