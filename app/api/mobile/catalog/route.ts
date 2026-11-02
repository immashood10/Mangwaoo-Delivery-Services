import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** Small public catalog feed for the native app. Prices and stock are checked again by checkout. */
export async function GET() {
  const [mart, food] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0 }, category: { name: { in: ['Groceries', 'Dairy', 'Medicine'] } } },
      select: { id: true, name: true, description: true, price: true, images: true, category: { select: { name: true } }, seller: { select: { businessName: true } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    }),
    prisma.gulplazaProduct.findMany({
      where: { isActive: true, stock: { gt: 0 } },
      select: { id: true, name: true, description: true, price: true, portions: true, images: true, category: { select: { name: true } }, seller: { select: { businessName: true } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    }),
  ]);

  return NextResponse.json({
    products: [
      ...mart.map((p) => ({ id: p.id, name: p.name, description: p.description, price: Number(p.price), images: p.images, category: p.category.name, vendor: p.seller.businessName, marketplace: 'mart' as const })),
      ...food.map((p) => ({ id: p.id, name: p.name, description: p.description, price: Number(p.price), portions: p.portions, images: p.images, category: p.category.name, vendor: p.seller.businessName, marketplace: 'gulplaza' as const })),
    ],
  }, { headers: { 'Cache-Control': 'private, max-age=30' } });
}
