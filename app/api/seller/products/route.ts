import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'SELLER') {
    return NextResponse.json({ error: 'You must be logged in as a seller to do this.' }, { status: 401 });
  }

  const seller = await prisma.seller.findUnique({ where: { userId: session.userId } });

  if (!seller) {
    return NextResponse.json({ error: 'Seller account not found.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const categoryId = typeof body?.categoryId === 'string' ? body.categoryId : '';
  const price = typeof body?.price === 'number' ? body.price : parseFloat(body?.price);
  const stock = typeof body?.stock === 'number' ? body.stock : parseInt(body?.stock, 10);
  const images = Array.isArray(body?.images) ? body.images.filter((url: unknown) => typeof url === 'string') : [];

  if (!name || !categoryId || !Number.isFinite(price) || price <= 0 || !Number.isFinite(stock) || stock < 0) {
    return NextResponse.json({ error: 'Please fill in all fields with valid values.' }, { status: 400 });
  }

  if (images.length > 6) {
    return NextResponse.json({ error: 'You can upload up to 6 photos per product.' }, { status: 400 });
  }

  if (images.some((url: string) => !url.startsWith('data:image/') || url.length > 3_000_000)) {
    return NextResponse.json({ error: 'Invalid product image.' }, { status: 400 });
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });

  if (!category) {
    return NextResponse.json({ error: 'Please choose a valid category.' }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      name,
      description: description || null,
      price,
      stock,
      images,
      categoryId,
      sellerId: seller.id,
    },
  });

  return NextResponse.json({ product }, { status: 201 });
}
