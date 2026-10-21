import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveSellerApi } from '@/lib/seller-api';

// Withdraws an ad request that hasn't been approved yet.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await resolveSellerApi();
  if ('error' in resolved) return resolved.error;
  const { id } = await params;

  const result = await prisma.productAd.deleteMany({
    where: { id, sellerId: resolved.seller.id, status: 'PENDING' },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: 'Only a request that is still waiting for review can be withdrawn.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
