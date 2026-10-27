import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { CheckoutError, type CheckoutLine, type Marketplace } from '@/lib/checkout';
import { parseCoordinates, type Coordinates } from '@/lib/geo';
import { enforceRateLimits } from '@/lib/rate-limit';

// What the checkout routes (quote, checkout, and the older per-marketplace order routes) all read from a request.

const MAX_LINES = 100;
const MAX_LINE_QUANTITY = 99;
const MAX_ORDER_NOTE_LENGTH = 500;

export const PAYMENT_METHOD_MAP: Record<string, 'CASH_ON_DELIVERY' | 'WALLET'> = {
  cod: 'CASH_ON_DELIVERY',
  easypaisa_jazzcash: 'WALLET',
};

/** The logged-in customer, or the response to send instead. `rate` limits how often one customer may call the route. */
export async function getCheckoutCustomer(rate?: { scope: string; limit: number; windowSeconds: number }) {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    return {
      error: NextResponse.json(
        { error: 'Please log in as a customer to place an order.', requiresLogin: true },
        { status: 401 }
      ),
    };
  }

  const customer = await prisma.customer.findUnique({ where: { userId: session.userId } });

  if (!customer) {
    return { error: NextResponse.json({ error: 'Customer account not found.' }, { status: 404 }) };
  }

  if (rate) {
    const limited = await enforceRateLimits([{ ...rate, subject: session.userId }], 'You are doing that too often. Please wait a little and try again.');

    if (limited) return { error: limited };
  }

  return { customer: { id: customer.id, userId: session.userId } };
}

/** The cart lines in a request. Each item says which marketplace it is from, unless the route is for one marketplace. */
export function parseLines(rawItems: unknown, fixedMarketplace?: Marketplace): CheckoutLine[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .slice(0, MAX_LINES)
    .map((raw: unknown) => {
      const record = (raw ?? {}) as Record<string, unknown>;
      const qty = typeof record.qty === 'number' ? record.qty : parseInt(String(record.qty ?? ''), 10);
      const marketplace = fixedMarketplace ?? (record.marketplace === 'gulplaza' ? 'gulplaza' : 'mart');

      return {
        productId: typeof record.productId === 'string' ? record.productId : '',
        marketplace,
        qty: Math.min(Math.floor(qty), MAX_LINE_QUANTITY),
        // The size (in grams) of a food dish sold by weight; the server checks it is one the dish really has.
        portion: marketplace === 'gulplaza' && typeof record.portion === 'number' && Number.isInteger(record.portion) && record.portion > 0 ? record.portion : undefined,
        name: typeof record.name === 'string' ? record.name : undefined,
        price: typeof record.price === 'string' ? record.price : undefined,
      } satisfies CheckoutLine;
    })
    .filter((line) => line.productId && Number.isFinite(line.qty) && line.qty > 0);
}

/** Where the order is going, as {lat, lng}; null when it wasn't sent or isn't a real position. */
export function parseDropoff(raw: unknown): Coordinates | null {
  const record = (raw ?? {}) as Record<string, unknown>;

  return parseCoordinates(String(record.lat ?? ''), String(record.lng ?? ''));
}

export function parseCouponCode(raw: unknown) {
  const code = typeof raw === 'string' ? raw.trim() : '';

  return code ? code.slice(0, 40) : null;
}

/** The delivery details every order needs; null when something is missing. */
export function parseOrderDetails(body: Record<string, unknown> | null) {
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const contactNumber = typeof body?.contactNumber === 'string' ? body.contactNumber.trim() : '';
  const completeAddress = typeof body?.completeAddress === 'string' ? body.completeAddress.trim() : '';
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, MAX_ORDER_NOTE_LENGTH) : '';
  const paymentMethod =
    typeof body?.paymentMethod === 'string' && Object.hasOwn(PAYMENT_METHOD_MAP, body.paymentMethod)
      ? PAYMENT_METHOD_MAP[body.paymentMethod]
      : undefined;

  if (!fullName || !contactNumber || !completeAddress || !paymentMethod) return null;

  return { fullName, contactNumber, completeAddress, note, paymentMethod };
}

/** The response for a problem the customer can fix (a bad coupon, an item that sold out). */
export function checkoutErrorResponse(error: unknown) {
  if (error instanceof CheckoutError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  throw error;
}
