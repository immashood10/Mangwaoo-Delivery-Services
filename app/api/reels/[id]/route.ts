import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reelUser } from '@/lib/reels';
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await reelUser(); if ('error' in auth) return auth.error;
  const { id } = await params;
  const result = await prisma.reel.deleteMany({ where: { id, ...(auth.session.role === 'ADMIN' ? {} : { authorId: auth.session.userId }) } });
  return result.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Reel not found.' }, { status: 404 });
}
