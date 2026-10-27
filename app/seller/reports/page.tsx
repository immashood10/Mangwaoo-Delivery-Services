import Link from 'next/link';
import { Download, FileText, Package, Users } from 'lucide-react';
import { KpiCard, Panel, SellerTopNav, pkr } from '@/components/seller/SellerAnalyticsUi';
import { loadSellerOrders, summarizeSales } from '@/lib/seller-analytics';
import { requireSeller } from '@/lib/seller-context';
import { REPORT_RANGES, parseReportRange } from '@/lib/seller-reports';
import { ShoppingBag, Wallet } from 'lucide-react';

export const metadata = { title: 'Reports - Mangwaoo Seller' };

const DAY_MS = 24 * 60 * 60 * 1000;

const REPORTS = [
  { type: 'orders', title: 'Orders', text: 'Every order: ID, date, status, customer, products, payment and amount.', icon: FileText },
  { type: 'products', title: 'Products', text: 'What you sold per product, its share of your revenue and what it earned.', icon: Package },
  { type: 'customers', title: 'Customers', text: 'Each customer with their orders, what they spent and their last order.', icon: Users },
] as const;

export default async function SellerReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const seller = await requireSeller();
  const range = parseReportRange((await searchParams).range);
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const now = Date.now();
  const since = range.days === null ? 0 : now - range.days * DAY_MS;
  const orders = (await loadSellerOrders(seller)).filter((order) => order.createdAt.getTime() >= since);
  const summary = summarizeSales(orders, now);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-1 text-2xl font-bold text-ink md:text-3xl">Reports</h1>
      <p className="mb-6 text-sm text-brand-gray">Download your numbers as a spreadsheet file (CSV: opens in Excel and Google Sheets).</p>

      <SellerTopNav current="/seller/reports" />

      <div className="mb-6 flex rounded-full bg-surface p-1 shadow-soft sm:w-fit" role="group" aria-label="Period">
        {REPORT_RANGES.map((option) => (
          <Link
            key={option.key}
            href={`/seller/reports?range=${option.key}`}
            scroll={false}
            aria-current={option.key === range.key ? 'true' : undefined}
            className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-center text-xs font-semibold transition sm:flex-none ${
              option.key === range.key ? 'bg-brand-dark text-white' : 'text-brand-gray hover:text-ink'
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Orders in this period" value={summary.totals.orders.toLocaleString('en-IN')} icon={ShoppingBag} note={range.label} />
        <KpiCard label="Delivered" value={summary.totals.sales.toLocaleString('en-IN')} icon={Package} note={range.label} />
        <KpiCard label="Revenue" value={pkr(summary.totals.revenue)} icon={Wallet} note="From delivered orders" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {REPORTS.map(({ type, title, text, icon: Icon }) => (
          <Panel key={type} title={`${title} report`}>
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red-primary/10 text-accent">
              <Icon className="h-5 w-5" />
            </span>
            <p className="mb-4 text-sm text-brand-gray">{text}</p>
            <a
              href={`/api/seller/reports?type=${type}&range=${range.key}`}
              className="inline-flex items-center gap-2 rounded-full bg-brand-dark px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </a>
          </Panel>
        ))}
      </div>
    </div>
  );
}
