import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getAdminCarts } from '@/lib/admin-carts';
import { CART_AGE_FILTERS, parseCartAge } from '@/lib/admin-cart-types';
import { formatPkr } from '@/lib/rider-wallet-config';
import AdminCarts from '@/components/AdminCarts';
import AutoRefresh from '@/components/AutoRefresh';

export const metadata = {
  title: 'Still in Cart - Mangwaoo Admin',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-soft">
      <p className="text-xs text-brand-gray">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

export default async function AdminCartsPage({ searchParams }: { searchParams: Promise<{ older?: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const age = parseCartAge((await searchParams).older);
  const data = await getAdminCarts(age);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <AutoRefresh />
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <ShoppingCart className="h-4 w-4" />
        Admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Still in Cart</h1>
      <p className="mb-8 text-brand-gray">
        Customers who put items in their cart but haven&apos;t ordered them, from every shop and restaurant. The time is how long since they last changed
        their cart. Remind a customer and they get a notification that opens their cart. A cart disappears from here when the customer orders or removes
        the items.
      </p>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Customers with items in cart" value={String(data.totals.customers)} />
        <Stat label="Items waiting" value={String(data.totals.units)} />
        <Stat label="Value waiting" value={formatPkr(Math.round(data.totals.value))} />
      </section>

      <nav className="mb-5 flex flex-wrap gap-2" aria-label="How long they have been waiting">
        {CART_AGE_FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value === 'all' ? '/admin/carts' : `/admin/carts?older=${filter.value}`}
            aria-current={filter.value === age ? 'page' : undefined}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              filter.value === age ? 'bg-brand-dark text-white' : 'border border-gray-200 bg-surface text-ink hover:border-accent hover:text-accent'
            }`}
          >
            {filter.label} ({data.ageCounts[filter.value]})
          </Link>
        ))}
      </nav>

      <AdminCarts customers={data.customers} hidden={data.hidden} emptyMessage={age === 'all' ? 'No carts are waiting right now.' : 'Nobody has been waiting that long.'} />
    </div>
  );
}
