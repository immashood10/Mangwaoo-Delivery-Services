import { NextRequest, NextResponse } from 'next/server';
import { placeOrders } from '@/lib/checkout';
import { checkoutErrorResponse, getCheckoutCustomer, parseLines, parseOrderDetails } from '@/lib/checkout-request';

/**
 * Places MangwaooMart orders only (the cart page uses /api/checkout for everything). MangwaooMart has no
 * delivery fee and this route takes no coupon.
 */
export async function POST(request: NextRequest) {
  const resolved = await getCheckoutCustomer();
  if ('error' in resolved) return resolved.error;

  const body = await request.json().catch(() => null);
  const lines = parseLines(body?.items, 'mart');
  const details = parseOrderDetails(body);

  if (lines.length === 0) {
    return NextResponse.json({ error: 'No valid items to order.' }, { status: 400 });
  }

  if (!details) {
    return NextResponse.json({ error: 'Please fill in all delivery details.' }, { status: 400 });
  }

  try {
    const { orders } = await placeOrders({ customer: resolved.customer, lines, ...details, dropoff: null, couponCode: null });

    return NextResponse.json({ orders: orders.map((order) => ({ id: order.id, sellerId: order.sellerId })) }, { status: 201 });
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
