import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();

  if (!session || (session.role !== 'CUSTOMER' && session.role !== 'SELLER')) {
    return NextResponse.json({ error: 'Please log in to view messages.' }, { status: 401 });
  }

  if (session.role === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({ where: { userId: session.userId } });
    if (!customer) {
      return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 });
    }

    const conversations = await prisma.conversation.findMany({
      where: { customerId: customer.id },
      include: {
        seller: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const unreadCounts = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        senderRole: { in: ['SELLER', 'ADMIN'] },
        isRead: false,
      },
      _count: true,
    });
    const unreadByConversation = new Map(unreadCounts.map((row) => [row.conversationId, row._count]));

    return NextResponse.json({
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        counterpartName: conversation.seller.businessName,
        productName: conversation.productName,
        lastMessage: conversation.messages[0]?.body ?? null,
        updatedAt: conversation.updatedAt.toISOString(),
        unreadCount: unreadByConversation.get(conversation.id) ?? 0,
      })),
    });
  }

  const seller = await prisma.seller.findUnique({ where: { userId: session.userId } });
  if (!seller) {
    return NextResponse.json({ error: 'Seller account not found.' }, { status: 404 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { sellerId: seller.id },
    include: {
      customer: { include: { user: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const unreadCounts = await prisma.message.groupBy({
    by: ['conversationId'],
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      senderRole: { in: ['CUSTOMER', 'ADMIN'] },
      isRead: false,
    },
    _count: true,
  });
  const unreadByConversation = new Map(unreadCounts.map((row) => [row.conversationId, row._count]));

  return NextResponse.json({
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      counterpartName: conversation.customer.user.name,
      productName: conversation.productName,
      lastMessage: conversation.messages[0]?.body ?? null,
      updatedAt: conversation.updatedAt.toISOString(),
      unreadCount: unreadByConversation.get(conversation.id) ?? 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    return NextResponse.json(
      { error: 'Please log in as a customer to message a seller.', requiresLogin: true },
      { status: 401 }
    );
  }

  const customer = await prisma.customer.findUnique({ where: { userId: session.userId } });
  if (!customer) {
    return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const sellerId = typeof body?.sellerId === 'string' ? body.sellerId : '';
  const productName = typeof body?.productName === 'string' ? body.productName.trim() : undefined;

  if (!sellerId) {
    return NextResponse.json({ error: 'A seller is required to start a conversation.' }, { status: 400 });
  }

  const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
  if (!seller) {
    return NextResponse.json({ error: 'Seller not found.' }, { status: 404 });
  }

  const conversation = await prisma.conversation.upsert({
    where: { customerId_sellerId: { customerId: customer.id, sellerId } },
    create: { customerId: customer.id, sellerId, productName: productName || null },
    update: {},
  });

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      counterpartName: seller.businessName,
      productName: conversation.productName,
    },
  });
}
