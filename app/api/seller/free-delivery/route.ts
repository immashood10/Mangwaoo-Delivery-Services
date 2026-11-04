import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { refreshFoodCatalog } from '@/lib/catalog-cache';
import { parseFreeDeliveryMin } from '@/lib/delivery';

const FOOD_SELLER_TYPES = ['GULPLAZA_OWNER', 'SHOP_OWNER', 'WHOLESALER'];

/**
 * A food seller's own free-delivery offer: `{ freeDeliveryMinOrder: 500 }` = orders whose food comes to PKR 500 or more (before
 * discounts) are delivered free; `null` = no free delivery. Mangwaoo no longer gives free delivery by itself.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'SELLER') {
    return NextResponse.json({ error: 'You must be logged in as a seller to do this.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseFreeDeliveryMin(body?.freeDeliveryMinOrder);

  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const seller = await prisma.seller.findUnique({ where: { userId: session.userId }, select: { id: true, sellerType: true } });

  if (!seller) return NextResponse.json({ error: 'Seller account not found.' }, { status: 404 });

  if (!FOOD_SELLER_TYPES.includes(seller.sellerType)) {
    return NextResponse.json({ error: 'Only food businesses have a delivery fee.' }, { status: 400 });
  }

  await prisma.seller.update({ where: { id: seller.id }, data: { freeDeliveryMinOrder: parsed.value } });

  // Restaurant cards and pages show the offer, so their cached copies are refreshed.
  refreshFoodCatalog();

  return NextResponse.json({ freeDeliveryMinOrder: parsed.value });
}
