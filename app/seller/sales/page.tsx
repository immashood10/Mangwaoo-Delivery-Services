import { SalesAreaChart } from '@/components/SuperAdminCharts';
import { KpiCard, MonthlyBars, Panel, SellerTopNav, StripeBar, pkr, stripeColor } from '@/components/seller/SellerAnalyticsUi';
import { loadSellerOrders, summarizeSales } from '@/lib/seller-analytics';
import { requireSeller } from '@/lib/seller-context';
import { ShoppingBag, Wallet, TrendingUp } from 'lucide-react';

export const metadata = { title: 'Sales - Mangwaoo Seller' };

export default async function SellerSalesPage() {
  const seller = await requireSeller();
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const summary = summarizeSales(await loadSellerOrders(seller), Date.now());
  const last30 = summary.days.reduce((sum, day) => sum + day.revenue, 0);
  const average = summary.totals.sales > 0 ? summary.totals.revenue / summary.totals.sales : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-1 text-2xl font-bold text-ink md:text-3xl">Sales</h1>
      <p className="mb-6 text-sm text-brand-gray">What you sold and earned. An order counts as a sale once it is marked delivered.</p>

      <SellerTopNav current="/seller/sales" />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <KpiCard label="Sales (delivered orders)" value={summary.totals.sales.toLocaleString('en-IN')} icon={ShoppingBag} change={summary.changes.sales} />
        <KpiCard label="Revenue, last 30 days" value={pkr(last30)} icon={Wallet} note="From delivered orders" />
        <KpiCard label="Average order" value={pkr(average)} icon={TrendingUp} note="Revenue per delivered order" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Revenue by month (last 12 months)">
          <MonthlyBars months={summary.months} />
        </Panel>
        <Panel title="Revenue by day (last 30 days)">
          <SalesAreaChart days={summary.days.map((day) => ({ label: day.label, sales: day.revenue }))} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[3fr_2fr]">
        <Panel title="Products">
          {summary.products.length === 0 ? (
            <p className="rounded-xl bg-brand-light p-4 text-sm text-brand-gray">No delivered orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-brand-gray">
                    <th className="py-2 pr-3 font-semibold">Product</th>
                    <th className="py-2 pr-3 font-semibold">Category</th>
                    <th className="py-2 pr-3 text-right font-semibold">Sold</th>
                    <th className="py-2 pr-3 text-right font-semibold">Share</th>
                    <th className="py-2 text-right font-semibold">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.products.map((product) => (
                    <tr key={product.name} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 pr-3 font-semibold text-ink">{product.name}</td>
                      <td className="py-3 pr-3 text-brand-gray">{product.category}</td>
                      <td className="py-3 pr-3 text-right text-ink">{product.units}</td>
                      <td className="py-3 pr-3 text-right text-brand-gray">{product.percent.toFixed(1)}%</td>
                      <td className="py-3 text-right font-semibold text-ink">{pkr(product.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Payment methods">
          {summary.payments.length === 0 ? (
            <p className="rounded-xl bg-brand-light p-4 text-sm text-brand-gray">Nothing to show yet.</p>
          ) : (
            <>
              <StripeBar parts={summary.payments} />
              <ul className="mt-4 space-y-3 text-sm">
                {summary.payments.map((payment, index) => (
                  <li key={payment.method} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-ink">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: stripeColor(index) }} />
                      {payment.label}
                    </span>
                    <span className="text-brand-gray">
                      <span className="font-semibold text-ink">{pkr(payment.revenue)}</span> ({payment.percent.toFixed(1)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
