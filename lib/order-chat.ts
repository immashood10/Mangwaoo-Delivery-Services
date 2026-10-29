import { prisma } from '@/lib/prisma';
import { managedAreaFor, notifyAreaManagers } from '@/lib/area-managers';
import { billedDistanceKm } from '@/lib/delivery';
import { distanceInKm } from '@/lib/geo';
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
 *
 * `distanceKm` is how far the ride is (judged to 0.1 km), which the rider's delivery bonus follows: a checkout passes the longest
 * restaurant → customer distance of its food orders (null = it has none, MangwaooMart only). Left out, a chat with a pickup
 * point is judged pickup → drop-off. A second checkout joining a live chat can only make the remembered distance longer.
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
  distanceKm?: number | null;
  /**
   * The customer typed this order in the Chat window (not a checkout): when their area has an Area Sales Manager the chat
   * goes to that manager, who picks the rider, instead of to the first rider who replies. Only a NEW chat is routed; one that
   * is already live keeps the way it started.
   */
  viaManager?: boolean;
}) {
  const { customer, deliveryCharge } = input;
  const messageData = { senderRole: 'CUSTOMER' as const, senderName: customer.name, body: input.text };
  const distanceKm =
    input.distanceKm !== undefined
      ? input.distanceKm
      : input.pickup
        ? billedDistanceKm(distanceInKm(input.pickup, { lat: input.lat, lng: input.lng }))
        : null;

  const existing = await prisma.riderChat.findFirst({
    where: { customerId: customer.id, status: { in: ['OPEN', 'ACTIVE'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, deliveryCharge: true, deliveryDistanceKm: true },
  });

  if (existing) {
    await Promise.all([
      prisma.riderChatMessage.create({ data: { chatId: existing.id, ...messageData } }),
      prisma.riderChat.update({
        where: { id: existing.id },
        data: {
          updatedAt: new Date(),
          ...(deliveryCharge !== null ? { deliveryCharge: (existing.deliveryCharge ?? 0) + deliveryCharge } : {}),
          ...(distanceKm !== null && distanceKm > (existing.deliveryDistanceKm ?? -1) ? { deliveryDistanceKm: distanceKm } : {}),
        },
        select: { id: true },
      }),
    ]);

    return { chat: await getRiderChatSummary(existing.id), created: false };
  }

  // New chat: two sequential inserts (the DB is remote, so no extra re-read — the summary is built from what we already know).
  // The manager of the customer's area (if there is one) is found first: that is the chat's `areaId`.
  const areaId = input.viaManager ? await managedAreaFor({ lat: input.lat, lng: input.lng }) : null;
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
      deliveryDistanceKm: distanceKm,
      areaId,
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

  if (areaId !== null) {
    notifyAreaManagers(areaId, {
      title: 'New order waiting for a rider',
      message: `${customer.name} sent an order - pickup: ${input.pickupText.slice(0, 60)}. Pick a rider for it.`,
      refId: `asm-chat:${chat.id}`,
    });
  }

  return {
    chat: serializeRiderChat({ ...chat, customer: { user: { name: customer.name, phone: null } }, rider: null }),
    created: true,
  };
}
