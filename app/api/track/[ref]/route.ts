import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { loadOrderTracking } from '@/lib/order-tracking';

export const dynamic = 'force-dynamic';

/**
 * Where an order is right now (its steps and, while a rider has taken it, the rider's position). The open tracking page asks
 * for this every few seconds. Only the customer the order belongs to, and admins, get an answer; for anybody else, and for an
 * order number that does not exist, it is the same 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const session = await getSession();

  if (!session || (session.role !== 'CUSTOMER' && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Please log in to track your order.' }, { status: 401 });
  }

  const tracking = await loadOrderTracking(ref, session);

  if (!tracking) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  return NextResponse.json(tracking, { headers: { 'Cache-Control': 'no-store' } });
}
