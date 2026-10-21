import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { refreshFoodCatalog, refreshMartCatalog } from '@/lib/catalog-cache';
import { notifyAfterResponse } from '@/lib/notify';
import { SELLER_PAGES } from '@/lib/notification-types';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const isApproved = typeof body?.isApproved === 'boolean' ? body.isApproved : true;

  const seller = await prisma.seller.findUnique({ where: { id }, include: { user: { select: { phoneVerifiedAt: true, deletedAt: true } } } });

  if (!seller || seller.user.deletedAt) {
    return NextResponse.json({ error: 'Seller not found.' }, { status: 404 });
  }

  // A seller can only be approved once their WhatsApp number was confirmed with a code.
  if (isApproved && !seller.user.phoneVerifiedAt) {
    return NextResponse.json({ error: "This seller hasn't confirmed their WhatsApp number yet." }, { status: 400 });
  }

  const updated = await prisma.seller.update({
    where: { id },
    data: { isApproved },
  });

  // An approval change adds or removes this seller's items from search and menus.
  refreshFoodCatalog();
  refreshMartCatalog();

  if (isApproved && !seller.isApproved) {
    notifyAfterResponse(async () => ({
      userId: seller.userId,
      type: 'ACCOUNT' as const,
      title: 'Your seller account is approved',
      message: 'Your store has been reviewed and approved. Your listings are now live.',
      href: SELLER_PAGES.settings,
      refId: `approved:${seller.id}`,
    }));
  }

  return NextResponse.json({ seller: { id: updated.id, isApproved: updated.isApproved } });
}
