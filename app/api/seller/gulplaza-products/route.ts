import { NextRequest, NextResponse } from 'next/server';
import { FOOD_UNLIMITED_STOCK } from '@/lib/food-stock';
import { prisma } from '@/lib/prisma';
import { isRasterImageDataUrl } from '@/lib/data-url-image';
import { getSession } from '@/lib/auth';
import { refreshFoodCatalog } from '@/lib/catalog-cache';

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'SELLER') {
    return NextResponse.json({ error: 'You must be logged in as a seller to do this.' }, { status: 401 });
  }

  const seller = await prisma.seller.findUnique({ where: { userId: session.userId } });

  if (!seller) {
    return NextResponse.json({ error: 'Seller account not found.' }, { status: 404 });
  }

  if (seller.sellerType !== 'GULPLAZA_OWNER' && seller.sellerType !== 'WHOLESALER') {
    return NextResponse.json(
      { error: 'This account is not registered as a Food business owner.' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const categoryId = typeof body?.categoryId === 'string' ? body.categoryId : '';
  const price = typeof body?.price === 'number' ? body.price : parseFloat(body?.price);
  const images = Array.isArray(body?.images) ? body.images.filter((url: unknown) => typeof url === 'string') : [];

  if (!name || !categoryId || !Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: 'Please fill in all fields with valid values.' }, { status: 400 });
  }

  if (images.length > 6) {
    return NextResponse.json({ error: 'You can upload up to 6 photos per product.' }, { status: 400 });
  }

  if (images.some((url: string) => !isRasterImageDataUrl(url))) {
    return NextResponse.json({ error: 'Invalid product image.' }, { status: 400 });
  }

  const category = await prisma.gulplazaCategory.findUnique({ where: { id: categoryId } });

  if (!category) {
    return NextResponse.json({ error: 'Please choose a valid category.' }, { status: 400 });
  }

  const product = await prisma.gulplazaProduct.create({
    data: {
      name,
      description: description || null,
      price,
      stock: FOOD_UNLIMITED_STOCK,
      images,
      categoryId,
      sellerId: seller.id,
    },
  });
  refreshFoodCatalog();

  return NextResponse.json({ product }, { status: 201 });
}
