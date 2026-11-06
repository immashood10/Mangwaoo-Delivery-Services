import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { REEL_SELECT, reelUser, serializeReels } from '@/lib/reels';
export async function GET(request: Request) {
  const auth = await reelUser(true); if ('error' in auth) return auth.error;
  const status = new URL(request.url).searchParams.get('status');
  const filter = status === 'APPROVED' || status === 'DECLINED' ? status : 'PENDING';
  const rows = await prisma.reel.findMany({ where: { status: filter }, select: REEL_SELECT, take: 50, orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ reels: await serializeReels(rows, auth.session.userId) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
