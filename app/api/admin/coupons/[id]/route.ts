import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { parseCouponInput, toAdminCoupon } from '@/lib/coupons';

async function requireAdmin() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  return null;
}

/**
 * Edits a coupon, or — with just `{ isActive }` — pauses / resumes it. Orders that already used the coupon keep
 * what they were given; editing only changes what the next customers get.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const existing = await prisma.coupon.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: 'Coupon not found.' }, { status: 404 });
  }

  // Pause / resume
  if (body && typeof body === 'object' && Object.keys(body).length === 1 && typeof body.isActive === 'boolean') {
    const coupon = await prisma.coupon.update({ where: { id }, data: { isActive: body.isActive } });

    return NextResponse.json({ coupon: toAdminCoupon(coupon) });
  }

  const parsed = parseCouponInput(body);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (parsed.data.code !== existing.code) {
    // The code is what customers know it by; once someone has used it, renaming would confuse their order history.
    const used = await prisma.couponRedemption.count({ where: { couponId: id } });

    if (used > 0) {
      return NextResponse.json({ error: 'This coupon has been used, so its code can no longer change. Make a new coupon instead.' }, { status: 409 });
    }

    const taken = await prisma.coupon.findUnique({ where: { code: parsed.data.code }, select: { id: true } });

    if (taken) {
      return NextResponse.json({ error: `The code ${parsed.data.code} already exists.` }, { status: 409 });
    }
  }

  try {
    const coupon = await prisma.coupon.update({ where: { id }, data: parsed.data });

    return NextResponse.json({ coupon: toAdminCoupon(coupon) });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: `The code ${parsed.data.code} already exists.` }, { status: 409 });
    }

    throw error;
  }
}

/** Deletes a coupon nobody has used. A used one can only be paused, so past orders still show what they used. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const coupon = await prisma.coupon.findUnique({ where: { id }, select: { id: true } });

  if (!coupon) {
    return NextResponse.json({ error: 'Coupon not found.' }, { status: 404 });
  }

  const [redemptions, mart, food] = await Promise.all([
    prisma.couponRedemption.count({ where: { couponId: id } }),
    prisma.order.count({ where: { couponId: id } }),
    prisma.gulplazaOrder.count({ where: { couponId: id } }),
  ]);

  if (redemptions + mart + food > 0) {
    return NextResponse.json({ error: 'This coupon has been used on orders, so it can only be paused, not deleted.' }, { status: 409 });
  }

  await prisma.coupon.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
