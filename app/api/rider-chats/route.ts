import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ADMIN_PAGES } from '@/lib/notification-types';
import { notifyAdminsAfterResponse } from '@/lib/notify';
import {
  MAX_RIDER_CHAT_MESSAGE_LENGTH,
  RIDER_CHAT_INCLUDE,
  getRiderChatSummary,
  serializeRiderChat,
} from '@/lib/rider-chat';

const MAX_ADDRESS_LENGTH = 300;

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

  return NextResponse.json({ chat: chat ? serializeRiderChat(chat) : null });
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

  const existing = await prisma.riderChat.findFirst({
    where: { customerId: customer.id, status: { in: ['OPEN', 'ACTIVE'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  const messageData = { senderRole: 'CUSTOMER' as const, senderName: customer.user.name, body: text };

  // One live order chat per customer — a second "start" just continues it.
  if (existing) {
    await Promise.all([
      prisma.riderChatMessage.create({ data: { chatId: existing.id, ...messageData } }),
      prisma.riderChat.update({ where: { id: existing.id }, data: { updatedAt: new Date() }, select: { id: true } }),
    ]);
    return NextResponse.json({ chat: await getRiderChatSummary(existing.id) });
  }

  // New chat: two sequential inserts (the DB is remote, so no extra re-read —
  // the summary is built from what we already know).
  const chat = await prisma.riderChat.create({
    data: {
      customerId: customer.id,
      latitude: lat,
      longitude: lng,
      addressText: addressText.slice(0, MAX_ADDRESS_LENGTH),
      pickupLatitude: hasPickupCoordinates ? pickupLat : null,
      pickupLongitude: hasPickupCoordinates ? pickupLng : null,
      pickupText,
    },
  });
  await prisma.riderChatMessage.create({ data: { chatId: chat.id, ...messageData } });

  notifyAdminsAfterResponse(async () => ({
    type: 'MESSAGE' as const,
    title: 'New order chat',
    message: `${customer.user.name} is waiting for a rider - ${pickupText.slice(0, 60)}.`,
    href: ADMIN_PAGES.chats,
    refId: `chat:${chat.id}`,
  }));

  return NextResponse.json(
    { chat: serializeRiderChat({ ...chat, customer: { user: { name: customer.user.name, phone: null } }, rider: null }) },
    { status: 201 }
  );
}
