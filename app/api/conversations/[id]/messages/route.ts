import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const MAX_MESSAGE_LENGTH = 2000;

async function resolveParticipant(conversationId: string) {
  const session = await getSession();

  if (!session || (session.role !== 'CUSTOMER' && session.role !== 'SELLER')) {
    return { error: NextResponse.json({ error: 'Please log in to view messages.' }, { status: 401 }) } as const;
  }

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });

  if (!conversation) {
    return { error: NextResponse.json({ error: 'Conversation not found.' }, { status: 404 }) } as const;
  }

  if (session.role === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({ where: { userId: session.userId } });
    if (!customer || customer.id !== conversation.customerId) {
      return { error: NextResponse.json({ error: 'Not authorized.' }, { status: 403 }) } as const;
    }
    return { conversation, role: 'CUSTOMER' as const };
  }

  const seller = await prisma.seller.findUnique({ where: { userId: session.userId } });
  if (!seller || seller.id !== conversation.sellerId) {
    return { error: NextResponse.json({ error: 'Not authorized.' }, { status: 403 }) } as const;
  }
  return { conversation, role: 'SELLER' as const };
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

  // Mark anything from the other side as read now that this participant has fetched it.
  await prisma.message.updateMany({
    where: { conversationId: id, senderRole: role === 'CUSTOMER' ? 'SELLER' : 'CUSTOMER', isRead: false },
    data: { isRead: true },
  });

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
