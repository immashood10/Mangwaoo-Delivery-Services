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

/** Makes a coupon (Admin > Discount). */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = parseCouponInput(await request.json().catch(() => null));

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const taken = await prisma.coupon.findUnique({ where: { code: parsed.data.code }, select: { id: true } });

  if (taken) {
    return NextResponse.json({ error: `The code ${parsed.data.code} already exists. Edit it, or choose another code.` }, { status: 409 });
  }

  try {
    const coupon = await prisma.coupon.create({ data: parsed.data });

    return NextResponse.json({ coupon: toAdminCoupon(coupon) }, { status: 201 });
  } catch (error) {
    // Two admins saving the same code at the same moment
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: `The code ${parsed.data.code} already exists.` }, { status: 409 });
    }

    throw error;
  }
}
