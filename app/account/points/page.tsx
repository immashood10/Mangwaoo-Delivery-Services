import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Gift } from 'lucide-react';
import PointsWallet from '@/components/PointsWallet';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { awardMissingPoints, getPointsPage } from '@/lib/points';

export const metadata = {
  title: 'Mangwaoo Points - Mangwaoo',
};

export default async function PointsPage() {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    redirect('/login?next=/account/points');
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: session.userId },
    select: { id: true, user: { select: { name: true, phone: true } } },
  });

  if (!customer) {
    redirect('/login?next=/account/points');
  }

  // Orders that were delivered but missed their points (a failed award, an older version of the site) win them now.
  try {
    await awardMissingPoints(customer.id);
  } catch (error) {
    console.error('Could not catch up Mangwaoo Points:', error);
  }

  const data = await getPointsPage(customer.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/account" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-gray hover:text-accent">
        <ArrowLeft className="h-4 w-4" />
        My Orders
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
          <Gift className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink">Mangwaoo Points</h1>
          <p className="text-brand-gray">Win points on every delivered order, cash them in and send the money to your JazzCash or EasyPaisa.</p>
        </div>
      </div>

      <PointsWallet data={data} defaultName={customer.user.name} defaultPhone={customer.user.phone ?? ''} />
    </div>
  );
}
