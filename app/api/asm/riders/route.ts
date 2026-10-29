import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { areaCentre, listAssignableRiders, requireManager } from '@/lib/area-managers';
import { chatDispatchPoint } from '@/lib/rider-dispatch';

/**
 * The riders a manager can pick from. With `?chatId=` (an order of the manager's area) they are measured from that order's
 * pickup point, nearest first; without it, from the middle of the area. A rider who has to pay Mangwaoo first is listed
 * but marked as not available for orders (`canAssign: false`): the wallet rule holds for the manager too.
 */
export async function GET(request: NextRequest) {
  const auth = await requireManager();
  if ('error' in auth) return auth.error;

  const { manager } = auth;
  const chatId = request.nextUrl.searchParams.get('chatId');
  let from = areaCentre(manager.areaId);

  if (chatId) {
    const chat = await prisma.riderChat.findUnique({
      where: { id: chatId },
      select: { areaId: true, latitude: true, longitude: true, pickupLatitude: true, pickupLongitude: true },
    });

    // Another area's order and a missing one answer the same, so order ids cannot be probed.
    if (!chat || chat.areaId !== manager.areaId) {
      return NextResponse.json({ error: 'This order is no longer available.' }, { status: 404 });
    }

    from = chatDispatchPoint(chat);
  }

  return NextResponse.json({ riders: await listAssignableRiders(from) }, { headers: { 'Cache-Control': 'no-store' } });
}
