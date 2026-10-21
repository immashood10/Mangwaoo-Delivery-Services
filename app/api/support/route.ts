import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { notifyAdminsAfterResponse } from '@/lib/notify';
import { ADMIN_PAGES } from '@/lib/notification-types';
import { prisma } from '@/lib/prisma';
import { enforceRateLimits } from '@/lib/rate-limit';
import { parseSupportBody, previewOf, toSupportMessageView } from '@/lib/support';

async function resolveOwnThread() {
  const session = await getSession();

  if (!session || (session.role !== 'SELLER' && session.role !== 'RIDER')) {
    return { error: NextResponse.json({ error: 'Please log in as a seller or rider.' }, { status: 401 }) } as const;
  }

  const thread = await prisma.supportThread.findUnique({
    where: { userId: session.userId },
    select: {
      id: true,
      _count: { select: { messages: true } },
      user: { select: { name: true, role: true, seller: { select: { businessName: true } } } },
    },
  });

  // A thread the admin opened but has not written in yet does not exist for the seller/rider.
  return { session, thread: thread && thread._count.messages > 0 ? thread : null } as const;
}

// A seller's or rider's own chat with Mangwaoo Support. `thread` is null until the admin has written to them.
// Fetching it marks the admin's messages as read.
export async function GET(request: NextRequest) {
  const resolved = await resolveOwnThread();
  if ('error' in resolved) return resolved.error;
  const { thread } = resolved;

  if (!thread) {
    return NextResponse.json({ thread: null, messages: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const since = request.nextUrl.searchParams.get('since');

  const messages = await prisma.supportMessage.findMany({
    where: { threadId: thread.id, ...(since ? { createdAt: { gt: new Date(since) } } : {}) },
    orderBy: { createdAt: 'asc' },
  });

  await prisma.supportMessage.updateMany({ where: { threadId: thread.id, fromAdmin: true, isRead: false }, data: { isRead: true } });

  return NextResponse.json({ thread: { id: thread.id }, messages: messages.map(toSupportMessageView) }, { headers: { 'Cache-Control': 'no-store' } });
}

// The seller/rider answers. They can only answer a thread the admin started.
export async function POST(request: NextRequest) {
  const resolved = await resolveOwnThread();
  if ('error' in resolved) return resolved.error;
  const { thread } = resolved;

  if (!thread) {
    return NextResponse.json({ error: 'Mangwaoo Support has not written to you yet.' }, { status: 404 });
  }

  const limited = await enforceRateLimits([{ scope: 'support-message', subject: thread.id, limit: 60, windowSeconds: 600 }], 'You are sending messages too fast. Please wait a moment.');
  if (limited) return limited;

  const parsed = parseSupportBody(await request.json().catch(() => null));
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({ data: { threadId: thread.id, fromAdmin: false, body: parsed.text } }),
    prisma.supportThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() }, select: { id: true } }),
  ]);

  const who = thread.user.seller?.businessName ?? thread.user.name;
  notifyAdminsAfterResponse(async () => ({
    type: 'MESSAGE' as const,
    title: `Message from ${who}`,
    message: `${thread.user.role === 'RIDER' ? 'Rider' : 'Seller'}: ${previewOf(parsed.text)}`,
    href: ADMIN_PAGES.messages,
    refId: `support:${thread.id}`,
  }));

  return NextResponse.json({ message: toSupportMessageView(message) }, { status: 201 });
}
