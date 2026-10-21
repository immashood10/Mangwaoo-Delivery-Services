import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { MAX_FAVOURITES, getFavouriteIds } from '@/lib/favourites';

const FOOD_SELLER_TYPES = ['GULPLAZA_OWNER', 'WHOLESALER'] as const;
const KINDS = ['RESTAURANT', 'DISH'] as const;

/** The ids of the restaurants and dishes the signed-in user has saved (empty when nobody is signed in). */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ restaurants: [], dishes: [] });
  }

  return NextResponse.json(await getFavouriteIds(session.userId));
}

// Sets (not toggles) whether a restaurant or dish is saved, so repeating a request — a double
// click, a retry — never flips it back.
export async function PUT(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Please log in to save favourites.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const kind = KINDS.find((value) => value === body?.kind);
  const targetId = typeof body?.id === 'string' ? body.id : '';

  if (!kind || !targetId || typeof body?.saved !== 'boolean') {
    return NextResponse.json({ error: 'Tell us what to save.' }, { status: 400 });
  }

  if (!body.saved) {
    await prisma.favourite.deleteMany({ where: { userId: session.userId, kind, targetId } });
    return NextResponse.json({ saved: false });
  }

  // Only restaurants and dishes that are actually on the site can be saved.
  const exists =
    kind === 'RESTAURANT'
      ? await prisma.seller.findFirst({
          where: { id: targetId, isApproved: true, sellerType: { in: [...FOOD_SELLER_TYPES] } },
          select: { id: true },
        })
      : await prisma.gulplazaProduct.findFirst({
          where: { id: targetId, isActive: true, seller: { isApproved: true, sellerType: { in: [...FOOD_SELLER_TYPES] } } },
          select: { id: true },
        });

  if (!exists) {
    return NextResponse.json({ error: kind === 'RESTAURANT' ? 'Restaurant not found.' : 'Dish not found.' }, { status: 404 });
  }

  const savedCount = await prisma.favourite.count({ where: { userId: session.userId } });

  if (savedCount >= MAX_FAVOURITES) {
    return NextResponse.json(
      { error: `You can save up to ${MAX_FAVOURITES} favourites. Remove one to add another.` },
      { status: 400 }
    );
  }

  await prisma.favourite.createMany({ data: [{ userId: session.userId, kind, targetId }], skipDuplicates: true });

  return NextResponse.json({ saved: true });
}
