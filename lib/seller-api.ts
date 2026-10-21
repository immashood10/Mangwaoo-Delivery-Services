import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** Shared guard for /api/seller routes: the caller must be a signed-in seller with a seller profile. */
export async function resolveSellerApi() {
  const session = await getSession();

  if (!session || session.role !== 'SELLER') {
    return { error: NextResponse.json({ error: 'You must be logged in as a seller to do this.' }, { status: 401 }) } as const;
  }

  const seller = await prisma.seller.findUnique({ where: { userId: session.userId } });

  if (!seller) {
    return { error: NextResponse.json({ error: 'Seller account not found.' }, { status: 404 }) } as const;
  }

  return { seller, session } as const;
}
