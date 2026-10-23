import { NextResponse } from 'next/server';
import { ADMIN_PAGES } from '@/lib/notification-types';
import { notifyAdminsAfterResponse, notifyAfterResponse } from '@/lib/notify';
import { resolveRiderChatAccess } from '@/lib/rider-chat';
import { cancelOrderChat } from '@/lib/rider-chat-cancel';

/**
 * "End chat": the customer or the rider cancels the order. The whole chat is deleted for both sides, no commission is
 * charged, and the other side is told in their notification bell. (Finishing a delivered order is the rider's
 * "Complete order" / the customer's "Order received" on `/close`.) An admin removes chats with Delete in Order Chats.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await resolveRiderChatAccess(id);
  if ('error' in access) return access.error;

  if (access.role === 'ADMIN') {
    return NextResponse.json({ error: 'Admins remove order chats with Delete in Admin > Order Chats.' }, { status: 403 });
  }

  // A rider who is only looking at an open request hasn't taken the order, so there is nothing for them to cancel.
  if (access.role === 'RIDER' && access.chat.riderId !== access.riderId) {
    return NextResponse.json({ error: 'Only the rider who took this order can cancel it.' }, { status: 403 });
  }

  const result = await cancelOrderChat(id);

  if (result.kind === 'missing') {
    return NextResponse.json({ error: 'This order chat is no longer available.' }, { status: 404 });
  }

  if (result.kind === 'completed') {
    return NextResponse.json({ error: 'This order was already completed, so it can no longer be cancelled.' }, { status: 409 });
  }

  // Whoever did not press the button hears about it.
  if (access.role === 'CUSTOMER' && result.rider) {
    const { rider, customer } = result;

    notifyAfterResponse(async () => ({
      userId: rider.userId,
      type: 'ORDER' as const,
      title: 'Order cancelled',
      message: `${customer.name} cancelled the order. The chat has been removed.`,
      href: null,
    }));
  }

  if (access.role === 'RIDER' && result.rider) {
    const { rider, customer } = result;

    notifyAfterResponse(async () => ({
      userId: customer.userId,
      type: 'ORDER' as const,
      title: 'Your order was cancelled',
      message: `${rider.name} cancelled your order, and the chat has been removed. You can place a new order any time.`,
      href: null,
    }));
    // A rider backing out after taking an order is something the admin wants to see.
    notifyAdminsAfterResponse(async () => ({
      type: 'ORDER' as const,
      title: 'Rider cancelled an order',
      message: `${rider.name} cancelled the order of ${customer.name} after taking it.`,
      href: ADMIN_PAGES.chats,
    }));
  }

  return NextResponse.json({ ok: true });
}
