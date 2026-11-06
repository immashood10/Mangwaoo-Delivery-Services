import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** The signed-in seller, looked up once per request (the layout and the page share it). */
export const getCurrentSeller = cache(async () => {
  const session = await getSession();

  if (!session || session.role !== 'SELLER') return null;

  return prisma.seller.findUnique({
    where: { userId: session.userId },
    include: { user: { select: { name: true, email: true, phone: true } } },
  });
});

export type CurrentSeller = NonNullable<Awaited<ReturnType<typeof getCurrentSeller>>>;

export async function requireSeller() {
  const seller = await getCurrentSeller();

  if (!seller) redirect('/sell');

  return seller;
}

/** Shop Owners manage their catalogue; Mangwaoo manages their orders and customer fulfilment details. */
export async function requireSellerOrderAccess() {
  const seller = await requireSeller();

  return seller;
}

/** Food businesses use the Food catalogue; Shop Owner fulfilment is managed by Mangwaoo. */
export function isFoodSeller(seller: { sellerType: string }) {
  return seller.sellerType === 'GULPLAZA_OWNER' || seller.sellerType === 'SHOP_OWNER' || seller.sellerType === 'WHOLESALER';
}

export function isShopOwner(seller: { sellerType: string }) {
  return seller.sellerType === 'SHOP_OWNER';
}

/**
 * Whether a vendor moves its own orders along (accept, preparing, out for delivery, delivered, cancel). Only the small food
 * businesses do (food business owners and wholesalers); Shop Owners and MangwaooMart vendors (Mangwaoo's own store included)
 * only receive and prepare: Mangwaoo's admins and the area's manager move their orders, and the vendor is told when the rider
 * has taken and delivered them.
 */
export function canChangeOrderStatus(seller: { sellerType: string }) {
  return seller.sellerType === 'GULPLAZA_OWNER' || seller.sellerType === 'WHOLESALER';
}
