import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bike,
  Crown,
  Flag,
  Package,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isSuperAdminLogin } from '@/lib/super-admin';
import { SUPER_RANGES, getSuperAdminData, parseSuperRange } from '@/lib/super-admin-stats';
import AutoRefresh from '@/components/AutoRefresh';
import { SalesAreaChart, VendorDonut } from '@/components/SuperAdminCharts';

export const metadata = {
  title: 'Super Overview - Mangwaoo Admin',
};

const pkr = (value: number) => `PKR ${Math.round(value).toLocaleString('en-IN')}`;

const STATUS_STYLES: Record<string, string> = {
  Completed: 'bg-green-50 text-success',
  Processing: 'bg-blue-50 text-info',
  'On the way': 'bg-amber-50 text-warning',
  Cancelled: 'bg-red-50 text-danger',
};

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' });
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <p className="mt-2 text-xs text-brand-gray">New this week</p>;

  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${up ? 'text-success' : 'text-danger'}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value)}%<span className="font-normal text-brand-gray">vs last 7 days</span>
    </p>
  );
}

function Kpi({ label, value, icon: Icon, change, href }: { label: string; value: string; icon: LucideIcon; change?: number | null; href?: string }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-brand-gray">{label}</p>
          <p className="mt-1 break-words text-xl font-bold leading-tight text-ink">{value}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {change !== undefined ? <Change value={change} /> : <p className="mt-2 text-xs text-brand-gray">All time</p>}
    </>
  );
  const className = 'block rounded-2xl bg-surface p-4 shadow-soft transition hover:shadow-md';

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Card({ title, action, children }: { title: string; action?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-bold text-ink">{title}</h2>
        {action ? (
          <Link href={action.href} className="text-xs font-semibold text-accent hover:underline">
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default async function SuperOverviewPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  // Only the "superadmin" account sees this page; any other admin goes to the normal dashboard.
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } });

  if (!isSuperAdminLogin(me?.email)) {
    redirect('/admin');
  }

  const rangeDays = parseSuperRange((await searchParams).range);
  const data = await getSuperAdminData(rangeDays);
  const vendorTotal = data.vendorCounts.active + data.vendorCounts.pending + data.vendorCounts.banned;
  const percent = (value: number) => (vendorTotal > 0 ? `${((value / vendorTotal) * 100).toFixed(1)}%` : '0%');
  const vendorSegments = [
    { label: 'Active', value: data.vendorCounts.active, color: 'var(--success)' },
    { label: 'Waiting for approval', value: data.vendorCounts.pending, color: 'var(--warning)' },
    { label: 'Banned', value: data.vendorCounts.banned, color: 'var(--danger)' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <AutoRefresh />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
            <Crown className="h-4 w-4" />
            Super admin
          </div>
          <h1 className="text-3xl font-bold text-ink">Super Overview</h1>
          <p className="text-brand-gray">Everything happening on Mangwaoo: sales, orders, vendors, customers and riders. Updates every 30 seconds.</p>
        </div>
        <div className="flex rounded-full bg-surface p-1 shadow-soft" role="group" aria-label="Date range">
          {SUPER_RANGES.map((range) => (
            <Link
              key={range}
              href={`/admin/super?range=${range}`}
              scroll={false}
              aria-current={range === rangeDays ? 'true' : undefined}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${range === rangeDays ? 'bg-brand-dark text-white' : 'text-brand-gray hover:text-ink'}`}
            >
              Last {range} days
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <Kpi label="Total Sales" value={pkr(data.totals.sales)} icon={Wallet} change={data.growth.sales} />
        <Kpi label="Total Orders" value={data.totals.orders.toLocaleString('en-IN')} icon={ShoppingCart} change={data.growth.orders} href="/admin/orders" />
        <Kpi label="Total Vendors" value={data.totals.vendors.toLocaleString('en-IN')} icon={Store} change={data.growth.vendors} href="/admin/users?view=sellers" />
        <Kpi label="Total Customers" value={data.totals.customers.toLocaleString('en-IN')} icon={Users} change={data.growth.customers} href="/admin/users?view=customers" />
        <Kpi label="Total Riders" value={data.totals.riders.toLocaleString('en-IN')} icon={Bike} href="/admin/users?view=riders" />
        <Kpi label="Total Products" value={data.totals.products.toLocaleString('en-IN')} icon={Package} change={data.growth.products} />
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[3fr_2fr]">
            <Card title="Sales Overview">
              <p className="-mt-2 mb-3 text-sm text-brand-gray">
                <span className="font-bold text-ink">{pkr(data.rangeSales)}</span> in the last {rangeDays} days
              </p>
              <SalesAreaChart days={data.days} />
            </Card>

            <Card title="Recent Orders" action={{ href: '/admin/orders', label: 'View all' }}>
              {data.recentOrders.length === 0 ? (
                <p className="text-sm text-brand-gray">No orders yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data.recentOrders.map((order) => (
                    <li key={order.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{order.ref}</p>
                        <p className="truncate text-xs text-brand-gray">{order.vendor}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-success">{pkr(order.amount)}</p>
                        <p className="text-xs text-brand-gray">{timeAgo(order.createdAt)}</p>
                      </div>
                      <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${STATUS_STYLES[order.status]}`}>{order.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_3fr]">
            <Card title="Vendor Overview">
              <div className="flex flex-wrap items-center gap-6">
                <VendorDonut segments={vendorSegments} />
                <ul className="min-w-0 flex-1 space-y-3 text-sm">
                  {vendorSegments.map((segment) => (
                    <li key={segment.label} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-ink">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: segment.color }} />
                        {segment.label}
                      </span>
                      <span className="text-brand-gray">
                        <span className="font-semibold text-ink">{segment.value}</span> ({percent(segment.value)})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <Card title="Recent Registrations" action={{ href: '/admin/users', label: 'View all' }}>
              {data.recentUsers.length === 0 ? (
                <p className="text-sm text-brand-gray">Nobody has joined yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data.recentUsers.map((user) => (
                    <li key={user.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{user.name}</p>
                        <p className="truncate text-xs text-brand-gray">{user.email}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs capitalize text-brand-gray">{user.role.toLowerCase()}</p>
                        <p className="text-xs text-brand-gray">{timeAgo(user.createdAt)}</p>
                      </div>
                      <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${user.pending ? 'bg-amber-50 text-warning' : 'bg-green-50 text-success'}`}>
                        {user.pending ? 'Pending' : 'Active'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>

        <aside className="grid grid-cols-1 content-start gap-6 md:grid-cols-2 2xl:grid-cols-1">
          <Card title="Top Vendors" action={{ href: '/admin/users?view=sellers', label: 'View all' }}>
            {data.topVendors.length === 0 ? (
              <p className="text-sm text-brand-gray">No sales yet.</p>
            ) : (
              <ol className="space-y-3">
                {data.topVendors.map((vendor, index) => (
                  <li key={vendor.id} className="flex items-center gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-red-primary/10 text-xs font-bold text-accent">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{vendor.name}</p>
                      <p className="text-xs text-brand-gray">{vendor.orders} orders</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-ink">{pkr(vendor.sales)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="System Overview">
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3 rounded-xl bg-brand-light p-3">
                <TrendingUp className="h-5 w-5 shrink-0 text-accent" />
                <div>
                  <p className="text-xs text-brand-gray">Mangwaoo revenue (rider commission)</p>
                  <p className="font-bold text-ink">{pkr(data.system.revenue)}</p>
                </div>
              </li>
              <li className="flex items-center gap-3 rounded-xl bg-brand-light p-3">
                <Wallet className="h-5 w-5 shrink-0 text-warning" />
                <div>
                  <p className="text-xs text-brand-gray">Riders still owe Mangwaoo</p>
                  <p className="font-bold text-ink">{pkr(data.system.owedByRiders)}</p>
                </div>
              </li>
              <li>
                <Link href="/admin/rider-reviews" className="flex items-center gap-3 rounded-xl bg-brand-light p-3 transition hover:shadow-sm">
                  <Flag className="h-5 w-5 shrink-0 text-danger" />
                  <div>
                    <p className="text-xs text-brand-gray">Open rider complaints</p>
                    <p className="font-bold text-ink">{data.system.openComplaints}</p>
                  </div>
                </Link>
              </li>
              <li className="flex items-center gap-3 rounded-xl bg-brand-light p-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
                <div>
                  <p className="text-xs text-brand-gray">System status</p>
                  <p className="font-bold text-ink">All systems operational</p>
                </div>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
