import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { RiderHistoryResponse } from '@/lib/rider-history-types';
import { getRiderHistory, parseHistoryFilter, parseHistoryRange } from '@/lib/rider-orders';

/**
 * The signed-in rider's order history: how many orders they delivered, how many were cancelled and how many are still
 * going, the delivery charges, their rating from customers, and the orders themselves, newest first (`filter`, `range`
 * and `cursor` narrow and page it). Riders only, and only their own.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'RIDER') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const rider = await prisma.rider.findUnique({ where: { userId: session.userId }, select: { id: true, isApproved: true } });

  if (!rider) {
    return NextResponse.json({ error: 'Rider account not found.' }, { status: 404 });
  }

  const noHistory: RiderHistoryResponse = {
    summary: { delivered: 0, cancelled: 0, closed: 0, pending: 0, deliveryCharges: 0, commission: 0, bonus: 0 },
    rating: null,
    items: [],
    nextCursor: null,
  };

  // A rider who isn't approved yet has taken no orders.
  if (!rider.isApproved) return NextResponse.json(noHistory);

  const params = request.nextUrl.searchParams;
  const history = await getRiderHistory(rider.id, {
    filter: parseHistoryFilter(params.get('filter')),
    range: parseHistoryRange(params.get('range')),
    cursor: params.get('cursor'),
    summaryOnly: params.get('summary') === '1',
  });

  return NextResponse.json(history, { headers: { 'Cache-Control': 'private, no-store' } });
}
