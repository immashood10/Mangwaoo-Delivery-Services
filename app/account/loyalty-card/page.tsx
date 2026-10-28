import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CreditCard } from 'lucide-react';
import LoyaltyCardView from '@/components/LoyaltyCardView';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLoyaltyCardPage } from '@/lib/loyalty-card';

export const metadata = {
  title: 'Loyalty Card - Mangwaoo',
};

export default async function LoyaltyCardPage() {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    redirect('/login?next=/account/loyalty-card');
  }

  const customer = await prisma.customer.findUnique({ where: { userId: session.userId }, select: { id: true } });

  if (!customer) {
    redirect('/login?next=/account/loyalty-card');
  }

  const data = await getLoyaltyCardPage(customer.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/account" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-gray hover:text-accent">
        <ArrowLeft className="h-4 w-4" />
        My Orders
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
          <CreditCard className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink">Mangwaoo Loyalty Card</h1>
          <p className="text-brand-gray">Order often, apply for your card and get a surprise discount on every order.</p>
        </div>
      </div>

      <LoyaltyCardView data={data} />
    </div>
  );
}
