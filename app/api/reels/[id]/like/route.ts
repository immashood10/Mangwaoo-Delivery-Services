import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { lockPublicReel, reelUser } from '@/lib/reels';
import { enforceRateLimits } from '@/lib/rate-limit';
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await reelUser(); if ('error' in auth) return auth.error;
  const limited = await enforceRateLimits([{ scope: 'reel-like', subject: auth.session.userId, limit: 120, windowSeconds: 3600 }]); if (limited) return limited;
  const body = await request.json().catch(() => null); if (typeof body?.liked !== 'boolean') return NextResponse.json({ error: 'Choose like or unlike.' }, { status: 400 });
  const { id } = await params;
  const result = await prisma.$transaction(async tx => {
    if (!await lockPublicReel(tx, id)) return null;
    if (body.liked) await tx.reelLike.upsert({ where: { reelId_userId: { reelId: id, userId: auth.session.userId } }, create: { reelId: id, userId: auth.session.userId }, update: {} });
    else await tx.reelLike.deleteMany({ where: { reelId: id, userId: auth.session.userId } });
    return { liked: body.liked, likes: await tx.reelLike.count({ where: { reelId: id } }) };
  });
  return result ? NextResponse.json(result) : NextResponse.json({ error: 'Reel not found.' }, { status: 404 });
}
