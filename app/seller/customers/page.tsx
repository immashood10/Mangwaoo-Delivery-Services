import { Repeat, Users, Wallet } from 'lucide-react';
import { KpiCard, Panel, SellerTopNav, pkr } from '@/components/seller/SellerAnalyticsUi';
import { loadSellerOrders, summarizeCustomers } from '@/lib/seller-analytics';
import { requireSeller } from '@/lib/seller-context';

export const metadata = { title: 'Customers - Mangwaoo Seller' };

const LIST_LIMIT = 200;

export default async function SellerCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const seller = await requireSeller();
  const q = ((await searchParams).q ?? '').trim().toLowerCase();
  const all = summarizeCustomers(await loadSellerOrders(seller));
  const customers = (q ? all.filter((customer) => customer.name.toLowerCase().includes(q)) : all).slice(0, LIST_LIMIT);
  const repeat = all.filter((customer) => customer.orders > 1).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-1 text-2xl font-bold text-ink md:text-3xl">Customers</h1>
      <p className="mb-6 text-sm text-brand-gray">Everyone who ordered from {seller.businessName}, with what they bought.</p>

      <SellerTopNav current="/seller/customers" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Customers" value={all.length.toLocaleString('en-IN')} icon={Users} note="Who ever ordered" />
        <KpiCard label="Repeat customers" value={repeat.toLocaleString('en-IN')} icon={Repeat} note="Ordered more than once" />
        <KpiCard label="Best customer spent" value={pkr(all[0]?.spent ?? 0)} icon={Wallet} note={all[0]?.spent ? all[0].name : 'No delivered orders yet'} />
      </div>

      <Panel title="All customers">
        <form action="/seller/customers" className="mb-4 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name"
            aria-label="Search customers"
            className="min-w-0 flex-1 rounded-full border border-gray-200 bg-surface px-4 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <button type="submit" className="rounded-full bg-brand-dark px-5 py-2 text-sm font-semibold text-white hover:opacity-90">
            Search
          </button>
        </form>

        {customers.length === 0 ? (
          <p className="rounded-xl bg-brand-light p-4 text-sm text-brand-gray">{all.length === 0 ? 'No customers yet.' : 'Nobody matches this search.'}</p>
        ) : (
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-brand-gray">
                  <th className="py-2 pr-3 font-semibold">Customer</th>
                  <th className="py-2 pr-3 text-right font-semibold">Orders</th>
                  <th className="py-2 pr-3 text-right font-semibold">Delivered</th>
                  <th className="py-2 pr-3 text-right font-semibold">Spent</th>
                  <th className="py-2 font-semibold">Last order</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 pr-3 font-semibold text-ink">{customer.name}</td>
                    <td className="py-3 pr-3 text-right text-ink">{customer.orders}</td>
                    <td className="py-3 pr-3 text-right text-ink">{customer.delivered}</td>
                    <td className="py-3 pr-3 text-right font-semibold text-ink">{pkr(customer.spent)}</td>
                    <td className="whitespace-nowrap py-3 text-brand-gray">
                      {customer.lastOrder.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
