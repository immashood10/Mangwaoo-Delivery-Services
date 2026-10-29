import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireManager } from '@/lib/area-managers';
import { notifyAfterResponse } from '@/lib/notify';
import { enforceRateLimits } from '@/lib/rate-limit';
import { parseSupportBody, previewOf } from '@/lib/support';

export async function GET(request: NextRequest) {
  const auth = await requireManager();
  if ('error' in auth) return auth.error;
  const riderId = request.nextUrl.searchParams.get('riderId') ?? '';
  const rider = await prisma.rider.findFirst({ where: { id: riderId, isApproved: true, user: { isActive: true, deletedAt: null } }, select: { userId: true, user: { select: { name: true } } } });
  if (!rider) return NextResponse.json({ error: 'Rider not found.' }, { status: 404 });

  const thread = await prisma.areaManagerRiderThread.upsert({
    where: { managerUserId_riderUserId: { managerUserId: auth.manager.userId, riderUserId: rider.userId } },
    create: { managerUserId: auth.manager.userId, riderUserId: rider.userId },
    update: {},
    select: { id: true },
  });
  const messages = await prisma.areaManagerRiderMessage.findMany({ where: { threadId: thread.id }, orderBy: { createdAt: 'desc' }, take: 100 });
  await prisma.areaManagerRiderMessage.updateMany({ where: { threadId: thread.id, senderUserId: rider.userId, isRead: false }, data: { isRead: true } });
  return NextResponse.json({ threadId: thread.id, rider: { name: rider.user.name }, messages: messages.reverse().map((message) => ({ id: message.id, body: message.body, fromManager: message.senderUserId === auth.manager.userId, createdAt: message.createdAt.toISOString() })) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const auth = await requireManager();
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => null);
  const riderId = typeof body?.riderId === 'string' ? body.riderId : '';
  const parsed = parseSupportBody(body);
  if (!riderId) return NextResponse.json({ error: 'Rider not found.' }, { status: 404 });
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const rider = await prisma.rider.findFirst({ where: { id: riderId, isApproved: true, user: { isActive: true, deletedAt: null } }, select: { userId: true, user: { select: { name: true } } } });
  if (!rider) return NextResponse.json({ error: 'Rider not found.' }, { status: 404 });
  const limited = await enforceRateLimits([{ scope: 'asm-rider-message', subject: auth.manager.userId, limit: 60, windowSeconds: 600 }]);
  if (limited) return limited;

  const thread = await prisma.areaManagerRiderThread.upsert({
    where: { managerUserId_riderUserId: { managerUserId: auth.manager.userId, riderUserId: rider.userId } },
    create: { managerUserId: auth.manager.userId, riderUserId: rider.userId },
    update: { updatedAt: new Date() },
    select: { id: true },
  });
  const message = await prisma.areaManagerRiderMessage.create({ data: { threadId: thread.id, senderUserId: auth.manager.userId, body: parsed.text } });
  await prisma.areaManagerRiderThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
  notifyAfterResponse(async () => ({ userId: rider.userId, type: 'MESSAGE', title: 'Message from your area manager', message: previewOf(parsed.text), href: '/rider/messages', refId: `asm-rider:${thread.id}` }));
  return NextResponse.json({ message: { id: message.id, body: message.body, fromManager: true, createdAt: message.createdAt.toISOString() } }, { status: 201 });
}
