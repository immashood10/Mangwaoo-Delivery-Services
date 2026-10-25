import { redirect } from 'next/navigation';
import { BadgePercent } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toAdminCoupon } from '@/lib/coupons';
import AdminDiscounts from '@/components/AdminDiscounts';

export const metadata = {
  title: 'Discount - Mangwaoo Admin',
};

export default async function AdminDiscountsPage() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  const now = new Date();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <BadgePercent className="h-4 w-4" />
        Admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Discount</h1>
      <p className="mb-8 max-w-3xl text-brand-gray">
        Make coupon codes for your customers. They type the code in their cart before placing an order and get the
        percentage off their items (the delivery fee is never discounted). Mangwaoo carries the discount: sellers are
        still paid the full price of their items.
      </p>

      <AdminDiscounts coupons={coupons.map((coupon) => toAdminCoupon(coupon, now))} />
    </div>
  );
}
