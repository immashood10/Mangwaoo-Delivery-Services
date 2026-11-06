import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 80);
  const rows = await prisma.gulplazaProduct.findMany({ where: { isActive: true, seller: { isApproved: true, user: { isActive: true, deletedAt: null } }, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { seller: { businessName: { contains: q, mode: 'insensitive' } } }] } : {}) }, select: { id: true, name: true, seller: { select: { businessName: true } } }, take: 30, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ dishes: rows.map(row => ({ id: row.id, name: row.name, vendor: row.seller.businessName })) });
}
