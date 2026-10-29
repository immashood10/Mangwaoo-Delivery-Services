'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Bike, CheckCircle2, ChevronRight, ClipboardList, Clock, Gift, Headset, Inbox, MapPin, MessagesSquare, Power, Wallet } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { RiderRatingLabel } from '@/components/StarRating';
import RiderChatThread from '@/components/RiderChatThread';
import SupportChat from '@/components/SupportChat';
import ManagerMessages from '@/components/rider/ManagerMessages';
import RiderFacePhotoCard from '@/components/rider/RiderFacePhotoCard';
import { holdMessage, useRider } from '@/components/rider/RiderShell';
import type { RiderChatSummary } from '@/lib/rider-chat-types';
import type { RiderHistoryResponse } from '@/lib/rider-history-types';
import { commissionFor, formatPkr, rechargeMessage } from '@/lib/rider-wallet-config';

function PendingApproval() {
  return (
    <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
      <Clock className="mx-auto mb-3 h-10 w-10 text-warning" />
      <h2 className="text-xl font-bold text-ink">Your account is pending approval</h2>
      <p className="mt-2 text-sm text-brand-gray">
        Our team will review your rider account shortly. Once approved, you can go online and receive nearby order requests.
      </p>
    </div>
  );
}

/** Shown while the rider can't receive the next order: unpaid commission (they can fix it) or an admin's block. */
function HoldBanner({ compact = false }: { compact?: boolean }) {
  const { wallet } = useRider();

  if (!wallet.hold) return null;

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div>
          <p className="font-bold text-ink">{wallet.hold === 'PAYMENT' ? 'Please recharge your account' : 'Your account is on hold'}</p>
          <p className="mt-0.5 text-sm text-brand-gray">
            {wallet.hold === 'PAYMENT' ? rechargeMessage(wallet) : holdMessage('ADMIN')}
          </p>
        </div>
      </div>
      {wallet.hold === 'PAYMENT' && !compact ? (
        <Link href="/rider/wallet" className="shrink-0 rounded-full bg-brand-red-primary px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-red-secondary">
          Recharge now
        </Link>
      ) : null}
    </div>
  );
}

