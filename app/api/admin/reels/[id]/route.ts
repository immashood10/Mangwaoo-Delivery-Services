import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reelUser } from '@/lib/reels';
import { notifyAfterResponse } from '@/lib/notify';
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await reelUser(true); if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => null);
  const status = body?.status; const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  if (status !== 'APPROVED' && status !== 'DECLINED') return NextResponse.json({ error: 'Choose Approve or Decline.' }, { status: 400 });
  const { id } = await params;
  const changed = await prisma.reel.updateMany({ where: { id, status: status === 'APPROVED' ? 'PENDING' : { in: ['PENDING', 'APPROVED'] } }, data: { status, reviewedById: auth.session.userId, reviewedAt: new Date(), declineReason: status === 'DECLINED' ? reason || 'Please review our food reel guidelines and submit a new reel.' : null } });
  if (!changed.count) return NextResponse.json({ error: 'This reel was already reviewed or removed. Refresh the list.' }, { status: 409 });
  notifyAfterResponse(async () => { const reel = await prisma.reel.findUnique({ where: { id }, select: { authorId: true } }); return reel ? { userId: reel.authorId, type: 'ACCOUNT', title: status === 'APPROVED' ? 'Your food reel is live' : 'Your food reel was declined', message: status === 'APPROVED' ? 'People can now watch and order from your reel.' : reason || 'Please check My reels for details.', href: '/reels?mine=1', refId: 'reel-review:' + id } : null; });
  return NextResponse.json({ ok: true });
}
