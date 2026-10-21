import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Please log in to manage saved addresses.' }, { status: 401 });
  }

  const address = await prisma.address.findUnique({ where: { id } });

  if (!address || address.userId !== session.userId || !address.isSaved) {
    return NextResponse.json({ error: 'Address not found.' }, { status: 404 });
  }

  // Orders reference Address rows, so un-save instead of deleting to keep order history intact.
  await prisma.address.update({ where: { id }, data: { isSaved: false } });

  return NextResponse.json({ ok: true });
}
