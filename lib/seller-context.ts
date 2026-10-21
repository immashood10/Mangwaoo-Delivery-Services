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

/** Food businesses (GulPlaza owners and wholesalers) have their own catalog, orders and carts. */
export function isFoodSeller(seller: { sellerType: string }) {
  return seller.sellerType === 'GULPLAZA_OWNER' || seller.sellerType === 'WHOLESALER';
}
