import { NextRequest, NextResponse, after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ADMIN_PAGES } from '@/lib/notification-types';
import { notifyAdminsAfterResponse } from '@/lib/notify';
import { enforceRateLimits } from '@/lib/rate-limit';
import { resolveSellerApi } from '@/lib/seller-api';
import { isFoodSeller } from '@/lib/seller-context';
import { sendWhatsAppNotification } from '@/lib/whatsapp';
import { AD_PLACEMENTS, formatAdDays, isAdPlacement, normalizePaymentRef } from '@/lib/ad-config';

// A seller asks to run an ad for one of their products. The ad fee is paid by EasyPaisa / JazzCash and the
// seller enters the transaction id; the ad stays PENDING until an admin checks it and approves it.
export async function POST(request: NextRequest) {
  const resolved = await resolveSellerApi();
  if ('error' in resolved) return resolved.error;
  const { seller } = resolved;

  if (isFoodSeller(seller)) {
    return NextResponse.json({ error: 'Ads are available for MangwaooMart products.' }, { status: 403 });
  }

  const limited = await enforceRateLimits([{ scope: 'ad-request', subject: seller.id, limit: 20, windowSeconds: 3600 }]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const productId = typeof body?.productId === 'string' ? body.productId : '';
  const placement = body?.placement;
  const paymentRef = normalizePaymentRef(body?.paymentRef);

  if (!productId || !isAdPlacement(placement)) {
    return NextResponse.json({ error: 'Choose a product and where the ad should run.' }, { status: 400 });
  }

  if (!paymentRef) {
    return NextResponse.json(
      { error: 'Enter the EasyPaisa / JazzCash transaction ID of your payment (6–40 letters and numbers).' },
      { status: 400 }
    );
  }

  const [product, running, sameRef] = await Promise.all([
    prisma.product.findFirst({ where: { id: productId, sellerId: seller.id, isActive: true }, select: { id: true, name: true } }),
    // One ad per product and placement at a time: either waiting for review or still running.
    prisma.productAd.findFirst({
      where: {
        productId,
        placement,
        OR: [{ status: 'PENDING' }, { status: 'ACTIVE', endsAt: { gt: new Date() } }],
      },
      select: { status: true },
    }),
    prisma.productAd.findFirst({ where: { paymentRef, status: { in: ['PENDING', 'ACTIVE'] } }, select: { id: true } }),
  ]);

  if (!product) {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  }

  if (running) {
    return NextResponse.json(
      {
        error:
          running.status === 'PENDING'
            ? 'This product already has a request for that spot waiting for review.'
            : 'This product already has an ad running in that spot. You can run it again once it ends.',
      },
      { status: 409 }
    );
  }

  if (sameRef) {
    return NextResponse.json({ error: 'That transaction ID has already been used for another ad.' }, { status: 409 });
  }

  const config = AD_PLACEMENTS[placement];
  const ad = await prisma.productAd.create({
    data: {
      placement,
      amount: config.priceRs,
      paymentRef,
      productId: product.id,
      sellerId: seller.id,
    },
  });

  notifyAdminsAfterResponse(async () => ({
    type: 'AD' as const,
    title: 'New ad request',
    message: `${seller.businessName} - ${product.name} (${config.label}), Rs ${config.priceRs}. Check the payment.`,
    href: ADMIN_PAGES.ads,
    refId: `ad:${ad.id}`,
  }));

  // Tell the store owner there is a payment to check (no-op when WhatsApp isn't configured).
  after(async () => {
    try {
      await sendWhatsAppNotification(
        [
          '📣 New ad request',
          `Store: ${seller.businessName}`,
          `Product: ${product.name}`,
          `Spot: ${config.label} (${formatAdDays(config.durationDays)})`,
          `Amount: Rs ${config.priceRs}`,
          `Transaction ID: ${paymentRef}`,
          '',
          'Check the payment, then approve it in Admin > Ad Requests.',
        ].join('\n')
      );
    } catch (error) {
      console.error('Could not send the ad request notification:', error);
    }
  });

  return NextResponse.json({ ad: { id: ad.id, status: ad.status } }, { status: 201 });
}
