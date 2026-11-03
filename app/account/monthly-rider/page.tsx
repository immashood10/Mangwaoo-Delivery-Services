import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Bike } from 'lucide-react';
import MonthlyRiderView from '@/components/MonthlyRiderView';
import AutoRefresh from '@/components/AutoRefresh';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCustomerMonthlyRiderPage } from '@/lib/monthly-rider';

export const metadata = {
  title: 'Monthly Rider - Mangwaoo',
};

export default async function MonthlyRiderPage() {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    redirect('/login?next=/account/monthly-rider');
  }

  const customer = await prisma.customer.findUnique({ where: { userId: session.userId }, select: { id: true } });

  if (!customer) {
    redirect('/login?next=/account/monthly-rider');
  }

  const data = await getCustomerMonthlyRiderPage(customer.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <AutoRefresh intervalMs={30000} />
      <Link href="/account" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-gray hover:text-accent">
        <ArrowLeft className="h-4 w-4" />
        My Orders
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
          <Bike className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink">Monthly Rider</h1>
          <p className="text-brand-gray">Keep a rider of your own for a month. Your orders go to them first.</p>
        </div>
      </div>

      <MonthlyRiderView data={data} />
    </div>
  );
}
