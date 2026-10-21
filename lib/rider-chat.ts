import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { chatDispatchPoint, isRiderEligibleForChat } from '@/lib/rider-dispatch';
import type { RiderChat, RiderChatMessage } from '@/lib/generated/prisma/client';
import {
  ALLOWED_CHAT_IMAGE_TYPES,
  ALLOWED_CHAT_VOICE_TYPES,
  MAX_CHAT_IMAGE_BYTES,
  MAX_CHAT_VOICE_BYTES,
  MAX_CHAT_VOICE_SECONDS,
  MAX_RIDER_CHAT_MESSAGE_LENGTH,
} from '@/lib/rider-chat-types';

export { MAX_RIDER_CHAT_MESSAGE_LENGTH };
export const SUPPORT_SENDER_NAME = 'Mangwaoo Support';

type ChatWithPeople = RiderChat & {
  customer: { user: { name: string; phone: string | null } };
  rider: { user: { name: string; phone: string | null } } | null;
};

export const RIDER_CHAT_INCLUDE = {
  customer: { include: { user: { select: { name: true, phone: true } } } },
  rider: { include: { user: { select: { name: true, phone: true } } } },
} as const;

export function serializeRiderChat(chat: ChatWithPeople) {
  return {
    id: chat.id,
    status: chat.status,
    addressText: chat.addressText,
    lat: chat.latitude,
    lng: chat.longitude,
    pickupText: chat.pickupText,
    pickupLat: chat.pickupLatitude,
    pickupLng: chat.pickupLongitude,
    customerName: chat.customer.user.name,
    riderName: chat.rider?.user.name ?? null,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  };
}

export function serializeRiderChatMessage(message: RiderChatMessage) {
  return {
    id: message.id,
    type: message.type,
    senderRole: message.senderRole,
    senderName: message.senderName,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    lat: message.latitude,
    lng: message.longitude,
    durationSec: message.durationSec,
    attachmentUrl: message.attachmentId
      ? `/api/rider-chats/${message.chatId}/attachments/${message.attachmentId}`
      : null,
  };
}

export type IncomingRiderChatMessage =
  | { type: 'TEXT'; body: string }
  | { type: 'LOCATION'; body: string; latitude: number; longitude: number }
  | { type: 'IMAGE' | 'VOICE'; body: string; durationSec: number | null; file: { mimeType: string; data: Uint8Array<ArrayBuffer> } };

/**
 * Parses a new chat message from either JSON (text / location) or
 * multipart form data (image / voice upload), validating type, size and length.
 */
export async function parseIncomingRiderChatMessage(
  request: Request
): Promise<{ message: IncomingRiderChatMessage } | { error: string }> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.startsWith('multipart/form-data')) {
    const form = await request.formData().catch(() => null);
    const type = form?.get('type');
    const file = form?.get('file');

    if ((type !== 'IMAGE' && type !== 'VOICE') || !(file instanceof File)) {
      return { error: 'Please attach a photo or voice message.' };
    }

    const mimeType = file.type.split(';')[0].trim().toLowerCase();
    const isImage = type === 'IMAGE';
    const allowed = isImage ? ALLOWED_CHAT_IMAGE_TYPES : ALLOWED_CHAT_VOICE_TYPES;
    const maxBytes = isImage ? MAX_CHAT_IMAGE_BYTES : MAX_CHAT_VOICE_BYTES;

    if (!allowed.includes(mimeType)) {
      return { error: isImage ? 'Only JPG, PNG or WebP photos can be sent.' : 'This voice format is not supported.' };
    }

    if (file.size === 0 || file.size > maxBytes) {
      return { error: `File is too large. The limit is ${Math.round(maxBytes / (1024 * 1024))} MB.` };
    }

    const caption = String(form?.get('body') ?? '').trim().slice(0, MAX_RIDER_CHAT_MESSAGE_LENGTH);
    const rawDuration = Number(form?.get('durationSec'));
    const durationSec =
      !isImage && Number.isFinite(rawDuration) && rawDuration > 0
        ? Math.min(MAX_CHAT_VOICE_SECONDS, Math.round(rawDuration))
        : null;

    return {
      message: {
        type,
        body: caption,
        durationSec,
        file: { mimeType, data: new Uint8Array(await file.arrayBuffer()) },
      },
    };
  }

  const body = await request.json().catch(() => null);

  if (body?.type === 'LOCATION') {
    const latitude = typeof body.lat === 'number' ? body.lat : NaN;
    const longitude = typeof body.lng === 'number' ? body.lng : NaN;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return { error: 'Could not read that location.' };
    }

    return { message: { type: 'LOCATION', body: 'Shared a location', latitude, longitude } };
  }

  const text = typeof body?.body === 'string' ? body.body.trim() : '';

  if (!text) {
    return { error: 'Message cannot be empty.' };
  }

  if (text.length > MAX_RIDER_CHAT_MESSAGE_LENGTH) {
    return { error: 'Message is too long.' };
  }

  return { message: { type: 'TEXT', body: text } };
}

