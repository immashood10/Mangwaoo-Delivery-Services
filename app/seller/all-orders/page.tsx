import Link from 'next/link';
import { OrderFilters, OrdersTable, Panel, SellerTopNav } from '@/components/seller/SellerAnalyticsUi';
import { categoriesOf, filterOrders, loadSellerOrders } from '@/lib/seller-analytics';
import { requireSeller } from '@/lib/seller-context';

export const metadata = { title: 'Orders - Mangwaoo Seller' };

const LIST_LIMIT = 200;

export default async function SellerAllOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string }> }) {
  const seller = await requireSeller();
  const filter = await searchParams;
  const orders = await loadSellerOrders(seller);
  const matching = filterOrders(orders, filter);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-1 text-2xl font-bold text-ink md:text-3xl">Orders</h1>
      <p className="mb-6 text-sm text-brand-gray">
        Every order with its order ID, the same number your customer sees. To accept, prepare or cancel an order use{' '}
        <Link href="/seller/orders" className="font-semibold text-accent hover:underline">
          Incoming orders
        </Link>
        .
      </p>

      <SellerTopNav current="/seller/all-orders" />

      <Panel title={`${matching.length.toLocaleString('en-IN')} ${matching.length === 1 ? 'order' : 'orders'}`}>
        <OrderFilters action="/seller/all-orders" q={filter.q} status={filter.status} category={filter.category} categories={categoriesOf(orders)} />
        <OrdersTable orders={matching.slice(0, LIST_LIMIT)} empty={orders.length === 0 ? 'No orders yet.' : 'No order matches this search.'} />
        {matching.length > LIST_LIMIT ? <p className="mt-3 text-xs text-brand-gray">Showing the newest {LIST_LIMIT}. Narrow the search, or download the full report.</p> : null}
      </Panel>
    </div>
  );
}
