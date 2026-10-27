import { NextRequest, NextResponse } from 'next/server';
import { FOOD_UNLIMITED_STOCK } from '@/lib/food-stock';
import { lowestPortionPrice, parsePortionsInput } from '@/lib/food-portions';
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
  const images = Array.isArray(body?.images) ? body.images.filter((url: unknown) => typeof url === 'string') : [];

  // A dish sold by weight (250 g, 500 g, 1 kg ...) has a price per size; the dish's own price is then the lowest of them.
  const sizes = parsePortionsInput(body?.portions);

  if ('error' in sizes) {
    return NextResponse.json({ error: sizes.error }, { status: 400 });
  }

  const { portions } = sizes;
  const price = portions.length > 0 ? lowestPortionPrice(portions) : typeof body?.price === 'number' ? body.price : parseFloat(body?.price);

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
      portions: portions.length > 0 ? portions : undefined,
      stock: FOOD_UNLIMITED_STOCK,
      images,
      categoryId,
      sellerId: seller.id,
    },
  });
  refreshFoodCatalog();

  return NextResponse.json({ product }, { status: 201 });
}
