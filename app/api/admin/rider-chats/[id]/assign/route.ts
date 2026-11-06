import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { chatDispatchPoint } from '@/lib/rider-dispatch';
import { NextRequest, NextResponse } from 'next/server';
import { assignRiderToChat, listAssignableRiders } from '@/lib/area-managers';
import { notifyAfterResponse } from '@/lib/notify';
import { enforceRateLimits } from '@/lib/rate-limit';

/**
 * The manager gives an order of their area to a rider (or moves it to another rider). The server checks the rider again:
 * approved, online and not on hold, so a rider who owes Mangwaoo for too many finished orders gets nothing new from the
 * manager either. The customer and the rider are told.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (session?.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  const { id } = await params;

  const limited = await enforceRateLimits([{ scope: 'asm-assign', subject: session.userId, limit: 300, windowSeconds: 3600 }]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const riderId = typeof body?.riderId === 'string' ? body.riderId : '';

  if (!riderId) {
    return NextResponse.json({ error: 'Please pick a rider first.' }, { status: 400 });
  }

  const outcome = await assignRiderToChat({ chatId: id, riderId });

  switch (outcome.kind) {
    case 'missing':
    case 'not-managed':
      return NextResponse.json({ error: 'This order is no longer available.' }, { status: 404 });
    case 'closed':
      return NextResponse.json({ error: 'This order is already finished.' }, { status: 409 });
    case 'same-rider':
      return NextResponse.json({ error: 'That rider already has this order.' }, { status: 409 });
    case 'rider-unavailable':
      return NextResponse.json({ error: outcome.error }, { status: 409 });
  }

  const { riderUserId, riderName, customerUserId, customerName, previousRiderUserId } = outcome;

  notifyAfterResponse(async () => [
    {
      userId: riderUserId,
      type: 'ORDER' as const,
      title: 'New order assigned to you',
      message: `${customerName} - pickup: ${(outcome.pickupText ?? outcome.addressText).slice(0, 80)}. Open the chat to start.`,
      href: '/rider/chats',
      refId: `assigned:${id}`,
    },
    {
      userId: customerUserId,
      type: 'ORDER' as const,
      title: previousRiderUserId ? 'Your rider was changed' : 'A rider is on your order',
      message: `${riderName} will deliver your order. You can chat with them in your order chat.`,
      href: `/finding-rider/${id}`,
      refId: `rider-assigned:${id}`,
    },
    ...(previousRiderUserId
      ? [
          {
            userId: previousRiderUserId,
            type: 'ORDER' as const,
            title: 'Order moved to another rider',
            message: `The order of ${customerName} was given to another rider by the area manager.`,
            href: null,
            refId: `moved:${id}`,
          },
        ]
      : []),
  ]);

  return NextResponse.json({ ok: true, chat: { id, status: 'ACTIVE', riderName } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await getSession())?.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  const { id } = await params;
  const chat = await prisma.riderChat.findUnique({ where: { id } });
  if (!chat) return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });
  return NextResponse.json({ riders: await listAssignableRiders(chatDispatchPoint(chat)) }, { headers: { 'Cache-Control': 'no-store' } });
}
