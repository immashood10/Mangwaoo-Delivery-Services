import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveSellerApi } from '@/lib/seller-api';

// Clears the seller's whole "still in cart" list.
export async function DELETE(request: NextRequest) {
  const resolved = await resolveSellerApi();
  if ('error' in resolved) return resolved.error;

  const marketplace = request.nextUrl.searchParams.get('marketplace') === 'GULPLAZA' ? 'GULPLAZA' : 'MART';

  const result = await prisma.cartItem.updateMany({
    where: { sellerId: resolved.seller.id, marketplace, dismissedAt: null },
    data: { dismissedAt: new Date() },
  });

  return NextResponse.json({ removed: result.count });
}
