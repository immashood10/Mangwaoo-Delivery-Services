// Pieces shared by the seller's Dashboard, Sales, Customers, Orders and Reports pages. Server-rendered (plain SVG and
// HTML, nothing to load in the browser); colours are the site's theme variables so dark mode follows.
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { niceMax, shortMoney } from '@/components/SuperAdminCharts';
import { ORDER_STATUS_FILTERS, productsLabel, statusLabel, type AnalyticsOrder } from '@/lib/seller-analytics';

export const pkr = (value: number) => `PKR ${Math.round(value).toLocaleString('en-IN')}`;

export const SELLER_NAV = [
  { href: '/seller/dashboard', label: 'Dashboard' },
  { href: '/seller/sales', label: 'Sales' },
  { href: '/seller/customers', label: 'Customers' },
  { href: '/seller/reports', label: 'Reports' },
  { href: '/seller/all-orders', label: 'Orders' },
] as const;

/** The pill menu at the top of the five analytics pages. */
export function SellerTopNav({ current }: { current: (typeof SELLER_NAV)[number]['href'] }) {
  return (
    <nav className="mb-6 flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1 shadow-soft" aria-label="Seller overview pages">
      {SELLER_NAV.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.href === current ? 'page' : undefined}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            link.href === current ? 'bg-brand-dark text-white' : 'text-brand-gray hover:text-ink'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function Change({ value, suffix = 'vs last week', goodWhenDown = false }: { value: number | null; suffix?: string; goodWhenDown?: boolean }) {
  if (value === null) return <span className="text-xs text-brand-gray">New this week</span>;

  const up = value >= 0;
  const good = goodWhenDown ? !up || value === 0 : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${good ? 'text-success' : 'text-danger'}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value)}%<span className="font-normal text-brand-gray">{suffix}</span>
    </span>
  );
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  change,
  note,
  goodWhenDown,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  change?: number | null;
  note?: string;
  goodWhenDown?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 break-words text-xl font-bold leading-tight text-ink sm:mt-4 sm:text-3xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      <div className="mt-3">
        {change !== undefined ? <Change value={change} goodWhenDown={goodWhenDown} /> : <span className="text-xs text-brand-gray">{note ?? 'All time'}</span>}
      </div>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-2xl bg-surface p-5 shadow-soft ${className}`}>
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

// ── Monthly revenue bars ────────────────────────────────────

export function MonthlyBars({ months }: { months: { label: string; fullLabel: string; sales: number; revenue: number }[] }) {
  const W = 640;
  const H = 240;
  const pad = { left: 52, right: 8, top: 10, bottom: 26 };
  const max = niceMax(Math.max(...months.map((month) => month.revenue), 0));
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const slot = innerW / months.length;
  const barW = slot * 0.55;
  const y = (value: number) => pad.top + innerH - (value / max) * innerH;
  const best = months.reduce((top, month, index) => (month.revenue > months[top].revenue ? index : top), 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Revenue per month">
      {[0, 1, 2, 3, 4].map((step) => {
        const tick = (max / 4) * step;
        return (
          <g key={step} className="text-brand-gray">
            <line x1={pad.left} x2={W - pad.right} y1={y(tick)} y2={y(tick)} stroke="currentColor" strokeOpacity="0.18" strokeDasharray="3 4" />
            <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="currentColor">
              {shortMoney(tick)}
            </text>
          </g>
        );
      })}
      {months.map((month, index) => {
        const x = pad.left + index * slot + (slot - barW) / 2;
        const top = y(month.revenue);
        const highlight = index === best && month.revenue > 0;
        return (
          <g key={`${month.label}-${index}`} className="text-brand-gray">
            <rect
              x={x}
              y={month.revenue > 0 ? top : y(0) - 2}
              width={barW}
              height={Math.max(2, y(0) - top)}
              rx="4"
              fill={highlight ? 'var(--accent)' : 'currentColor'}
              fillOpacity={highlight ? 1 : 0.25}
            >
              <title>{`${month.fullLabel}: ${pkr(month.revenue)} from ${month.sales} ${month.sales === 1 ? 'sale' : 'sales'}`}</title>
            </rect>
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="currentColor">
              {month.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Success-rate gauge ──────────────────────────────────────

const SEGMENTS = 14;

function sector(cx: number, cy: number, inner: number, outer: number, from: number, to: number) {
  const point = (radius: number, angle: number) => `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  return `M${point(outer, from)} A${outer},${outer} 0 0 1 ${point(outer, to)} L${point(inner, to)} A${inner},${inner} 0 0 0 ${point(inner, from)} Z`;
}

export function SuccessGauge({ percent }: { percent: number | null }) {
  const filled = percent === null ? 0 : Math.round((percent / 100) * SEGMENTS);
  const gap = 0.025;
  const step = Math.PI / SEGMENTS;

  return (
    <div className="relative mx-auto w-full max-w-xs">
      <svg
        viewBox="0 0 240 130"
        className="h-auto w-full"
        role="img"
        aria-label={percent === null ? 'No finished orders yet' : `${percent}% of finished orders were delivered`}
      >
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <path
            key={index}
            d={sector(120, 120, 62, 110, Math.PI + index * step + gap, Math.PI + (index + 1) * step - gap)}
            fill={index < filled ? 'var(--success)' : 'currentColor'}
            fillOpacity={index < filled ? 0.35 + (0.65 * (index + 1)) / Math.max(filled, 1) : 0.12}
            className="text-brand-gray"
          />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <p className="text-3xl font-bold text-ink">{percent === null ? '–' : `${percent}%`}</p>
        <p className="text-xs text-brand-gray">Delivered of finished orders</p>
      </div>
    </div>
  );
}

