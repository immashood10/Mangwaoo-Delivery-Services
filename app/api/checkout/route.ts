import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { placeOrders } from '@/lib/checkout';
import {
  checkoutErrorResponse,
  getCheckoutCustomer,
  parseCouponCode,
  parseDropoff,
  parseLines,
  parseOrderDetails,
} from '@/lib/checkout-request';
import { MAX_ORDER_CHAT_ADDRESS_LENGTH, startOrContinueOrderChat } from '@/lib/order-chat';
import { MAX_RIDER_CHAT_MESSAGE_LENGTH } from '@/lib/rider-chat-types';

/** The order chat the cart page wants opened for this checkout (its first message and the names for the route), or null. */
function parseOrderChat(raw: unknown) {
  const record = (raw ?? {}) as Record<string, unknown>;
  const addressText = typeof record.addressText === 'string' ? record.addressText.trim().slice(0, MAX_ORDER_CHAT_ADDRESS_LENGTH) : '';
  const pickupText = typeof record.pickupText === 'string' ? record.pickupText.trim().slice(0, MAX_ORDER_CHAT_ADDRESS_LENGTH) : '';
  const text = typeof record.body === 'string' ? record.body.trim() : '';

  if (!addressText || !pickupText || !text || text.length > MAX_RIDER_CHAT_MESSAGE_LENGTH) return null;

  return { addressText, pickupText, text };
}

/**
 * Checkout for the whole cart: MangwaooMart and food items together, one order per seller, in one go. Food orders
 * carry the delivery fee for their restaurant → customer distance; a coupon takes a % off the items. When the cart page
 * sends a `chat` (the order summary), the rider's order chat is opened here too, so the delivery charge the server just
 * worked out is saved on the chat and reaches the rider by itself: the rider never types it.
 */
export async function POST(request: NextRequest) {
  const resolved = await getCheckoutCustomer({ scope: 'order-placed', limit: 30, windowSeconds: 3600 });
  if ('error' in resolved) return resolved.error;

  const body = await request.json().catch(() => null);
  const lines = parseLines(body?.items);
  const details = parseOrderDetails(body);
  const dropoff = parseDropoff(body?.dropoff);

  if (lines.length === 0) {
    return NextResponse.json({ error: 'No valid items to order.' }, { status: 400 });
  }

  if (!details) {
    return NextResponse.json({ error: 'Please fill in all delivery details.' }, { status: 400 });
  }

  try {
    const { orders, quote } = await placeOrders({
      customer: resolved.customer,
      lines,
      ...details,
      dropoff,
      couponCode: parseCouponCode(body?.couponCode),
    });

    // The orders are placed. If the chat can't be opened the cart page sends the customer to their account instead.
    let chat: { id: string } | null = null;
    const chatRequest = parseOrderChat(body?.chat);

    if (chatRequest && dropoff) {
      try {
        // The longest restaurant → customer ride of this checkout: what the rider's delivery bonus is judged by (MangwaooMart has none).
        const distanceKm = quote.orders
          .slice(0, orders.length)
          .reduce<number | null>((longest, order) => (order.marketplace === 'gulplaza' && order.distanceKm !== null ? Math.max(longest ?? 0, order.distanceKm) : longest), null);
        const owner = await prisma.user.findUnique({ where: { id: resolved.customer.userId }, select: { name: true } });
        const opened = owner
          ? await startOrContinueOrderChat({
              customer: { id: resolved.customer.id, name: owner.name },
              lat: dropoff.lat,
              lng: dropoff.lng,
              addressText: chatRequest.addressText,
              pickup: null,
              pickupText: chatRequest.pickupText,
              text: chatRequest.text,
              // The server's own number: the delivery fees of the food orders just priced (0 for MangwaooMart).
              deliveryCharge: Math.round(quote.delivery),
              distanceKm,
            })
          : null;

        chat = opened?.chat ? { id: opened.chat.id } : null;
      } catch {
        chat = null;
      }
    }

    return NextResponse.json(
      {
        orders: orders.map((order, index) => ({
          ...order,
          subtotal: quote.orders[index].subtotal,
          deliveryFee: quote.orders[index].deliveryFee,
          discount: quote.orders[index].discount,
          total: quote.orders[index].total,
        })),
        totals: { subtotal: quote.subtotal, delivery: quote.delivery, discount: quote.discount, total: quote.total },
        coupon: quote.coupon,
        loyalty: quote.loyalty,
        chat,
      },
      { status: 201 }
    );
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