function ChatCard({ chat, active, onClick, request = false }: { chat: RiderChatSummary; active: boolean; onClick: () => void; request?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left ${active ? 'border-accent bg-brand-light' : 'border-gray-200 bg-surface hover:border-accent'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-ink">{chat.customerName}</span>
        {request && chat.distanceKm !== undefined ? <span className="text-xs text-brand-gray">{chat.distanceKm.toFixed(1)} km</span> : null}
      </div>
      {chat.lastMessage ? <p className="mt-1 line-clamp-2 text-xs text-brand-gray">{chat.lastMessage}</p> : null}
      <p className="mt-1 flex items-center gap-1 truncate text-xs text-brand-gray">
        <MapPin className="h-3 w-3 shrink-0" />
        {chat.addressText}
      </p>
    </button>
  );
}

/** A glance at the rider's order history on the dashboard (the numbers only; the Order history page has every order). */
function OrdersGlance() {
  const { chats } = useRider();
  const [history, setHistory] = useState<RiderHistoryResponse | null>(null);

  useEffect(() => {
    let ignore = false;

    fetch('/api/rider/history?summary=1', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: RiderHistoryResponse | null) => {
        if (!ignore && body) setHistory(body);
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

  const numbers = [
    { label: 'Delivered', value: history?.summary.delivered, className: 'text-success' },
    { label: 'Cancelled', value: history?.summary.cancelled, className: 'text-danger' },
    // The orders in progress are the order chats the rider has open right now, so this number is always current.
    { label: 'Pending', value: chats.length, className: 'text-warning' },
  ];

  return (
    <Link href="/rider/history" className="group block rounded-2xl bg-surface p-5 shadow-soft transition hover:ring-2 hover:ring-accent">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-bold text-ink">
          <ClipboardList className="h-5 w-5 text-accent" aria-hidden="true" />
          Your orders
        </span>
        <span className="flex items-center gap-1 text-sm font-semibold text-accent">
          Order history
          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {numbers.map((entry) => (
          <div key={entry.label}>
            <p className={`text-2xl font-bold ${entry.className}`}>{entry.value ?? '…'}</p>
            <p className="text-sm text-brand-gray">{entry.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-brand-gray">
        Your rating: {history ? <RiderRatingLabel rating={history.rating} /> : '…'}
      </p>
    </Link>
  );
}

/** Dashboard: the online switch and where to go next. */
export function RiderHome() {
  const { rider, wallet, isOnline, hasLocation, error, toggleOnline, requests, chats } = useRider();
  const owes = wallet.balance < 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
          <Bike className="h-4 w-4" /> Rider
        </div>
        <h1 className="text-3xl font-bold text-ink">Welcome, {rider.name.split(' ')[0]}</h1>
      </div>

      {!rider.isApproved ? (
        <>
          <PendingApproval />
          {!rider.hasFacePhoto ? <RiderFacePhotoCard /> : null}
        </>
      ) : (
        <>
          <HoldBanner />

          <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-brand-gray">Status{rider.vehicleType ? ` · ${rider.vehicleType}` : ''}</p>
              <p className={`mt-1 text-lg font-bold ${isOnline ? 'text-success' : 'text-brand-gray'}`}>
                {isOnline ? (hasLocation ? 'Online · receiving requests' : 'Online · getting your location…') : 'Offline'}
              </p>
              {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
              {isOnline && !error ? <p className="mt-1 text-xs text-brand-gray">Keep the dashboard open to receive order requests.</p> : null}
            </div>
            <button
              type="button"
              onClick={toggleOnline}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ${isOnline ? 'border border-gray-300 text-ink' : 'bg-success text-white'}`}
            >
              <Power className="h-4 w-4" />
              {isOnline ? 'Go offline' : 'Go online'}
            </button>
          </section>

          <div className="grid gap-4 sm:grid-cols-3">
            <Link href="/rider/requests" className="group flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-soft transition hover:ring-2 hover:ring-accent">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-red-primary/10 text-accent">
                <Inbox className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-2xl font-bold text-ink">{requests.length}</span>
                <span className="text-sm text-brand-gray">New requests nearby</span>
              </span>
              <ChevronRight className="h-5 w-5 text-brand-gray group-hover:text-accent" />
            </Link>
            <Link href="/rider/chats" className="group flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-soft transition hover:ring-2 hover:ring-accent">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-red-primary/10 text-accent">
                <MessagesSquare className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-2xl font-bold text-ink">{chats.length}</span>
                <span className="text-sm text-brand-gray">Your order chats</span>
              </span>
              <ChevronRight className="h-5 w-5 text-brand-gray group-hover:text-accent" />
            </Link>
            <Link href="/rider/wallet" className="group flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-soft transition hover:ring-2 hover:ring-accent">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${owes ? 'bg-red-50 text-danger' : 'bg-green-50 text-success'}`}>
                <Wallet className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-2xl font-bold ${owes ? 'text-danger' : 'text-ink'}`}>{formatPkr(Math.abs(wallet.balance))}</span>
                <span className="text-sm text-brand-gray">{owes ? 'You owe Mangwaoo' : wallet.balance > 0 ? 'Credit in your account' : 'Your account is clear'}</span>
              </span>
              <ChevronRight className="h-5 w-5 text-brand-gray group-hover:text-accent" />
            </Link>
          </div>

          <OrdersGlance />
        </>
      )}
    </div>
  );
}

/**
 * What a rider can do with an order they have taken, along the top of its chat:
 * - **Complete order**: the order's delivery charge is already there (the server saved it when the customer checked
 *   out; the rider types nothing), Mangwaoo's commission on it is shown, and on confirming the order ends and the
 *   commission goes on their wallet;
 * - **End chat**: cancels the order (the chat is deleted for both sides, nothing is charged), after a confirmation.
 */
function OrderActions({
  chat,
  onCompleted,
  onEndChat,
}: {
  chat: RiderChatSummary;
  onCompleted: (text: string, onHold: boolean) => void;
  onEndChat: () => void;
}) {
  const { rules } = useRider();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // The charge comes with the order (the server worked it out); this is only for showing it.
  const charge = chat.deliveryCharge;
  const commission = charge > 0 ? commissionFor(charge, rules.commissionPercent) : 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setIsSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/rider-chats/${chat.id}/close`, { method: 'POST' });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Could not complete the order. Please try again.');
        return;
      }

      onCompleted(
        (data?.commission
          ? `Order completed. ${formatPkr(data.commission.amount)} (${data.commission.percent}% of ${formatPkr(data.commission.baseFee)}) was added to what you owe Mangwaoo.`
          : 'Order completed.') +
          (data?.bonus ? ` You earned a ${formatPkr(data.bonus.amount)} bonus, added to your account.` : ''),
        Boolean(data?.commission?.onHold)
      );
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mb-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="w-full min-w-0 truncate text-sm font-semibold text-ink sm:w-auto sm:flex-1">Order chat · {chat.customerName}</p>
        <div className="flex shrink-0 gap-2">
          {!isOpen ? (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <CheckCircle2 className="h-4 w-4" />
              Complete order
            </button>
          ) : null}
          <button
            type="button"
            onClick={onEndChat}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-ink hover:border-red-300 hover:text-danger"
          >
            End chat
          </button>
        </div>
      </div>

      {isOpen ? (
        <form onSubmit={handleSubmit} noValidate className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="font-bold text-ink">Complete this order</p>
          <p className="mt-0.5 text-sm text-brand-gray">Delivered? The delivery charge is already filled in from the order.</p>

          <div className="mt-3 flex items-baseline justify-between gap-3 rounded-xl border border-gray-200 bg-surface px-4 py-2.5">
            <span className="text-sm font-semibold text-ink">Delivery charge</span>
            <span className="text-lg font-bold text-ink">{charge > 0 ? formatPkr(charge) : 'None'}</span>
          </div>
          <p className="mt-1.5 text-xs text-brand-gray">
            {charge > 0
              ? `Mangwaoo keeps ${rules.commissionPercent}%${commission > 0 ? `: ${formatPkr(commission)} on this order` : ''}, which is added to your account.`
              : 'This order has no delivery charge, so nothing is added to your account.'}
          </p>
          {rules.bonusEnabled ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-success">
              <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              You also get a surprise bonus for this order, added to your account when you complete it.
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-success px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {isSaving ? 'Completing…' : 'Yes, order delivered'}
            </button>
            <button type="button" onClick={() => setIsOpen(false)} disabled={isSaving} className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-ink hover:bg-surface">
              Not yet
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

/** New requests, or the rider's accepted chats: the list on the left and the order chat on the right. */
export function RiderOrders({ mode }: { mode: 'requests' | 'chats' }) {
  const { rider, wallet, rules, requests, chats, dropChat } = useRider();
  const [selectedChat, setSelectedChat] = useState<RiderChatSummary | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [notice, setNotice] = useState('');
  const [receipt, setReceipt] = useState<{ chatId: string; text: string; onHold: boolean } | null>(null);
  const isRequests = mode === 'requests';
  const items = isRequests ? requests : chats;
  // Only an order this rider has taken (ACTIVE and theirs) can be completed.
  const isMine = selectedChat ? chats.some((chat) => chat.id === selectedChat.id) : false;
  // The lists refresh every few seconds, but `selectedChat` is the copy from the moment it was opened. The panel that
  // shows the delivery charge uses the newest copy (the charge grows if the customer adds a second order to the chat).
  const openChat = selectedChat ? (chats.find((chat) => chat.id === selectedChat.id) ?? selectedChat) : null;
  const finished = receipt && selectedChat && receipt.chatId === selectedChat.id ? receipt : null;

  // "End chat" cancels the order: the chat is deleted for both sides. Answers with a problem to show, or null.
  const cancelChat = async (): Promise<string | null> => {
    if (!selectedChat) return null;

    try {
      const response = await fetch(`/api/rider-chats/${selectedChat.id}/cancel`, { method: 'POST' });
      const data = await response.json().catch(() => null);

      // 404: it is already gone (the customer cancelled at the same moment), which is what was wanted anyway.
      if (response.ok || response.status === 404) {
        dropChat(selectedChat.id);
        setSelectedChat(null);
        setConfirmEnd(false);
        setNotice('Order cancelled. The chat has been removed.');

        return null;
      }

      return data?.error ?? 'Could not cancel the order. Please try again.';
    } catch {
      return 'Could not reach the server. Please try again.';
    }
  };

  if (!rider.isApproved) return <PendingApproval />;

  return (
    <div className="space-y-6">
      {isRequests ? <HoldBanner /> : null}
      {notice ? (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <section className={`space-y-2 ${selectedChat ? 'hidden lg:block' : ''}`}>
          <h1 className="text-sm font-bold uppercase tracking-wide text-ink">
            {isRequests ? 'New requests' : 'Your chats'} ({items.length})
          </h1>
          {items.length ? (
            items.map((chat) => (
              <ChatCard key={chat.id} chat={chat} active={selectedChat?.id === chat.id} request={isRequests} onClick={() => setSelectedChat(chat)} />
            ))
          ) : (
            <p className="rounded-xl bg-surface p-4 text-sm text-brand-gray">
              {isRequests ? (wallet.hold ? "You won't get new requests until your account is clear." : 'No nearby requests right now.') : 'Accepted orders will appear here.'}
            </p>
          )}
        </section>

        <section className={`${selectedChat ? '' : 'hidden lg:block'} min-h-[28rem] rounded-2xl bg-surface p-4 shadow-soft`}>
          {selectedChat ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedChat(null)}
                className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-accent lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to {isRequests ? 'requests' : 'chats'}
              </button>
              {finished ? (
                <div role="status" className="mb-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-ink">
                  <p className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    {finished.text}
                  </p>
                  {finished.onHold ? (
                    <p className="mt-2 text-danger">
                      Please recharge your account to receive new orders.{' '}
                      <Link href="/rider/wallet" className="font-semibold underline">
                        Open wallet
                      </Link>
                    </p>
                  ) : null}
                </div>
              ) : isMine ? (
                <OrderActions
                  key={`actions-${selectedChat.id}`}
                  chat={openChat ?? selectedChat}
                  onCompleted={(text, onHold) => setReceipt({ chatId: selectedChat.id, text, onHold })}
                  onEndChat={() => setConfirmEnd(true)}
                />
              ) : null}
              {/* A fixed height for the conversation, so the bar above it (and the Complete form) can come and go without pushing the message box out of the card. */}
              <div className="h-[28rem]">
                <RiderChatThread
                  key={selectedChat.id}
                  chatId={selectedChat.id}
                  currentRole="RIDER"
                  placeholder="Message the customer…"
                  onMissing={() => {
                    dropChat(selectedChat.id);
                    setSelectedChat(null);
                    setNotice('This order was cancelled and the chat has been removed.');
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[24rem] flex-col items-center justify-center text-center text-brand-gray">
              <Bike className="mb-3 h-10 w-10" />
              <p>Select a request or chat to view the order details.</p>
            </div>
          )}
        </section>
      </div>

      {confirmEnd ? (
        <ConfirmDialog
          title="End chat?"
          message="Are you sure you want to end this chat?"
          note={
            rules.bonusEnabled && isMine
              ? 'Order will be cancelled and chats will disappear. A cancelled order earns no delivery bonus.'
              : 'Order will be cancelled and chats will disappear.'
          }
          onConfirm={cancelChat}
          onCancel={() => setConfirmEnd(false)}
        />
      ) : null}
    </div>
  );
}

/** Messages from the Mangwaoo team (admin). */
export function RiderMessages() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-ink">Messages</h1>
      <ManagerMessages />
      <SupportChat
        emptyState={
          <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
            <Headset className="mx-auto mb-3 h-10 w-10 text-brand-gray" />
            <p className="font-semibold text-ink">No messages from Mangwaoo yet</p>
            <p className="mt-1 text-sm text-brand-gray">When the Mangwaoo team writes to you, the chat shows up here and you can reply.</p>
          </div>
        }
      />
    </div>
  );
}
