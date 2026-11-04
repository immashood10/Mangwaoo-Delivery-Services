import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveSellerApi } from '@/lib/seller-api';
import { canChangeOrderStatus } from '@/lib/seller-context';
import { changeOrderStatus, outcomeError, type FulfillmentStatus } from '@/lib/order-fulfillment';
import { FINISHED_STATUSES } from '@/lib/seller-types';

const STATUSES: FulfillmentStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

function readMarketplace(value: unknown) {
  return value === 'GULPLAZA' ? 'GULPLAZA' : value === 'MART' ? 'MART' : null;
}

// A small food business (food business owner, wholesaler) moves its own order along (accept -> preparing -> out for delivery ->
// delivered) or cancels it. A SHOP OWNER or a MangwaooMart vendor changes nothing: they receive the order, make it, and are told when
// the rider delivered; Mangwaoo's admins and the area's manager move those orders (PATCH /api/admin/orders/[id], PATCH
// /api/asm/orders/[id]) and can move any order.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await resolveSellerApi();
  if ('error' in resolved) return resolved.error;
  const { seller } = resolved;

  if (!canChangeOrderStatus(seller)) {
    return NextResponse.json(
      { error: "Mangwaoo's team updates the status of your orders. You just prepare them: you will be told when the rider has taken and delivered them." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const marketplace = readMarketplace(body?.marketplace);
  const status = STATUSES.find((candidate) => candidate === body?.status);

  if (!marketplace || !status) {
    return NextResponse.json({ error: 'Choose an order and the status to move it to.' }, { status: 400 });
  }

  const outcome = await changeOrderStatus({ kind: marketplace, id, status, sellerId: seller.id });

  if (outcome.kind !== 'ok') {
    const { status: code, error } = outcomeError(outcome, status);

    return NextResponse.json({ error }, { status: code });
  }

  return NextResponse.json({ order: { id, status } });
}

// Removes a finished (delivered or cancelled) order from the seller's own list. The customer keeps their order history.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await resolveSellerApi();
  if ('error' in resolved) return resolved.error;
  const { seller } = resolved;
  const { id } = await params;

  const marketplace = readMarketplace(request.nextUrl.searchParams.get('marketplace'));

  if (!marketplace) {
    return NextResponse.json({ error: 'Choose which order to remove.' }, { status: 400 });
  }

  const where = { id, sellerId: seller.id, status: { in: [...FINISHED_STATUSES] } };
  const result =
    marketplace === 'MART'
      ? await prisma.order.updateMany({ where, data: { sellerHidden: true } })
      : await prisma.gulplazaOrder.updateMany({ where, data: { sellerHidden: true } });

  if (result.count === 0) {
    return NextResponse.json({ error: 'Only delivered or cancelled orders can be removed.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
