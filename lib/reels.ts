import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import type { Prisma } from '@/lib/generated/prisma/client';
import { MAX_REEL_BYTES } from '@/lib/reel-config';

export async function reelUser(admin = false) {
  const session = await getSession();
  if (!session || (admin && session.role !== 'ADMIN')) return { error: NextResponse.json({ error: admin ? 'Admin access required.' : 'Please log in first.', requiresLogin: !admin }, { status: 401 }) };
  return { session };
}
export const REEL_SELECT = {
  id: true, caption: true, status: true, createdAt: true, authorId: true,
  declineReason: true, linkedProductId: true,
  author: { select: { name: true } },
  linkedProduct: { select: { id: true, name: true, isActive: true, seller: { select: { businessName: true, isApproved: true } } } },
  _count: { select: { likes: true, comments: true } },
} satisfies Prisma.ReelSelect;
export const PUBLIC_REEL = { status: 'APPROVED' as const, author: { isActive: true, deletedAt: null } };
export async function serializeReels(rows: Prisma.ReelGetPayload<{ select: typeof REEL_SELECT }>[], userId?: string) {
  const liked = userId ? await prisma.reelLike.findMany({ where: { userId, reelId: { in: rows.map(r => r.id) } }, select: { reelId: true } }) : [];
  const ids = new Set(liked.map(l => l.reelId));
  return rows.map(r => ({ id: r.id, caption: r.caption, status: r.status, createdAt: r.createdAt.toISOString(), authorName: r.author.name.split(' ')[0], owned: userId === r.authorId, liked: ids.has(r.id), likes: r._count.likes, comments: r._count.comments, declineReason: userId === r.authorId ? r.declineReason : null, product: r.linkedProduct?.isActive && r.linkedProduct.seller.isApproved ? { id: r.linkedProduct.id, name: r.linkedProduct.name, vendor: r.linkedProduct.seller.businessName } : null, videoUrl: '/api/reels/' + r.id + '/video' }));
}
export async function lockPublicReel(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "Reel" WHERE id = ${id} FOR UPDATE`;
  return tx.reel.findFirst({ where: { id, ...PUBLIC_REEL }, select: { id: true } });
}
export async function readReelForm(request: Request) {
  const limit = MAX_REEL_BYTES + 65536;
  if (Number(request.headers.get('content-length')) > limit || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const next = await reader.read(); if (next.done) break;
    size += next.value.length;
    if (size > limit) { await reader.cancel(); return null; }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new Response(bytes.buffer, { headers: { 'content-type': request.headers.get('content-type') || '' } }).formData().catch(() => null);
}
