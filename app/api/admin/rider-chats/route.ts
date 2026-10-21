import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { RIDER_CHAT_INCLUDE, serializeRiderChat } from '@/lib/rider-chat';
import { riderChatMessagePreview } from '@/lib/rider-chat-types';

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

  return NextResponse.json({
    chats: chats.map((chat) => ({
      ...serializeRiderChat(chat),
      lastMessage: chat.messages[0] ? riderChatMessagePreview(chat.messages[0]) : null,
      lastMessageFrom: chat.messages[0]?.senderRole ?? null,
    })),
  });
}
