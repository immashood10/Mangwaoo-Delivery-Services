import Link from 'next/link';
import { Download, Users, Wallet, XCircle, ShoppingBag } from 'lucide-react';
import { MonthlyBars, KpiCard, OrderFilters, OrdersTable, Panel, SellerTopNav, StripeBar, SuccessGauge, Change, pkr, stripeColor } from '@/components/seller/SellerAnalyticsUi';
import { categoriesOf, filterOrders, loadSellerOrders, summarizeSales } from '@/lib/seller-analytics';
import { requireSeller } from '@/lib/seller-context';

export const metadata = { title: 'Dashboard - Mangwaoo Seller' };

const RECENT = 10;

export default async function SellerDashboardPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string }> }) {
  const seller = await requireSeller();
  const filter = await searchParams;
  const orders = await loadSellerOrders(seller);
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const summary = summarizeSales(orders, Date.now());
  const matching = filterOrders(orders, filter);
  const firstName = seller.user.name.split(' ')[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Welcome back, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-brand-gray">An overview of {seller.businessName}: customers, sales performance and revenue.</p>
        </div>
        <a
          href="/api/seller/reports?type=orders&range=30"
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-soft hover:border-accent hover:text-accent"
        >
          <Download className="h-4 w-4" />
          Export report
        </a>
      </div>

      <SellerTopNav current="/seller/dashboard" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Total Sales" value={summary.totals.sales.toLocaleString('en-IN')} icon={ShoppingBag} change={summary.changes.sales} />
        <KpiCard label="Total Revenue" value={pkr(summary.totals.revenue)} icon={Wallet} change={summary.changes.revenue} />
        <KpiCard label="Active Customers" value={summary.totals.activeCustomers.toLocaleString('en-IN')} icon={Users} change={summary.changes.customers} />
        <KpiCard label="Cancelled Orders" value={summary.totals.cancelled.toLocaleString('en-IN')} icon={XCircle} change={summary.changes.cancelled} goodWhenDown />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[3fr_2fr]">
        <Panel title="Revenue Overview" action={{ href: '/seller/sales', label: 'Details' }}>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <p className="text-3xl font-bold text-ink">{pkr(summary.yearRevenue)}</p>
            <Change value={summary.changes.month} suffix="this month vs last" />
          </div>
          <MonthlyBars months={summary.months} />
        </Panel>

        <Panel title="Success Rate">
          <SuccessGauge percent={summary.successRate} />
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-brand-light p-3">
              <p className="text-xs text-brand-gray">Orders received</p>
              <p className="font-bold text-ink">{summary.totals.orders.toLocaleString('en-IN')}</p>
            </div>
            <div className="rounded-xl bg-brand-light p-3">
              <p className="text-xs text-brand-gray">New customers this week</p>
              <p className="font-bold text-ink">{summary.newCustomersThisWeek}</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[3fr_2fr]">
        <Panel title="Recent Orders" action={{ href: '/seller/all-orders', label: 'View all' }}>
          <OrderFilters action="/seller/dashboard" q={filter.q} status={filter.status} category={filter.category} categories={categoriesOf(orders)} />
          <OrdersTable orders={matching.slice(0, RECENT)} empty={orders.length === 0 ? 'No orders yet. They appear here as soon as a customer orders.' : 'No order matches this search.'} />
        </Panel>

        <Panel title="Sales Overview">
          {summary.payments.length === 0 ? (
            <p className="rounded-xl bg-brand-light p-4 text-sm text-brand-gray">Completed orders will show here.</p>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {summary.payments.slice(0, 3).map((payment, index) => (
                  <div key={payment.method}>
                    <p className="flex items-center gap-1.5 text-xs text-brand-gray">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stripeColor(index) }} />
                      <span className="truncate">{payment.label}</span>
                    </p>
                    <p className="text-lg font-bold text-ink">{payment.percent.toFixed(1)}%</p>
                  </div>
                ))}
              </div>
              <StripeBar parts={summary.payments} />
              <div className="mt-5">
                <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-3 text-xs font-semibold text-brand-gray">
                  <span>Product</span>
                  <span className="w-12 text-right">Share</span>
                  <span className="w-20 text-right">Earnings</span>
                </div>
                <ul className="space-y-2.5 text-sm">
                  {summary.products.slice(0, 5).map((product) => (
                    <li key={product.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                      <span className="truncate font-semibold text-ink">{product.name}</span>
                      <span className="w-12 text-right text-brand-gray">{Math.round(product.percent)}%</span>
                      <span className="w-20 text-right font-semibold text-ink">{pkr(product.revenue)}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/seller/sales" className="mt-3 inline-block text-xs font-semibold text-accent hover:underline">
                  All products
                </Link>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
