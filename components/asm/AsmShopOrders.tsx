import { Bike, MapPin } from 'lucide-react';
import OrderStatusButtons from '@/components/OrderStatusButtons';
import type { FulfillmentOrder } from '@/lib/order-fulfillment';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-warning',
  CONFIRMED: 'bg-blue-50 text-info',
  PREPARING: 'bg-blue-50 text-info',
  OUT_FOR_DELIVERY: 'bg-purple-50 text-purple-700',
  DELIVERED: 'bg-green-50 text-success',
  CANCELLED: 'bg-red-50 text-danger',
};

const pkr = (amount: number) => `PKR ${Math.round(amount).toLocaleString('en-PK')}`;
const when = (iso: string) => new Date(iso).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' });

/**
 * The shop orders (food and MangwaooMart) of the manager's area, waiting ones first. The manager moves each one along (accept,
 * preparing, given to the rider, delivered) or cancels it: the vendors only watch.
 */
export default function AsmShopOrders({ orders, apiBase = '/api/asm/orders' }: { orders: FulfillmentOrder[]; apiBase?: string }) {
  if (orders.length === 0) {
    return <p className="rounded-2xl bg-surface p-8 text-center text-sm text-brand-gray shadow-soft">No shop orders in your area right now.</p>;
  }

  return (
    <ul className="space-y-3">
      {orders.map((order) => (
        <li key={`${order.kind}-${order.id}`} className="rounded-2xl bg-surface p-5 shadow-soft" data-order-ref={order.ref} data-status={order.status}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                Order {order.ref}
                <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-gray">{order.kind === 'MART' ? 'MangwaooMart' : 'Food'}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[order.status] ?? 'bg-gray-50 text-brand-gray'}`}>{order.status.replace(/_/g, ' ')}</span>
              </p>
              <p className="mt-1 text-sm text-ink">
                {order.customerName} <span className="text-brand-gray">ordered from</span> {order.storeName}
              </p>
              <p className="mt-0.5 text-xs text-brand-gray">{when(order.createdAt)}</p>
            </div>
            <p className="text-lg font-bold text-accent">{pkr(order.total)}</p>
          </div>

          <p className="mt-2 flex items-start gap-1.5 text-xs text-brand-gray">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{order.address}</span>
          </p>
          {order.note ? <p className="mt-2 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-warning">Customer note: {order.note}</p> : null}

          <ul className="mt-3 space-y-0.5 text-sm text-ink">
            {order.items.map((item, index) => (
              <li key={index}>
                {item.name} <span className="text-brand-gray">x{item.quantity}</span>
              </li>
            ))}
          </ul>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-brand-gray">
            <Bike className="h-3.5 w-3.5" aria-hidden="true" />
            {order.vendorFulfilled ? `Vendor delivery: ${order.deliveryMinDays}${order.deliveryMaxDays !== order.deliveryMinDays ? '-' + order.deliveryMaxDays : ''} days` : order.riderName ? `Rider: ${order.riderName}` : 'Waiting for rider assignment'}
          </p>

          <OrderStatusButtons apiBase={apiBase} kind={order.kind} id={order.id} orderRef={order.ref} status={order.status} vendorFulfilled={order.vendorFulfilled} />
        </li>
      ))}
    </ul>
  );
}
