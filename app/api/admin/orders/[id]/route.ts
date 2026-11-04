import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { changeOrderStatus, outcomeError, type FulfillmentKind, type FulfillmentStatus } from '@/lib/order-fulfillment';

const STATUSES: FulfillmentStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

/**
 * An admin moves any order along (accept, preparing, out for delivery, delivered) or cancels it. Vendors cannot do this: the
 * order status belongs to Mangwaoo (admins and the area's manager).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const kind: FulfillmentKind | null = body?.marketplace === 'GULPLAZA' ? 'GULPLAZA' : body?.marketplace === 'MART' ? 'MART' : null;
  const status = STATUSES.find((candidate) => candidate === body?.status);

  if (!kind || !status) return NextResponse.json({ error: 'Choose an order and the status to move it to.' }, { status: 400 });

  const outcome = await changeOrderStatus({ kind, id, status });

  if (outcome.kind !== 'ok') {
    const { status: code, error } = outcomeError(outcome, status);

    return NextResponse.json({ error }, { status: code });
  }

  return NextResponse.json({ order: { id, status } });
}
