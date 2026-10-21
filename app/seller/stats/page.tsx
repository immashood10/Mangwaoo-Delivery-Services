import Link from 'next/link';
import { BarChart3, ClipboardList, Heart, Package, PackageCheck, ShoppingCart, Wallet, type LucideIcon } from 'lucide-react';
import SellerCharts from '@/components/seller/SellerCharts';
import SellerPageHeader from '@/components/seller/SellerPageHeader';
import { SELLER_PAGES } from '@/lib/notification-types';
import { requireSeller } from '@/lib/seller-context';
import { STATS_RANGES, getSellerStats, parseStatsRange } from '@/lib/seller-stats';

function StatCard({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-2 text-sm text-brand-gray">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red-primary/10 text-accent">
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </div>
      <p className="text-2xl font-bold text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-brand-gray">{hint}</p> : null}
    </div>
  );
}

export default async function SellerStatsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const seller = await requireSeller();
  const { range } = await searchParams;
  const rangeDays = parseStatsRange(range);
  const stats = await getSellerStats(seller, rangeDays);
  const { totals } = stats;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <SellerPageHeader
        icon={BarChart3}
        title="Your stats"
        description="How many products you've sold, what they earned, and your best sellers. A product counts as sold once its order is marked delivered."
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          icon={PackageCheck}
          label="Products sold"
          value={totals.unitsSold.toLocaleString()}
          hint={`${totals.deliveredOrders.toLocaleString()} delivered ${totals.deliveredOrders === 1 ? 'order' : 'orders'}`}
        />
        <StatCard icon={Wallet} label="Sales" value={`PKR ${Math.round(totals.revenue).toLocaleString()}`} hint="From delivered orders" />
        <StatCard
          icon={ClipboardList}
          label="Orders in progress"
          value={totals.inProgressOrders.toLocaleString()}
          hint={totals.cancelledOrders > 0 ? `${totals.cancelledOrders} cancelled so far` : undefined}
        />
        <StatCard icon={Package} label="Products listed" value={stats.activeProducts.toLocaleString()} />
        <StatCard icon={ShoppingCart} label="In customers' carts now" value={stats.inCarts.toLocaleString()} hint="Not ordered yet" />
        {stats.likes !== null ? <StatCard icon={Heart} label="Likes on your ads" value={stats.likes.toLocaleString()} /> : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Sales</h2>
        <div className="flex rounded-full bg-surface p-1 shadow-soft" role="group" aria-label="Date range">
          {STATS_RANGES.map((option) => (
            <Link
              key={option}
              href={`${SELLER_PAGES.stats}?range=${option}`}
              scroll={false}
              aria-current={option === rangeDays ? 'true' : undefined}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                option === rangeDays ? 'bg-brand-dark text-white' : 'text-brand-gray hover:text-ink'
              }`}
            >
              Last {option} days
            </Link>
          ))}
        </div>
      </div>

      <SellerCharts stats={stats} />
    </div>
  );
}
