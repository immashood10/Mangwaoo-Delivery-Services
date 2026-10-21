import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { notifyAfterResponse } from '@/lib/notify';
import { SELLER_PAGES } from '@/lib/notification-types';
import { prisma } from '@/lib/prisma';
import { parseSupportBody, previewOf, toSupportMessageView } from '@/lib/support';
import { SUPPORT_NAME } from '@/lib/support-types';

async function loadThread(id: string) {
  const session = await getSession();

  if (session?.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Admin access required.' }, { status: 401 }) } as const;
  }

  const thread = await prisma.supportThread.findFirst({
    where: { id, user: { deletedAt: null } },
    select: { id: true, userId: true, user: { select: { role: true } } },
  });

  if (!thread) {
    return { error: NextResponse.json({ error: 'Conversation not found.' }, { status: 404 }) } as const;
  }

  return { thread } as const;
}

// The admin reads a thread (opening it marks the seller's/rider's messages as read).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadThread(id);
  if ('error' in loaded) return loaded.error;

  const since = request.nextUrl.searchParams.get('since');

  const messages = await prisma.supportMessage.findMany({
    where: { threadId: id, ...(since ? { createdAt: { gt: new Date(since) } } : {}) },
    orderBy: { createdAt: 'asc' },
  });

  await prisma.supportMessage.updateMany({ where: { threadId: id, fromAdmin: false, isRead: false }, data: { isRead: true } });

  return NextResponse.json({ messages: messages.map(toSupportMessageView) }, { headers: { 'Cache-Control': 'no-store' } });
}

// The admin writes to the seller/rider. They get a bell notification (sellers) and see it in their Messages.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadThread(id);
  if ('error' in loaded) return loaded.error;
  const { thread } = loaded;

  const parsed = parseSupportBody(await request.json().catch(() => null));
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({ data: { threadId: id, fromAdmin: true, body: parsed.text } }),
    prisma.supportThread.update({ where: { id }, data: { updatedAt: new Date() }, select: { id: true } }),
  ]);

  if (thread.user.role === 'SELLER') {
    notifyAfterResponse(async () => ({
      userId: thread.userId,
      type: 'MESSAGE' as const,
      title: `New message from ${SUPPORT_NAME}`,
      message: previewOf(parsed.text),
      href: SELLER_PAGES.messages,
      refId: `support:${id}`,
    }));
  }

  return NextResponse.json({ message: toSupportMessageView(message) }, { status: 201 });
}
