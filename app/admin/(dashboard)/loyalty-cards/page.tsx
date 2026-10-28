import { redirect } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getLoyaltyCardAdminPage } from '@/lib/loyalty-card';
import AdminLoyaltyCards from '@/components/AdminLoyaltyCards';
import AutoRefresh from '@/components/AutoRefresh';

export const metadata = {
  title: 'Loyalty Cards - Mangwaoo Admin',
};

export default async function AdminLoyaltyCardsPage() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const data = await getLoyaltyCardAdminPage();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <AutoRefresh />
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <CreditCard className="h-4 w-4" />
        Admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Loyalty Cards</h1>
      <p className="mb-8 max-w-3xl text-brand-gray">
        A customer whose orders have been delivered enough times is told they can apply for the Loyalty Card. When you approve the application, every
        order they place gets a random discount off its items (never the delivery fee). Mangwaoo pays the discount, the seller still gets the full price.
        You can take a card back at any time.
      </p>

      <AdminLoyaltyCards data={data} />
    </div>
  );
}
