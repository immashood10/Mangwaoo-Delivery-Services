import { NextRequest, NextResponse } from 'next/server';
import { placeOrders } from '@/lib/checkout';
import {
  checkoutErrorResponse,
  getCheckoutCustomer,
  parseCouponCode,
  parseDropoff,
  parseLines,
  parseOrderDetails,
} from '@/lib/checkout-request';

/**
 * Checkout for the whole cart: MangwaooMart and food items together, one order per seller, in one go. Food orders
 * carry the delivery fee for their restaurant → customer distance; a coupon takes a % off the items.
 */
export async function POST(request: NextRequest) {
  const resolved = await getCheckoutCustomer({ scope: 'order-placed', limit: 30, windowSeconds: 3600 });
  if ('error' in resolved) return resolved.error;

  const body = await request.json().catch(() => null);
  const lines = parseLines(body?.items);
  const details = parseOrderDetails(body);

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
      dropoff: parseDropoff(body?.dropoff),
      couponCode: parseCouponCode(body?.couponCode),
    });

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
      },
      { status: 201 }
    );
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
