import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { previewOf } from '@/lib/support';
import type { AdminConversationSummary } from '@/lib/support-types';

const MAX_RESULTS = 100;

// Every customer-seller chat, newest activity first, so the admin can read it and step in.
export async function GET(request: NextRequest) {
  const session = await getSession();

  if (session?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  }

  const term = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80);
  const contains = { contains: term, mode: 'insensitive' as const };

  const conversations = await prisma.conversation.findMany({
    where: term
      ? { OR: [{ customer: { user: { name: contains } } }, { seller: { businessName: contains } }, { productName: contains }] }
      : {},
    orderBy: { updatedAt: 'desc' },
    take: MAX_RESULTS,
    select: {
      id: true,
      productName: true,
      updatedAt: true,
      customer: { select: { user: { select: { name: true } } } },
      seller: { select: { businessName: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, senderRole: true } },
    },
  });

  const summaries: AdminConversationSummary[] = conversations
    .filter((conversation) => conversation.messages.length > 0)
    .map((conversation) => ({
      id: conversation.id,
      customerName: conversation.customer.user.name,
      sellerName: conversation.seller.businessName,
      productName: conversation.productName,
      lastMessage: previewOf(conversation.messages[0].body),
      lastSenderRole: conversation.messages[0].senderRole,
      updatedAt: conversation.updatedAt.toISOString(),
    }));

  return NextResponse.json({ conversations: summaries }, { headers: { 'Cache-Control': 'no-store' } });
}
