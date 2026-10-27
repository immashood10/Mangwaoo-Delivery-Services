import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isRasterImageDataUrl } from '@/lib/data-url-image';
import { getSession } from '@/lib/auth';
import { refreshFoodCatalog } from '@/lib/catalog-cache';
import { Prisma } from '@/lib/generated/prisma/client';
import { lowestPortionPrice, parsePortionsInput, readPortions } from '@/lib/food-portions';

async function resolveOwnedProduct(id: string) {
  const session = await getSession();

  if (!session || session.role !== 'SELLER') {
    return { error: NextResponse.json({ error: 'You must be logged in as a seller to do this.' }, { status: 401 }) } as const;
  }

  const seller = await prisma.seller.findUnique({ where: { userId: session.userId } });
  if (!seller) {
    return { error: NextResponse.json({ error: 'Seller account not found.' }, { status: 404 }) } as const;
  }

  if (seller.sellerType !== 'GULPLAZA_OWNER' && seller.sellerType !== 'WHOLESALER') {
    return {
      error: NextResponse.json(
        { error: 'This account is not registered as a Food business owner.' },
        { status: 403 }
      ),
    } as const;
  }

  const product = await prisma.gulplazaProduct.findUnique({ where: { id } });
  if (!product || product.sellerId !== seller.id) {
    return { error: NextResponse.json({ error: 'Product not found.' }, { status: 404 }) } as const;
  }

  return { product };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await resolveOwnedProduct(id);
  if ('error' in resolved) return resolved.error;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const categoryId = typeof body?.categoryId === 'string' ? body.categoryId : '';
  const images = Array.isArray(body?.images) ? body.images.filter((url: unknown) => typeof url === 'string') : [];

  // Sent with every save from the Edit window: a list of sizes (250 g, 500 g, 1 kg ...), or an empty one for a dish with
  // a single price. A request that doesn't mention sizes at all (an older open page) leaves them as they are.
  const sizes = parsePortionsInput(body?.portions);

  if ('error' in sizes) {
    return NextResponse.json({ error: sizes.error }, { status: 400 });
  }

  const sendsSizes = body !== null && typeof body === 'object' && Object.hasOwn(body, 'portions');
  const keptPortions = sendsSizes ? sizes.portions : readPortions(resolved.product.portions);
  const typedPrice = typeof body?.price === 'number' ? body.price : parseFloat(body?.price);
  // A dish sold by weight is priced by its sizes: its own price is the lowest of them.
  const price = keptPortions.length > 0 ? lowestPortionPrice(keptPortions) : typedPrice;

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

  const product = await prisma.gulplazaProduct.update({
    where: { id },
    data: {
      name,
      description: description || null,
      categoryId,
      price,
      images,
      ...(sendsSizes ? { portions: keptPortions.length > 0 ? keptPortions : Prisma.DbNull } : {}),
    },
  });
  refreshFoodCatalog();

  return NextResponse.json({ product });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await resolveOwnedProduct(id);
  if ('error' in resolved) return resolved.error;

  await prisma.gulplazaProduct.update({ where: { id }, data: { isActive: false } });
  refreshFoodCatalog();

  return NextResponse.json({ success: true });
}