// ── Striped share bar (payment methods) ─────────────────────

const STRIPE_COLORS = ['var(--accent)', 'var(--warning)', 'var(--success)', 'var(--info)'];

export const stripeColor = (index: number) => STRIPE_COLORS[index % STRIPE_COLORS.length];

export function StripeBar({ parts }: { parts: { percent: number }[] }) {
  const total = 32;
  const shown = parts.slice(0, 4);
  // Whole stripes per part; the last part takes what is left so there are always exactly `total`.
  const counts = shown.map((part) => Math.round((part.percent / 100) * total));
  if (counts.length > 0) counts[counts.length - 1] = Math.max(0, total - counts.slice(0, -1).reduce((sum, count) => sum + count, 0));
  const stripes = counts.flatMap((count, index) => Array.from({ length: count }, () => STRIPE_COLORS[index]));

  return (
    <div className="flex h-8 gap-[3px] text-brand-gray" aria-hidden="true">
      {(stripes.length > 0 ? stripes : Array.from({ length: total }, () => '')).map((color, index) => (
        <span key={index} className="flex-1 rounded-sm" style={{ background: color || 'currentColor', opacity: color ? 1 : 0.12 }} />
      ))}
    </div>
  );
}

// ── Orders table ────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  Completed: 'bg-green-50 text-success',
  Pending: 'bg-blue-50 text-info',
  Preparing: 'bg-amber-50 text-warning',
  'On the way': 'bg-amber-50 text-warning',
  Cancelled: 'bg-red-50 text-danger',
};

export function StatusBadge({ status }: { status: string }) {
  const label = statusLabel(status);
  return <span className={`inline-block rounded-md px-2 py-1 text-[11px] font-semibold ${STATUS_STYLES[label]}`}>{label}</span>;
}

const date = (value: Date) => value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });
const PAYMENT_SHORT: Record<string, string> = { CASH_ON_DELIVERY: 'Cash', BANK_TRANSFER: 'Bank', CARD: 'Card', WALLET: 'Wallet' };

export function OrdersTable({ orders, empty = 'No orders yet.' }: { orders: AnalyticsOrder[]; empty?: string }) {
  if (orders.length === 0) return <p className="rounded-xl bg-brand-light p-4 text-sm text-brand-gray">{empty}</p>;

  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-brand-gray">
            <th className="py-2 pr-3 font-semibold">Order ID</th>
            <th className="py-2 pr-3 font-semibold">Products</th>
            <th className="py-2 pr-3 font-semibold">Customer</th>
            <th className="py-2 pr-3 font-semibold">Date</th>
            <th className="py-2 pr-3 font-semibold">Payment</th>
            <th className="py-2 pr-3 text-right font-semibold">Amount</th>
            <th className="py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-gray-50 last:border-0">
              <td className="whitespace-nowrap py-3 pr-3 font-semibold text-ink">{order.ref}</td>
              <td className="max-w-[220px] truncate py-3 pr-3 text-ink">{productsLabel(order)}</td>
              <td className="max-w-[160px] truncate py-3 pr-3 text-ink">{order.customerName}</td>
              <td className="whitespace-nowrap py-3 pr-3 text-brand-gray">{date(order.createdAt)}</td>
              <td className="whitespace-nowrap py-3 pr-3 text-brand-gray">{PAYMENT_SHORT[order.payment ?? ''] ?? '–'}</td>
              <td className="whitespace-nowrap py-3 pr-3 text-right font-semibold text-ink">{pkr(order.revenue)}</td>
              <td className="py-3">
                <StatusBadge status={order.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Search + category + status as a plain GET form (works without any script). */
export function OrderFilters({
  action,
  q,
  status,
  category,
  categories,
}: {
  action: string;
  q?: string;
  status?: string;
  category?: string;
  categories: string[];
}) {
  const field = 'rounded-full border border-gray-200 bg-surface px-4 py-2 text-sm text-ink outline-none focus:border-accent';

  return (
    <form action={action} className="mb-4 flex flex-wrap gap-2">
      <input type="search" name="q" defaultValue={q} placeholder="Search order ID, customer, product" className={`${field} min-w-0 flex-1 basis-56`} aria-label="Search orders" />
      <select name="category" defaultValue={category ?? ''} className={field} aria-label="Category">
        <option value="">All categories</option>
        {categories.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select name="status" defaultValue={status ?? ''} className={field} aria-label="Status">
        <option value="">All statuses</option>
        {ORDER_STATUS_FILTERS.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-full bg-brand-dark px-5 py-2 text-sm font-semibold text-white hover:opacity-90">
        Filter
      </button>
    </form>
  );
}
