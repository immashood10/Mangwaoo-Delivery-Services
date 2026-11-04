import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/area-managers';
import { changeOrderStatus, outcomeError, type FulfillmentKind, type FulfillmentStatus } from '@/lib/order-fulfillment';

const STATUSES: FulfillmentStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

/**
 * An Area Sales Manager moves an order of THEIR area along (accept, preparing, out for delivery, delivered) or cancels it. An
 * order of another area, or one no manager covers, answers "not found". Vendors cannot do this.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await requireManager();
  if ('error' in resolved) return resolved.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const kind: FulfillmentKind | null = body?.marketplace === 'GULPLAZA' ? 'GULPLAZA' : body?.marketplace === 'MART' ? 'MART' : null;
  const status = STATUSES.find((candidate) => candidate === body?.status);

  if (!kind || !status) return NextResponse.json({ error: 'Choose an order and the status to move it to.' }, { status: 400 });

  const outcome = await changeOrderStatus({ kind, id, status, areaId: resolved.manager.areaId });

  if (outcome.kind !== 'ok') {
    const { status: code, error } = outcomeError(outcome, status);

    return NextResponse.json({ error }, { status: code });
  }

  return NextResponse.json({ order: { id, status } });
}
