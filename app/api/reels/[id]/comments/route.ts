import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PUBLIC_REEL, lockPublicReel, reelUser } from '@/lib/reels';
import { enforceRateLimits } from '@/lib/rate-limit';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await prisma.reel.findFirst({ where: { id, ...PUBLIC_REEL }, select: { id: true } })) return NextResponse.json({ error: 'Reel not found.' }, { status: 404 });
  const rows = await prisma.reelComment.findMany({ where: { reelId: id, user: { isActive: true, deletedAt: null } }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, body: true, createdAt: true, user: { select: { name: true } } } });
  return NextResponse.json({ comments: rows.map(c => ({ id: c.id, body: c.body, createdAt: c.createdAt, authorName: c.user.name.split(' ')[0] })) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await reelUser(); if ('error' in auth) return auth.error;
  const limited = await enforceRateLimits([{ scope: 'reel-comment', subject: auth.session.userId, limit: 30, windowSeconds: 3600 }]); if (limited) return limited;
  const data = await request.json().catch(() => null); const body = typeof data?.body === 'string' ? data.body.trim() : '';
  if (!body || body.length > 500) return NextResponse.json({ error: 'Write a comment of 1-500 characters.' }, { status: 400 });
  const { id } = await params;
  const result = await prisma.$transaction(async tx => {
    if (!await lockPublicReel(tx, id)) return null;
    const comment = await tx.reelComment.create({ data: { reelId: id, userId: auth.session.userId, body }, select: { id: true, body: true, createdAt: true, user: { select: { name: true } } } });
    return { id: comment.id, body: comment.body, createdAt: comment.createdAt, authorName: comment.user.name.split(' ')[0] };
  });
  return result ? NextResponse.json({ comment: result }, { status: 201 }) : NextResponse.json({ error: 'Reel not found.' }, { status: 404 });
}
