import { NextRequest, NextResponse } from 'next/server';
import { CheckoutError, priceCheckout } from '@/lib/checkout';
import { getCheckoutCustomer, parseCouponCode, parseDropoff, parseLines } from '@/lib/checkout-request';

/**
 * What the cart will cost, for the cart page to show before the customer places the order. It is the same
 * calculation checkout uses, so the numbers on screen are the numbers charged. A coupon that can't be used
 * doesn't fail the request: the answer is the price without it, plus `couponError` saying why.
 */
export async function POST(request: NextRequest) {
  const resolved = await getCheckoutCustomer();
  if ('error' in resolved) return resolved.error;

  const body = await request.json().catch(() => null);
  const lines = parseLines(body?.items);
  const dropoff = parseDropoff(body?.dropoff);
  const couponCode = parseCouponCode(body?.couponCode);
  const customerId = resolved.customer.id;

  try {
    const { quote } = await priceCheckout({ lines, dropoff, couponCode, customerId });

    return NextResponse.json({ quote });
  } catch (error) {
    if (!(error instanceof CheckoutError) || !couponCode) throw error;

    const { quote } = await priceCheckout({ lines, dropoff, couponCode: null, customerId });

    return NextResponse.json({ quote, couponError: error.message });
  }
}
