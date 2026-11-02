import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { RIDER_CHAT_INCLUDE, serializeRiderChat } from '@/lib/rider-chat';
import { riderChatMessagePreview } from '@/lib/rider-chat-types';
import { orderRef } from '@/lib/order-number';

const ADMIN_CHAT_LIMIT = 100;

export async function GET() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const chats = await prisma.riderChat.findMany({
    orderBy: { updatedAt: 'desc' },
    take: ADMIN_CHAT_LIMIT,
    include: {
      ...RIDER_CHAT_INCLUDE,
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const chatIds = chats.map((chat) => chat.id);
  const [martOrders, foodOrders] = chatIds.length
    ? await Promise.all([
        prisma.order.findMany({
          where: { riderChatId: { in: chatIds } },
          select: { riderChatId: true, orderNumber: true },
        }),
        prisma.gulplazaOrder.findMany({
          where: { riderChatId: { in: chatIds } },
          select: { riderChatId: true, orderNumber: true },
        }),
      ])
    : [[], []];
  const orderRefsByChat = new Map<string, string[]>();

  for (const order of martOrders) {
    if (!order.riderChatId) continue;

    const refs = orderRefsByChat.get(order.riderChatId) ?? [];
    refs.push(orderRef('mart', order.orderNumber));
    orderRefsByChat.set(order.riderChatId, refs);
  }

  for (const order of foodOrders) {
    if (!order.riderChatId) continue;

    const refs = orderRefsByChat.get(order.riderChatId) ?? [];
    refs.push(orderRef('gulplaza', order.orderNumber));
    orderRefsByChat.set(order.riderChatId, refs);
  }

  return NextResponse.json({
    chats: chats.map((chat) => ({
      ...serializeRiderChat(chat),
      orderRefs: orderRefsByChat.get(chat.id) ?? [],
      lastMessage: chat.messages[0] ? riderChatMessagePreview(chat.messages[0]) : null,
      lastMessageFrom: chat.messages[0]?.senderRole ?? null,
    })),
  });
}
