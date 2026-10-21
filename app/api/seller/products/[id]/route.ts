import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { refreshMartCatalog } from '@/lib/catalog-cache';
import { Prisma } from '@/lib/generated/prisma/client';
import { resolveProductAttributes } from '@/lib/product-attributes';

async function resolveOwnedProduct(id: string) {
  const session = await getSession();

  if (!session || session.role !== 'SELLER') {
    return { error: NextResponse.json({ error: 'You must be logged in as a seller to do this.' }, { status: 401 }) } as const;
  }

  const seller = await prisma.seller.findUnique({ where: { userId: session.userId } });
  if (!seller) {
    return { error: NextResponse.json({ error: 'Seller account not found.' }, { status: 404 }) } as const;
  }

  const product = await prisma.product.findUnique({ where: { id } });
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

  // A vehicle ad needs its details (make, model, year, …) and clothes/shoes need their sizes;
  // other categories carry none.
  const details = resolveProductAttributes(category.name, body?.attributes);

  if ('error' in details) {
    return NextResponse.json({ error: details.error }, { status: 400 });
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      name,
      description: description || null,
      categoryId,
      price,
      stock,
      images,
      // Moving a product to a category without extra details clears the old ones (vehicle details or sizes).
      attributes: details.attributes ?? Prisma.DbNull,
    },
  });
  refreshMartCatalog();

  return NextResponse.json({ product });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await resolveOwnedProduct(id);
  if ('error' in resolved) return resolved.error;

  // Soft-delete: past orders/reviews still reference this product, so a hard
  // delete would either fail on the FK or destroy order history. Unlisting
  // it is what "delete" means from the seller's point of view either way.
  await prisma.product.update({ where: { id }, data: { isActive: false } });
  refreshMartCatalog();

  return NextResponse.json({ success: true });
}
