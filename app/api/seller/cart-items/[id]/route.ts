import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveSellerApi } from '@/lib/seller-api';

// Removes one "still in cart" entry from the seller's list. It comes back only if the customer changes that item's quantity.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await resolveSellerApi();
  if ('error' in resolved) return resolved.error;
  const { id } = await params;

  const result = await prisma.cartItem.updateMany({
    where: { id, sellerId: resolved.seller.id, dismissedAt: null },
    data: { dismissedAt: new Date() },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
