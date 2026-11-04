import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Mangwaoo's own store in MangwaooMart: Mangwaoo sells its own products there, shown under the name "Mangwaoo" like any vendor.
// It is one `Seller` row flagged `isOfficial` (type MART, approved) that nobody logs in as: its password is a random value that
// is thrown away. Admins post and edit its products in Admin > Mangwaoo Store, through the same /api/seller/products routes every
// MangwaooMart seller uses (an ADMIN session plus the `x-mangwaoo-store: official` header acts as this seller there). Its orders
// are handled by admins and the area managers, like every MangwaooMart order.

import { OFFICIAL_STORE_NAME, STORE_HEADER, STORE_HEADER_VALUE } from '@/lib/official-store-config';

export { OFFICIAL_STORE_NAME, STORE_HEADER, STORE_HEADER_VALUE };
/** The login-style name stored in the account's `email` column (not a real address; nobody knows the password). */
export const OFFICIAL_STORE_LOGIN = 'mangwaoo-store';

const OFFICIAL_INCLUDE = { user: { select: { name: true, email: true, phone: true } } } as const;

export async function getOfficialSeller() {
  return prisma.seller.findFirst({ where: { isOfficial: true }, include: OFFICIAL_INCLUDE });
}

/** Makes the official store (a hidden account named "Mangwaoo" and its approved MangwaooMart seller); does nothing if it exists. */
export async function createOfficialSeller() {
  const existing = await getOfficialSeller();

  if (existing) return { seller: existing, created: false as const };

  const password = await hashPassword(randomBytes(32).toString('hex'));

  try {
    await prisma.user.create({
      data: {
        name: OFFICIAL_STORE_NAME,
        email: OFFICIAL_STORE_LOGIN,
        password,
        role: 'SELLER',
        phoneVerifiedAt: new Date(),
        seller: {
          create: { businessName: OFFICIAL_STORE_NAME, sellerType: 'MART', isApproved: true, isOfficial: true, city: 'Karachi', country: 'Pakistan' },
        },
      },
    });
  } catch (error) {
    // Two admins pressing at the same moment: the other one made it.
    if ((error as { code?: string })?.code !== 'P2002') throw error;
  }

  const seller = await getOfficialSeller();

  if (!seller) throw new Error('Could not create the Mangwaoo store.');

  return { seller, created: true as const };
}

/**
 * Whose products a request to /api/seller/products works on: the signed-in seller's own, or, for an ADMIN who sends the store
 * header, the official Mangwaoo store. Anyone else gets the usual refusal. A seller who sends the header is still just that seller.
 */
export async function resolveProductSeller(request: Request) {
  const session = await getSession();

  if (session?.role === 'ADMIN' && request.headers.get(STORE_HEADER) === STORE_HEADER_VALUE) {
    const official = await prisma.seller.findFirst({ where: { isOfficial: true } });

    if (!official) {
      return { error: NextResponse.json({ error: 'The Mangwaoo store is not set up yet. Create it in Admin > Mangwaoo Store.' }, { status: 404 }) } as const;
    }

    return { seller: official } as const;
  }

  if (!session || session.role !== 'SELLER') {
    return { error: NextResponse.json({ error: 'You must be logged in as a seller to do this.' }, { status: 401 }) } as const;
  }

  const seller = await prisma.seller.findUnique({ where: { userId: session.userId } });

  if (!seller) {
    return { error: NextResponse.json({ error: 'Seller account not found.' }, { status: 404 }) } as const;
  }

  return { seller } as const;
}
