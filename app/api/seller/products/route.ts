import { validDeliveryDays } from '@/lib/delivery-policy';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isRasterImageDataUrl } from '@/lib/data-url-image';
import { resolveProductSeller } from '@/lib/official-store';
import { refreshMartCatalog } from '@/lib/catalog-cache';
import { resolveProductAttributes } from '@/lib/product-attributes';

export async function POST(request: NextRequest) {
  // The signed-in seller's own products, or (an admin with the store header) the official Mangwaoo store's.
  const owner = await resolveProductSeller(request);
  if ('error' in owner) return owner.error;
  const { seller } = owner;

  const body = await request.json().catch(() => null);
  const deliveryDays = body?.deliveryDays ?? 0;
  if (!validDeliveryDays(deliveryDays)) return NextResponse.json({ error: 'Choose Immediate, 3 days, 5 days or 7 days.' }, { status: 400 });
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

  if (images.some((url: string) => !isRasterImageDataUrl(url))) {
    return NextResponse.json({ error: 'Invalid product image.' }, { status: 400 });
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });

  if (!category) {
    return NextResponse.json({ error: 'Please choose a valid category.' }, { status: 400 });
  }

  // A vehicle ad needs its details (make, model, year, …) and clothes/shoes need their sizes;
  // other categories carry none.
  const resolved = resolveProductAttributes(category.name, body?.attributes);

  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      deliveryDays,
      name,
      description: description || null,
      price,
      stock,
      images,
      ...(resolved.attributes ? { attributes: resolved.attributes } : {}),
      categoryId,
      sellerId: seller.id,
    },
  });
  refreshMartCatalog();

  return NextResponse.json({ product }, { status: 201 });
}
