import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { notifyAfterResponse } from '@/lib/notify';
import { SELLER_PAGES } from '@/lib/notification-types';
import { SUPPORT_NAME } from '@/lib/support-types';

const MAX_MESSAGE_LENGTH = 2000;
const PREVIEW_LENGTH = 90;

type Participant = 'CUSTOMER' | 'SELLER' | 'ADMIN';

async function resolveParticipant(conversationId: string) {
  const session = await getSession();

  if (!session || (session.role !== 'CUSTOMER' && session.role !== 'SELLER' && session.role !== 'ADMIN')) {
    return { error: NextResponse.json({ error: 'Please log in to view messages.' }, { status: 401 }) } as const;
  }

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });

  if (!conversation) {
    return { error: NextResponse.json({ error: 'Conversation not found.' }, { status: 404 }) } as const;
  }

  // An admin can read every chat and write in it (shown to both sides as "Mangwaoo Support").
  if (session.role === 'ADMIN') {
    return { conversation, role: 'ADMIN' as Participant };
  }

  if (session.role === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({ where: { userId: session.userId } });
    if (!customer || customer.id !== conversation.customerId) {
      return { error: NextResponse.json({ error: 'Not authorized.' }, { status: 403 }) } as const;
    }
    return { conversation, role: 'CUSTOMER' as Participant };
  }

  const seller = await prisma.seller.findUnique({ where: { userId: session.userId } });
  if (!seller || seller.id !== conversation.sellerId) {
    return { error: NextResponse.json({ error: 'Not authorized.' }, { status: 403 }) } as const;
  }
  return { conversation, role: 'SELLER' as Participant };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await resolveParticipant(id);
  if ('error' in resolved) return resolved.error;
  const { role } = resolved;

  const since = request.nextUrl.searchParams.get('since');

  const messages = await prisma.message.findMany({
    where: {
      conversationId: id,
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });

  // Mark anything from the other side (including a Mangwaoo Support message) as read now that this participant
  // has fetched it. An admin only looking in does not mark anything as read.
  if (role !== 'ADMIN') {
    await prisma.message.updateMany({
      where: {
        conversationId: id,
        senderRole: { in: role === 'CUSTOMER' ? ['SELLER', 'ADMIN'] : ['CUSTOMER', 'ADMIN'] },
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  return NextResponse.json({
    messages: messages.map((message) => ({
      id: message.id,
      senderRole: message.senderRole,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await resolveParticipant(id);
  if ('error' in resolved) return resolved.error;
  const { role } = resolved;

  const body = await request.json().catch(() => null);
  const text = typeof body?.body === 'string' ? body.body.trim() : '';

  if (!text) {
    return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: 'Message is too long.' }, { status: 400 });
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId: id, senderRole: role, body: text },
    }),
    prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } }),
  ]);

  // A customer's (or an admin's) message is a notification for the seller (one per chat until they've seen it).
  if (role === 'CUSTOMER' || role === 'ADMIN') {
    notifyAfterResponse(async () => {
      const chat = await prisma.conversation.findUnique({
        where: { id },
        select: {
          seller: { select: { userId: true } },
          customer: { select: { user: { select: { name: true } } } },
        },
      });
      if (!chat) return null;

      return {
        userId: chat.seller.userId,
        type: 'MESSAGE' as const,
        title: role === 'ADMIN' ? `New message from ${SUPPORT_NAME}` : `New message from ${chat.customer.user.name}`,
        message: text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text,
        href: SELLER_PAGES.messages,
        refId: `msg:${id}`,
      };
    });
  }

  return NextResponse.json(
    {
      message: {
        id: message.id,
        senderRole: message.senderRole,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
