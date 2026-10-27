import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PackageCheck } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { orderRef } from '@/lib/order-number';
import { formatKarachiDateTime } from '@/lib/ban-duration';
import { startOfKarachiDay } from '@/lib/admin-stats';
import AutoRefresh from '@/components/AutoRefresh';

export const metadata = {
  title: 'Orders - Mangwaoo Admin',
};

const RANGES = [
  { key: 'today', label: 'Today', daysBack: 0 },
  { key: '7', label: 'Last 7 days', daysBack: 6 },
  { key: '30', label: 'Last 30 days', daysBack: 29 },
] as const;

const ORDER_LIST_LIMIT = 300;
const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-warning',
  CONFIRMED: 'bg-blue-50 text-info',
  PREPARING: 'bg-blue-50 text-info',
  OUT_FOR_DELIVERY: 'bg-purple-50 text-purple-700',
  DELIVERED: 'bg-green-50 text-success',
  CANCELLED: 'bg-red-50 text-danger',
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: 'Cash on Delivery',
  WALLET: 'EasyPaisa / JazzCash',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
};

type OrderRow = {
  id: string;
  ref: string;
  marketplace: 'MangwaooMart' | 'Food';
  createdAt: Date;
  status: string;
  seller: string;
  customer: string;
  itemCount: number;
  items: number;
  discount: number;
  delivery: number;
  payment: string | null;
};

const pkr = (amount: number) => `PKR ${amount.toLocaleString('en-US')}`;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const { range: rawRange } = await searchParams;
  const range = RANGES.find((candidate) => candidate.key === rawRange) ?? RANGES[0];
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const since = new Date(startOfKarachiDay(Date.now()) - range.daysBack * DAY_MS);
  const include = {
    seller: { select: { businessName: true } },
    customer: { select: { user: { select: { name: true } } } },
    payment: { select: { method: true } },
    items: { select: { quantity: true } },
  } as const;

  const [martOrders, foodOrders, martCount, foodCount] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: ORDER_LIST_LIMIT, include }),
    prisma.gulplazaOrder.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: ORDER_LIST_LIMIT, include }),
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.gulplazaOrder.count({ where: { createdAt: { gte: since } } }),
  ]);

  const all: OrderRow[] = [
    ...martOrders.map((order) => ({
      id: order.id,
      ref: orderRef('mart', order.orderNumber),
      marketplace: 'MangwaooMart' as const,
      createdAt: order.createdAt,
      status: order.status,
      seller: order.seller.businessName,
      customer: order.customer.user.name,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      items: Number(order.totalAmount),
      discount: Number(order.discountAmount),
      delivery: 0,
      payment: order.payment?.method ?? null,
    })),
    ...foodOrders.map((order) => ({
      id: order.id,
      ref: orderRef('gulplaza', order.orderNumber),
      marketplace: 'Food' as const,
      createdAt: order.createdAt,
      status: order.status,
      seller: order.seller.businessName,
      customer: order.customer.user.name,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      items: Number(order.totalAmount),
      discount: Number(order.discountAmount),
      delivery: Number(order.deliveryFee),
      payment: order.payment?.method ?? null,
    })),
  ];

  const orders = all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, ORDER_LIST_LIMIT);
  const total = martCount + foodCount;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <AutoRefresh />

      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <PackageCheck className="h-4 w-4" />
        Admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Orders</h1>
      <p className="mb-6 max-w-3xl text-brand-gray">
        Every MangwaooMart and food order placed in the period. The amount is what the customer pays: items minus any coupon,
        plus the delivery fee on food.
      </p>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Period">
        {RANGES.map((candidate) => (
          <Link
            key={candidate.key}
            href={`/admin/orders?range=${candidate.key}`}
            aria-current={candidate.key === range.key ? 'true' : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              candidate.key === range.key ? 'bg-brand-dark text-white' : 'bg-surface text-ink shadow-soft hover:text-accent'
            }`}
          >
            {candidate.label}
          </Link>
        ))}
      </div>

      <p className="mb-3 text-sm text-brand-gray">
        {total === 0
          ? ''
          : total > orders.length
            ? `Showing the newest ${orders.length} of ${total} orders.`
            : `${total} ${total === 1 ? 'order' : 'orders'}`}
      </p>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-surface p-10 text-center text-sm text-brand-gray">
          No orders {range.key === 'today' ? 'have been placed today' : 'in this period'}.
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const pays = order.items - order.discount + order.delivery;

            return (
              <li key={`${order.marketplace}-${order.id}`} className="rounded-2xl border border-gray-100 bg-surface p-4 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      Order {order.ref}
                      <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-gray">{order.marketplace}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[order.status] ?? 'bg-gray-50 text-brand-gray'}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-ink">
                      {order.customer} <span className="text-brand-gray">ordered from</span> {order.seller}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-gray">
                      {formatKarachiDateTime(order.createdAt)} · {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                      {order.payment ? ` · ${PAYMENT_LABELS[order.payment] ?? order.payment}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-accent">{pkr(pays)}</p>
                    {order.discount > 0 || order.delivery > 0 ? (
                      <p className="text-xs text-brand-gray">
                        Items {pkr(order.items)}
                        {order.discount > 0 ? ` − coupon ${pkr(order.discount)}` : ''}
                        {order.delivery > 0 ? ` + delivery ${pkr(order.delivery)}` : ''}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
