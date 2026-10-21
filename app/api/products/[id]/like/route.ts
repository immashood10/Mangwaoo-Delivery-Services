import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { notifyAfterResponse } from '@/lib/notify';
import { SELLER_PAGES } from '@/lib/notification-types';

// Sets (not toggles) whether the signed-in user likes this ad, so repeating a
// request — a double click, a retry — never flips it back.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Please sign in to like ads.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (typeof body?.liked !== 'boolean') {
    return NextResponse.json({ error: 'Tell us whether you like this ad.' }, { status: 400 });
  }

  try {
    if (body.liked) {
      const created = await prisma.productLike.createMany({
        data: [{ userId: session.userId, productId: id }],
        skipDuplicates: true,
      });

      // Only a brand-new like tells the seller (repeating the request does nothing).
      if (created.count > 0) {
        notifyAfterResponse(async () => {
          const [ad, liker] = await Promise.all([
            prisma.product.findUnique({ where: { id }, select: { name: true, seller: { select: { userId: true } } } }),
            prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
          ]);

          if (!ad || ad.seller.userId === session.userId) return null;

          return {
            userId: ad.seller.userId,
            type: 'LIKE' as const,
            title: `${liker?.name ?? 'Someone'} liked your ad`,
            message: ad.name,
            href: SELLER_PAGES.products,
            refId: `like:${session.userId}:${id}`,
          };
        });
      }
    } else {
      await prisma.productLike.deleteMany({ where: { userId: session.userId, productId: id } });
    }
  } catch (error) {
    // P2003: foreign-key failure, i.e. there is no such ad (or the account is gone).
    if ((error as { code?: string })?.code === 'P2003') {
      return NextResponse.json({ error: 'Ad not found.' }, { status: 404 });
    }
    throw error;
  }

  const count = await prisma.productLike.count({ where: { productId: id } });

  return NextResponse.json({ liked: body.liked, count });
}
