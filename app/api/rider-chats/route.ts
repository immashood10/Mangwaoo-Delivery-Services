import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { MAX_ORDER_CHAT_ADDRESS_LENGTH as MAX_ADDRESS_LENGTH, startOrContinueOrderChat } from '@/lib/order-chat';
import { enforceRateLimits } from '@/lib/rate-limit';
import { MAX_RIDER_CHAT_MESSAGE_LENGTH, RIDER_CHAT_INCLUDE, summarizeRiderChat } from '@/lib/rider-chat';

async function getCustomer() {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    return null;
  }

  return prisma.customer.findUnique({
    where: { userId: session.userId },
    include: { user: { select: { name: true } } },
  });
}

/** The customer's current (not yet closed) order chat, if any. */
export async function GET() {
  const customer = await getCustomer();

  if (!customer) {
    return NextResponse.json(
      { error: 'Please log in as a customer to chat about an order.', requiresLogin: true },
      { status: 401 }
    );
  }

  const chat = await prisma.riderChat.findFirst({
    where: { customerId: customer.id, status: { in: ['OPEN', 'ACTIVE'] } },
    orderBy: { createdAt: 'desc' },
    include: RIDER_CHAT_INCLUDE,
  });

  return NextResponse.json({ chat: chat ? await summarizeRiderChat(chat) : null });
}

/** Starts a new order chat at the customer's delivery location with their first message. */
export async function POST(request: NextRequest) {
  const customer = await getCustomer();

  if (!customer) {
    return NextResponse.json(
      { error: 'Please log in as a customer to chat about an order.', requiresLogin: true },
      { status: 401 }
    );
  }

  const limited = await enforceRateLimits([{ scope: 'rider-chat-start', subject: customer.id, limit: 20, windowSeconds: 3600 }]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const lat = typeof body?.lat === 'number' ? body.lat : NaN;
  const lng = typeof body?.lng === 'number' ? body.lng : NaN;
  const addressText = typeof body?.addressText === 'string' ? body.addressText.trim() : '';
  // A checkout order names the restaurant(s) as the pickup but has no coordinates for them.
  const fromCheckout = body?.fromCheckout === true;
  const pickupLat = typeof body?.pickupLat === 'number' ? body.pickupLat : NaN;
  const pickupLng = typeof body?.pickupLng === 'number' ? body.pickupLng : NaN;
  const pickupText = typeof body?.pickupText === 'string' ? body.pickupText.trim().slice(0, MAX_ADDRESS_LENGTH) : '';
  const text = typeof body?.body === 'string' ? body.body.trim() : '';

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !addressText) {
    return NextResponse.json({ error: 'Please select your delivery address first.' }, { status: 400 });
  }

  const hasPickupCoordinates =
    Number.isFinite(pickupLat) && Number.isFinite(pickupLng) && Math.abs(pickupLat) <= 90 && Math.abs(pickupLng) <= 180;

  if (!pickupText || (!hasPickupCoordinates && !fromCheckout)) {
    return NextResponse.json({ error: 'Please select the pickup location first.' }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: 'Please tell us what you want to order.' }, { status: 400 });
  }

  if (text.length > MAX_RIDER_CHAT_MESSAGE_LENGTH) {
    return NextResponse.json({ error: 'Message is too long.' }, { status: 400 });
  }

  // One live order chat per customer — a second "start" just continues it. A chat started here carries no delivery
  // charge of its own (that is set by a checkout, see /api/checkout): its charge is the rate for the pickup → drop-off ride.
  const { chat, created } = await startOrContinueOrderChat({
    customer: { id: customer.id, name: customer.user.name },
    lat,
    lng,
    addressText,
    pickup: hasPickupCoordinates ? { lat: pickupLat, lng: pickupLng } : null,
    pickupText,
    text,
    deliveryCharge: null,
  });

  return NextResponse.json({ chat }, created ? { status: 201 } : undefined);
}
