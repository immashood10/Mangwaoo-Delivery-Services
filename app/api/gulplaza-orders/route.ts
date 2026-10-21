import { NextRequest, NextResponse } from 'next/server';
import { placeOrders } from '@/lib/checkout';
import { checkoutErrorResponse, getCheckoutCustomer, parseDropoff, parseLines, parseOrderDetails } from '@/lib/checkout-request';

/**
 * Places food orders only (the cart page uses /api/checkout for everything). Pass `dropoff` ({ lat, lng }) so the
 * delivery fee can be worked out; this route takes no coupon.
 */
export async function POST(request: NextRequest) {
  const resolved = await getCheckoutCustomer({ scope: 'order-placed', limit: 30, windowSeconds: 3600 });
  if ('error' in resolved) return resolved.error;

  const body = await request.json().catch(() => null);
  const lines = parseLines(body?.items, 'gulplaza');
  const details = parseOrderDetails(body);

  if (lines.length === 0) {
    return NextResponse.json({ error: 'No valid items to order.' }, { status: 400 });
  }

  if (!details) {
    return NextResponse.json({ error: 'Please fill in all delivery details.' }, { status: 400 });
  }

  try {
    const { orders } = await placeOrders({
      customer: resolved.customer,
      lines,
      ...details,
      dropoff: parseDropoff(body?.dropoff),
      couponCode: null,
    });

    return NextResponse.json({ orders: orders.map((order) => ({ id: order.id, sellerId: order.sellerId })) }, { status: 201 });
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
