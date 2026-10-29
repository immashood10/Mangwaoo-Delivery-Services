import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireManager } from '@/lib/area-managers';
import { notifyAfterResponse } from '@/lib/notify';
import { enforceRateLimits } from '@/lib/rate-limit';

/** Return an assigned order to the area's waiting list and remove the rider's access to it. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManager();
  if ('error' in auth) return auth.error;
  const { manager } = auth;
  const { id } = await params;

  const limited = await enforceRateLimits([{ scope: 'asm-assign', subject: manager.userId, limit: 300, windowSeconds: 3600 }]);
  if (limited) return limited;

  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ status: string; areaId: number | null; riderId: string | null }[]>`
      SELECT "status"::text AS "status", "areaId", "riderId" FROM "RiderChat" WHERE "id" = ${id} FOR UPDATE`;
    const row = rows[0];
    if (!row || row.areaId !== manager.areaId) return { kind: 'missing' as const };
    if (row.status !== 'ACTIVE' || !row.riderId) return { kind: 'not-assigned' as const };

    const [rider, chat] = await Promise.all([
      tx.rider.findUnique({ where: { id: row.riderId }, select: { userId: true, user: { select: { name: true } } } }),
      tx.riderChat.findUnique({ where: { id }, select: { customer: { select: { userId: true } } } }),
    ]);
    if (!rider || !chat) return { kind: 'missing' as const };

    await tx.riderChat.update({ where: { id }, data: { riderId: null, status: 'OPEN', claimedAt: null } });
    return { kind: 'unassigned' as const, riderUserId: rider.userId, riderName: rider.user.name, customerUserId: chat.customer.userId };
  });

  if (result.kind === 'missing') return NextResponse.json({ error: 'This order is no longer available.' }, { status: 404 });
  if (result.kind === 'not-assigned') return NextResponse.json({ error: 'This order has no rider to remove.' }, { status: 409 });

  notifyAfterResponse(async () => [
    { userId: result.riderUserId, type: 'ORDER', title: 'Order removed from your list', message: 'The area manager returned this order to the waiting list.', href: null, refId: `unassigned:${id}` },
    { userId: result.customerUserId, type: 'ORDER', title: 'A new rider is being assigned', message: `${result.riderName} is no longer assigned. Your area team will pick another rider.`, href: `/finding-rider/${id}`, refId: `rider-unassigned:${id}` },
  ]);

  return NextResponse.json({ ok: true, status: 'OPEN', riderName: result.riderName });
}
