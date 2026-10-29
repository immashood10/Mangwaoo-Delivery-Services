import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getRiderChatSummary,
  parseIncomingRiderChatMessage,
  resolveRiderChatAccess,
  serializeRiderChatMessage,
} from '@/lib/rider-chat';
import { chatDispatchPoint, getOnlineRiders, ridersForLocation } from '@/lib/rider-dispatch';
import { enforceRateLimits } from '@/lib/rate-limit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await resolveRiderChatAccess(id);
  if ('error' in access) return access.error;

  const since = request.nextUrl.searchParams.get('since');
  // Riders nearby only matter for an order riders can take; one with an area manager waits for the manager to pick a rider.
  const isOpenToRiders = access.chat.status === 'OPEN' && access.chat.areaId === null;

  const [messages, chat, onlineRiders] = await Promise.all([
    prisma.riderChatMessage.findMany({
      where: {
        chatId: id,
        ...(since ? { createdAt: { gt: new Date(since) } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    }),
    getRiderChatSummary(id),
    isOpenToRiders ? getOnlineRiders() : Promise.resolve([]),
  ]);

  if (!chat) {
    return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });
  }

  // Lets the customer see "N riders nearby" while waiting for someone to pick it up.
  const nearbyRiderCount = isOpenToRiders ? ridersForLocation(chatDispatchPoint(access.chat), onlineRiders).length : 0;

  return NextResponse.json({
    chat: { ...chat, nearbyRiderCount },
    messages: messages.map(serializeRiderChatMessage),
  });
}

/** Sends a text (JSON), location (JSON) or photo/voice (multipart) message. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await resolveRiderChatAccess(id);
  if ('error' in access) return access.error;

  if (access.chat.status === 'CLOSED') {
    return NextResponse.json({ error: 'This chat has ended.' }, { status: 400 });
  }

  const limited = await enforceRateLimits([{ scope: 'rider-chat-message', subject: `${access.role}:${id}`, limit: 120, windowSeconds: 600 }], 'You are sending messages too fast. Please wait a moment.');
  if (limited) return limited;

  const parsed = await parseIncomingRiderChatMessage(request);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const incoming = parsed.message;

  // A nearby rider's first reply claims the chat. The `riderId: null` guard makes
  // this atomic, so if two riders reply at once only one of them gets the order.
  if (access.role === 'RIDER' && !access.chat.riderId) {
    const claimed = await prisma.riderChat.updateMany({
      where: { id, status: 'OPEN', riderId: null },
      data: { riderId: access.riderId, status: 'ACTIVE', claimedAt: new Date() },
    });

    if (claimed.count === 0) {
      return NextResponse.json({ error: 'Another rider has already taken this order.' }, { status: 409 });
    }
  }

  // Kept to as few sequential round trips as possible (the DB is remote):
  // optional attachment insert, then the message insert and the chat's
  // updatedAt bump in parallel. Live clients get chat status changes from
  // the stream, so the response doesn't re-read the chat.
  const attachment =
    incoming.type === 'IMAGE' || incoming.type === 'VOICE'
      ? await prisma.riderChatAttachment.create({
          data: {
            chatId: id,
            mimeType: incoming.file.mimeType,
            size: incoming.file.data.byteLength,
            data: incoming.file.data,
          },
          select: { id: true },
        })
      : null;

  const [message] = await Promise.all([
    prisma.riderChatMessage.create({
      data: {
        chatId: id,
        type: incoming.type,
        senderRole: access.role,
        senderName: access.senderName,
        body: incoming.body,
        latitude: incoming.type === 'LOCATION' ? incoming.latitude : null,
        longitude: incoming.type === 'LOCATION' ? incoming.longitude : null,
        durationSec: incoming.type === 'VOICE' ? incoming.durationSec : null,
        attachmentId: attachment?.id ?? null,
      },
    }),
    prisma.riderChat.update({ where: { id }, data: { updatedAt: new Date() }, select: { id: true } }),
  ]);

  return NextResponse.json({ message: serializeRiderChatMessage(message) }, { status: 201 });
}