/** Just the columns access checks need — no relations, so it's a single query. */
const CHAT_ACCESS_SELECT = {
  id: true,
  status: true,
  riderId: true,
  customerId: true,
  latitude: true,
  longitude: true,
  pickupLatitude: true,
  pickupLongitude: true,
} as const;

export type RiderChatCore = {
  id: string;
  status: RiderChat['status'];
  riderId: string | null;
  customerId: string;
  latitude: number;
  longitude: number;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
};

type ChatAccess =
  | { error: NextResponse }
  | {
      chat: RiderChatCore;
      role: 'CUSTOMER' | 'RIDER' | 'ADMIN';
      senderName: string;
      /** Set for a rider who is viewing/claiming an OPEN chat. */
      riderId?: string;
    };

function deny(message: string, status: number): ChatAccess {
  return { error: NextResponse.json({ error: message }, { status }) };
}

/** Full chat summary (customer + rider names) for responses that render chat headers. */
export async function getRiderChatSummary(chatId: string) {
  const chat = await prisma.riderChat.findUnique({ where: { id: chatId }, include: RIDER_CHAT_INCLUDE });
  return chat ? serializeRiderChat(chat) : null;
}

/**
 * Who may read/write a rider chat: the customer who opened it, the rider who
 * claimed it, any nearby online rider while it is still OPEN, and admins.
 *
 * The DB is remote (~300 ms per round trip), so the chat row and the caller's
 * identity are looked up in parallel and without relation includes.
 */
export async function resolveRiderChatAccess(chatId: string): Promise<ChatAccess> {
  const session = await getSession();

  if (!session) {
    return deny('Please log in to view this chat.', 401);
  }

  const identityPromise =
    session.role === 'CUSTOMER'
      ? prisma.user.findUnique({
          where: { id: session.userId },
          select: { name: true, customer: { select: { id: true } } },
        })
      : session.role === 'RIDER'
        ? prisma.user.findUnique({
            where: { id: session.userId },
            select: { name: true, rider: { select: { id: true, isApproved: true } } },
          })
        : Promise.resolve(null);

  const [chat, identity] = await Promise.all([
    prisma.riderChat.findUnique({ where: { id: chatId }, select: CHAT_ACCESS_SELECT }),
    identityPromise,
  ]);

  if (!chat) {
    return deny('Chat not found.', 404);
  }

  if (session.role === 'ADMIN') {
    return { chat, role: 'ADMIN', senderName: SUPPORT_SENDER_NAME };
  }

  if (session.role === 'CUSTOMER') {
    const customerId = identity && 'customer' in identity ? identity.customer?.id : undefined;

    if (!identity || !customerId || customerId !== chat.customerId) {
      return deny('Not authorized.', 403);
    }

    return { chat, role: 'CUSTOMER', senderName: identity.name };
  }

  if (session.role === 'RIDER') {
    const rider = identity && 'rider' in identity ? identity.rider : null;

    if (!identity || !rider || !rider.isApproved) {
      return deny('Your rider account is not approved yet.', 403);
    }

    if (chat.riderId === rider.id) {
      return { chat, role: 'RIDER', senderName: identity.name, riderId: rider.id };
    }

    if (chat.status === 'OPEN' && !chat.riderId) {
      const isEligible = await isRiderEligibleForChat(rider.id, chatDispatchPoint(chat));

      if (isEligible) {
        return { chat, role: 'RIDER', senderName: identity.name, riderId: rider.id };
      }
    }

    return deny(
      chat.riderId ? 'Another rider has already taken this order.' : 'This order is not near you.',
      403
    );
  }

  return deny('Not authorized.', 403);
}
