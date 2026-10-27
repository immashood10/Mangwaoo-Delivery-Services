import { prisma } from '@/lib/prisma';
import { ADMIN_PAGES } from '@/lib/notification-types';
import { notifyAdminsAfterResponse } from '@/lib/notify';
import { getRiderChatSummary, serializeRiderChat } from '@/lib/rider-chat';

export const MAX_ORDER_CHAT_ADDRESS_LENGTH = 300;

/**
 * Opens the customer's order chat with their first message, or, when they already have a live one (OPEN or ACTIVE),
 * adds the message to it: there is one live order chat per customer.
 *
 * `deliveryCharge` is only for a chat opened by a checkout: the delivery fee the SERVER charged (whole PKR, 0 when the
 * order has none), which is what the rider's commission is later worked out from. A second checkout joining a live chat
 * adds its fee to the chat's. null (a chat that is not from a checkout) leaves the charge alone.
 */
export async function startOrContinueOrderChat(input: {
  customer: { id: string; name: string };
  lat: number;
  lng: number;
  addressText: string;
  pickup: { lat: number; lng: number } | null;
  pickupText: string;
  text: string;
  deliveryCharge: number | null;
}) {
  const { customer, deliveryCharge } = input;
  const messageData = { senderRole: 'CUSTOMER' as const, senderName: customer.name, body: input.text };

  const existing = await prisma.riderChat.findFirst({
    where: { customerId: customer.id, status: { in: ['OPEN', 'ACTIVE'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, deliveryCharge: true },
  });

  if (existing) {
    await Promise.all([
      prisma.riderChatMessage.create({ data: { chatId: existing.id, ...messageData } }),
      prisma.riderChat.update({
        where: { id: existing.id },
        data: {
          updatedAt: new Date(),
          ...(deliveryCharge !== null ? { deliveryCharge: (existing.deliveryCharge ?? 0) + deliveryCharge } : {}),
        },
        select: { id: true },
      }),
    ]);

    return { chat: await getRiderChatSummary(existing.id), created: false };
  }

  // New chat: two sequential inserts (the DB is remote, so no extra re-read — the summary is built from what we already know).
  const chat = await prisma.riderChat.create({
    data: {
      customerId: customer.id,
      latitude: input.lat,
      longitude: input.lng,
      addressText: input.addressText.slice(0, MAX_ORDER_CHAT_ADDRESS_LENGTH),
      pickupLatitude: input.pickup?.lat ?? null,
      pickupLongitude: input.pickup?.lng ?? null,
      pickupText: input.pickupText,
      deliveryCharge,
    },
  });
  await prisma.riderChatMessage.create({ data: { chatId: chat.id, ...messageData } });

  notifyAdminsAfterResponse(async () => ({
    type: 'MESSAGE' as const,
    title: 'New order chat',
    message: `${customer.name} is waiting for a rider - ${input.pickupText.slice(0, 60)}.`,
    href: ADMIN_PAGES.chats,
    refId: `chat:${chat.id}`,
  }));

  return {
    chat: serializeRiderChat({ ...chat, customer: { user: { name: customer.name, phone: null } }, rider: null }),
    created: true,
  };
}
