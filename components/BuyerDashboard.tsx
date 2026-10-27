'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, MapPin, Banknote, Smartphone, XCircle, PackageSearch, History as HistoryIcon, MessageSquare, Star, ChevronRight } from 'lucide-react';
import MessagesInbox from './MessagesInbox';

type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  price: number;
};

type Order = {
  id: string;
  marketplace: 'mart' | 'gulplaza';
  status: string;
  /** The items. What the customer pays is this minus the coupon discount plus the delivery fee (food only). */
  totalAmount: number;
  deliveryFee: number;
  discountAmount: number;
  couponCode: string | null;
  createdAt: string;
  sellerName: string;
  address: string;
  paymentMethod: string | null;
  paymentStatus: string | null;
  items: OrderItem[];
};

/** A recent delivery whose rider the customer has not rated yet. */
type RatePrompt = {
  chatId: string;
  riderName: string;
  deliveredAt: string;
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-warning',
  CONFIRMED: 'bg-blue-50 text-info',
  PREPARING: 'bg-blue-50 text-info',
  OUT_FOR_DELIVERY: 'bg-purple-50 text-purple-700',
  DELIVERED: 'bg-green-50 text-success',
  CANCELLED: 'bg-red-50 text-danger',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: 'Cash on Delivery',
  WALLET: 'EasyPaisa / JazzCash',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
};

const CANCELLABLE_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING'];
const HISTORY_STATUSES = ['DELIVERED', 'CANCELLED'];

const TABS = [
  { id: 'orders', label: 'Orders', icon: PackageSearch },
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
] as const;

type TabId = (typeof TABS)[number]['id'];

function OrderCard({ order, onCancelled }: { order: Order; onCancelled: () => void }) {
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order?')) return;

    setIsCancelling(true);

    try {
      const endpoint =
        order.marketplace === 'mart' ? `/api/orders/${order.id}/cancel` : `/api/gulplaza-orders/${order.id}/cancel`;
      const response = await fetch(endpoint, { method: 'PATCH' });
      if (response.ok) {
        onCancelled();
      }
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            Order #{order.id.slice(-8).toUpperCase()}
            <span className="ml-2 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-gray">
              {order.marketplace === 'mart' ? 'MangwaooMart' : 'Food'}
            </span>
          </p>
          <p className="text-xs text-brand-gray">
            Sold by {order.sellerName} &middot;{' '}
            {new Date(order.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            ORDER_STATUS_STYLES[order.status] ?? 'bg-gray-50 text-brand-gray'
          }`}
        >
          {order.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="flex items-start gap-2 text-xs text-brand-gray mb-3">
        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>{order.address}</span>
      </div>

      <ul className="text-sm text-ink space-y-1 mb-3">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between">
            <span>
              {item.productName} <span className="text-brand-gray">x{item.quantity}</span>
            </span>
            <span className="text-brand-gray">PKR {(item.price * item.quantity).toLocaleString()}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-brand-gray">
          {order.paymentMethod === 'CASH_ON_DELIVERY' ? (
            <Banknote className="w-3.5 h-3.5" />
          ) : (
            <Smartphone className="w-3.5 h-3.5" />
          )}
          {order.paymentMethod ? PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod : 'N/A'}
          {order.paymentStatus ? ` · ${order.paymentStatus}` : ''}
        </span>
        <span className="font-bold text-accent">
          PKR {(order.totalAmount - order.discountAmount + order.deliveryFee).toLocaleString()}
        </span>
      </div>

      {order.discountAmount > 0 || order.deliveryFee > 0 ? (
        <div className="mt-2 space-y-0.5 text-right text-xs text-brand-gray">
          <p>Items PKR {order.totalAmount.toLocaleString()}</p>
          {order.discountAmount > 0 ? (
            <p className="text-success">
              Coupon{order.couponCode ? ` ${order.couponCode}` : ''} − PKR {order.discountAmount.toLocaleString()}
            </p>
          ) : null}
          {order.deliveryFee > 0 ? <p>Delivery + PKR {order.deliveryFee.toLocaleString()}</p> : null}
        </div>
      ) : null}

      {CANCELLABLE_STATUSES.includes(order.status) && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isCancelling}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger hover:underline disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5" />
            {isCancelling ? 'Cancelling…' : 'Cancel order'}
          </button>
        </div>
      )}
    </div>
  );
}

/** "How was your rider?" reminders, for customers who closed the rating form after a delivery. */
function RatePrompts({ prompts }: { prompts: RatePrompt[] }) {
  if (prompts.length === 0) return null;

  return (
    <section aria-label="Rate your rider" className="mb-6 space-y-2">
      {prompts.map((prompt) => (
        <Link
          key={prompt.chatId}
          href={`/rate-rider/${prompt.chatId}`}
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition hover:border-accent"
        >
          <Star className="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-sm text-ink">
            <span className="block truncate font-semibold">How was {prompt.riderName}&apos;s delivery?</span>
            <span className="block text-xs text-brand-gray">
              Delivered {new Date(prompt.deliveredAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Karachi' })} · tap to rate your rider
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-brand-gray" aria-hidden="true" />
        </Link>
      ))}
    </section>
  );
}

export default function BuyerDashboard({
  customerName,
  orders,
  ratePrompts = [],
  initialTab = 'orders',
}: {
  customerName: string;
  orders: Order[];
  ratePrompts?: RatePrompt[];
  initialTab?: TabId;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const activeOrders = orders.filter((order) => !HISTORY_STATUSES.includes(order.status));
  const historyOrders = orders.filter((order) => HISTORY_STATUSES.includes(order.status));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink">My Account</h1>
          <p className="text-brand-gray">{customerName}</p>
        </div>
      </div>

      <div className="mb-8 flex gap-2 border-b border-gray-100">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-brand-gray hover:text-ink'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.id === 'orders' && activeOrders.length > 0 && (
              <span className="rounded-full bg-brand-red-primary/10 px-2 py-0.5 text-xs text-accent">
                {activeOrders.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'orders' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <RatePrompts prompts={ratePrompts} />
          {activeOrders.length === 0 ? (
            <p className="text-brand-gray text-sm">
              No active orders. Items you order from MangwaooMart or Food will show up here.
            </p>
          ) : (
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <OrderCard key={order.id} order={order} onCancelled={() => router.refresh()} />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'history' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {historyOrders.length === 0 ? (
            <p className="text-brand-gray text-sm">
              No past orders yet. Delivered and cancelled orders will show up here.
            </p>
          ) : (
            <div className="space-y-4">
              {historyOrders.map((order) => (
                <OrderCard key={order.id} order={order} onCancelled={() => router.refresh()} />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'messages' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <MessagesInbox currentRole="CUSTOMER" />
        </motion.div>
      )}
    </div>
  );
}
