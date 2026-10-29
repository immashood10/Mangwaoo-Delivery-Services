import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyAfterResponse } from '@/lib/notify';
import { enforceRateLimits } from '@/lib/rate-limit';
import { parseSupportBody, previewOf } from '@/lib/support';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'RIDER') return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const threads = await prisma.areaManagerRiderThread.findMany({ where: { riderUserId: session.userId, manager: { isActive: true, deletedAt: null, areaManager: { isNot: null } } }, orderBy: { updatedAt: 'desc' }, take: 30, include: { manager: { select: { name: true, areaManager: { select: { areaId: true } } } }, messages: { orderBy: { createdAt: 'desc' }, take: 100 } } });
  const payload = threads.map((thread) => ({
    id: thread.id,
    managerName: thread.manager.name,
    areaId: thread.manager.areaManager?.areaId ?? null,
    messages: thread.messages.reverse().map((message) => ({ id: message.id, body: message.body, fromManager: message.senderUserId === thread.managerUserId, createdAt: message.createdAt.toISOString() })),
  }));
  await prisma.areaManagerRiderMessage.updateMany({ where: { thread: { riderUserId: session.userId }, senderUserId: { not: session.userId }, isRead: false }, data: { isRead: true } });
  return NextResponse.json({ threads: payload }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'RIDER') return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const threadId = typeof body?.threadId === 'string' ? body.threadId : '';
  const parsed = parseSupportBody(body);
  if (!threadId) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const thread = await prisma.areaManagerRiderThread.findFirst({ where: { id: threadId, riderUserId: session.userId, manager: { isActive: true, deletedAt: null, areaManager: { isNot: null } } }, select: { id: true, managerUserId: true } });
  if (!thread) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  const limited = await enforceRateLimits([{ scope: 'rider-manager-message', subject: thread.id, limit: 60, windowSeconds: 600 }]);
  if (limited) return limited;
  const message = await prisma.areaManagerRiderMessage.create({ data: { threadId: thread.id, senderUserId: session.userId, body: parsed.text } });
  await prisma.areaManagerRiderThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
  notifyAfterResponse(async () => ({ userId: thread.managerUserId, type: 'MESSAGE', title: 'Message from a rider', message: previewOf(parsed.text), href: '/asm/riders', refId: `asm-rider:${thread.id}` }));
  return NextResponse.json({ message: { id: message.id, body: message.body, fromManager: false, createdAt: message.createdAt.toISOString() } }, { status: 201 });
}
