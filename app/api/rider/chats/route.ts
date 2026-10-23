import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RIDER_CHAT_INCLUDE, serializeRiderChat } from '@/lib/rider-chat';
import { chatDispatchPoint, getOnlineRiders, ridersForLocation } from '@/lib/rider-dispatch';
import { riderChatMessagePreview } from '@/lib/rider-chat-types';
import { riderHold } from '@/lib/rider-wallet-config';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'RIDER') return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const rider = await prisma.rider.findUnique({
    where: { userId: session.userId },
    select: { id: true, isApproved: true, walletBalance: true, unpaidOrders: true, orderAccess: true, paymentHold: true },
  });
  if (!rider) return NextResponse.json({ error: 'Rider account not found.' }, { status: 404 });
  const wallet = { balance: rider.walletBalance, unpaidOrders: rider.unpaidOrders, hold: riderHold(rider) };
  if (!rider.isApproved) return NextResponse.json({ requests: [], chats: [], wallet });

  const [online, open, active] = await Promise.all([
    getOnlineRiders(),
    prisma.riderChat.findMany({ where: { status: 'OPEN' }, include: { ...RIDER_CHAT_INCLUDE, messages: { orderBy: { createdAt: 'desc' }, take: 1 } } }),
    prisma.riderChat.findMany({ where: { riderId: rider.id, status: 'ACTIVE' }, include: { ...RIDER_CHAT_INCLUDE, messages: { orderBy: { createdAt: 'desc' }, take: 1 } } }),
  ]);
  const requests = open.flatMap((chat) => {
    const location = chatDispatchPoint(chat);
    const target = ridersForLocation(location, online).find((candidate) => candidate.id === rider.id);
    return target ? [{ ...serializeRiderChat(chat), distanceKm: target.distanceKm, lastMessage: chat.messages[0] ? riderChatMessagePreview(chat.messages[0]) : null }] : [];
  });
  const chats = active.map((chat) => ({
    ...serializeRiderChat(chat),
    lastMessage: chat.messages[0] ? riderChatMessagePreview(chat.messages[0]) : null,
    lastMessageFrom: chat.messages[0]?.senderRole ?? null,
  }));
  return NextResponse.json({ requests, chats, wallet });
}
