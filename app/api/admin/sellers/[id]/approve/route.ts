import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const isApproved = typeof body?.isApproved === 'boolean' ? body.isApproved : true;

  const seller = await prisma.seller.findUnique({ where: { id } });

  if (!seller) {
    return NextResponse.json({ error: 'Seller not found.' }, { status: 404 });
  }

  const updated = await prisma.seller.update({
    where: { id },
    data: { isApproved },
  });

  return NextResponse.json({ seller: { id: updated.id, isApproved: updated.isApproved } });
}
