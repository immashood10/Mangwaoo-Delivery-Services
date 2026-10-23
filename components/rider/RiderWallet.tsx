'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Clock, ImageUp, Paperclip, Wallet, X, XCircle } from 'lucide-react';
import { compressImage } from '@/lib/client-image';
import {
  MAX_TOP_UP_PKR,
  MIN_TOP_UP_PKR,
  RECHARGE_TITLE,
  RIDER_TOP_UP_METHODS,
  formatPkr,
  rechargeMessage,
  type RiderHold,
  type RiderLedgerKind,
  type RiderTopUpState,
} from '@/lib/rider-wallet-config';

type WalletView = {
  wallet: {
    balance: number;
    unpaidOrders: number;
    hold: RiderHold;
    completedOrders: number;
    commissionPercent: number;
    ordersOnCredit: number;
  };
  entries: { id: string; type: RiderLedgerKind; amount: number; baseAmount: number | null; note: string | null; createdAt: string }[];
  topUps: {
    id: string;
    amount: number;
    method: string;
    transactionId: string;
    status: RiderTopUpState;
    rejectionReason: string | null;
    hasScreenshot: boolean;
    createdAt: string;
  }[];
  payment: { method: string; accountNumber: string; accountName: string };
};

const POLL_MS = 20000;

const ENTRY_LABELS: Record<RiderLedgerKind, string> = {
  COMMISSION: 'Order commission',
  TOP_UP: 'Payment received',
  ADJUSTMENT: 'Adjustment',
};

const INPUT_CLASS =
  'w-full rounded-xl border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-red-100';
const LABEL_CLASS = 'mb-1.5 block text-sm font-semibold text-ink';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' });
}

function TopUpStatus({ status }: { status: RiderTopUpState }) {
  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> Added
      </span>
    );
  }

  if (status === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-danger">
        <XCircle className="h-3.5 w-3.5" /> Not accepted
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-semibold text-warning">
      <Clock className="h-3.5 w-3.5" /> Being checked
    </span>
  );
}

/** The rider's wallet: what they owe Mangwaoo, how to pay, and what happened to their account. */
export default function RiderWallet() {
  const [view, setView] = useState<WalletView | null>(null);
  const [loadError, setLoadError] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>(RIDER_TOP_UP_METHODS[0]);
  const [transactionId, setTransactionId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [sent, setSent] = useState(false);
  // The screenshot of the payment (optional): shrunk in the browser, kept only in memory until it is sent.
  const [screenshot, setScreenshot] = useState<{ blob: Blob; url: string } | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bumped after sending a recharge request so the lists refresh at once instead of at the next poll.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const fetchWallet = async () => {
      try {
        const response = await fetch('/api/rider/wallet', { cache: 'no-store' });

        if (!active) return;

        if (!response.ok) {
          setLoadError('Could not load your wallet. Please try again.');
          return;
        }

        const data = (await response.json()) as WalletView;

        if (!active) return;

        setView(data);
        setLoadError('');
      } catch {
        if (active) setLoadError('Could not reach the server. Please try again.');
      }
    };

    void fetchWallet();
    const timer = window.setInterval(fetchWallet, POLL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [reloadKey]);

  // The preview's address is released when the picture is replaced, removed or the page is left.
  useEffect(() => {
    return () => {
      if (screenshot) URL.revokeObjectURL(screenshot.url);
    };
  }, [screenshot]);

  const handlePickScreenshot = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) return;

    setFormError('');
    setIsPreparing(true);

    try {
      const blob = await compressImage(file, { maxDimension: 1400, quality: 0.8 });

      setScreenshot({ blob, url: URL.createObjectURL(blob) });
    } catch (error) {
      setFormError((error as Error).message || 'Could not read this picture. Please try another one.');
    } finally {
      setIsPreparing(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    setFormError('');
    setSent(false);

    try {
      const body = new FormData();

      body.set('amount', amount);
      body.set('method', method);
      body.set('transactionId', transactionId);
      if (screenshot) body.set('screenshot', screenshot.blob, 'payment.jpg');

      const response = await fetch('/api/rider/wallet', { method: 'POST', body });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setFormError(data?.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setSent(true);
      setAmount('');
      setTransactionId('');
      setScreenshot(null);
      setReloadKey((key) => key + 1);
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (!view) {
    return <p className="text-sm text-brand-gray">{loadError || 'Loading your wallet…'}</p>;
  }

  const { wallet, entries, topUps, payment } = view;
  const owed = Math.max(0, -wallet.balance);
  const roomLeft = Math.max(0, wallet.ordersOnCredit - wallet.unpaidOrders);
  const hasPending = topUps.some((topUp) => topUp.status === 'PENDING');

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
          <Wallet className="h-4 w-4" /> Wallet
        </div>
        <h1 className="text-3xl font-bold text-ink">Your account</h1>
      </div>

      {loadError ? <p className="text-sm text-danger">{loadError}</p> : null}

      {wallet.hold === 'PAYMENT' ? (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div>
            <p className="font-bold text-ink">{RECHARGE_TITLE}</p>
            <p className="mt-0.5 text-sm text-brand-gray">
              {rechargeMessage(wallet)} You can&apos;t go online or take new orders until it is paid and Mangwaoo has added it.
            </p>
          </div>
        </div>
      ) : wallet.hold === 'ADMIN' ? (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div>
            <p className="font-bold text-ink">Your account is on hold</p>
            <p className="mt-0.5 text-sm text-brand-gray">Mangwaoo has put your account on hold, so you will not receive new orders. Please contact support.</p>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface p-5 shadow-soft sm:col-span-1">
          <p className="text-sm text-brand-gray">{owed > 0 ? 'You owe Mangwaoo' : wallet.balance > 0 ? 'Credit in your account' : 'Balance'}</p>
          <p className={`mt-1 text-3xl font-bold ${owed > 0 ? 'text-danger' : 'text-success'}`}>{formatPkr(Math.abs(wallet.balance))}</p>
          <p className="mt-2 text-xs text-brand-gray">
            {wallet.hold === null
              ? 'You can receive new orders.'
              : wallet.hold === 'PAYMENT'
                ? 'On hold until you pay.'
                : 'On hold by Mangwaoo.'}
          </p>
        </div>
        <div className="rounded-2xl bg-surface p-5 shadow-soft">
          <p className="text-sm text-brand-gray">Orders not paid for</p>
          <p className="mt-1 text-3xl font-bold text-ink">
            {wallet.unpaidOrders} <span className="text-base font-semibold text-brand-gray">of {wallet.ordersOnCredit}</span>
          </p>
          <p className="mt-2 text-xs text-brand-gray">
            {wallet.hold === 'PAYMENT'
              ? 'Pay to get new orders.'
              : `${roomLeft} more ${roomLeft === 1 ? 'order' : 'orders'} before you must pay.`}
          </p>
        </div>
        <div className="rounded-2xl bg-surface p-5 shadow-soft">
          <p className="text-sm text-brand-gray">Orders completed</p>
          <p className="mt-1 text-3xl font-bold text-ink">{wallet.completedOrders}</p>
          <p className="mt-2 text-xs text-brand-gray">Mangwaoo keeps {wallet.commissionPercent}% of each delivery charge.</p>
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink">How it works</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-brand-gray">
          <li>
            Every order you complete adds Mangwaoo&apos;s {wallet.commissionPercent}% of the delivery charge to what you owe.
          </li>
          <li>You can have {wallet.ordersOnCredit} finished orders unpaid. After that, recharge your account to receive the next order.</li>
          <li>Pay by {payment.method}, send us the transaction ID (and a screenshot of the payment) below, and Mangwaoo adds the money to your account.</li>
        </ul>
      </section>

      <section className="rounded-2xl bg-surface p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink">Recharge your account</h2>
        <div className="mt-3 rounded-xl bg-brand-light p-4 text-sm text-ink">
          <p className="font-semibold">1. Send the money</p>
          <p className="mt-1 text-brand-gray">
            {payment.method} → <span className="font-semibold text-ink">{payment.accountNumber}</span> ({payment.accountName})
            {owed > 0 ? (
              <>
                {' '}
                — you owe <span className="font-semibold text-ink">{formatPkr(owed)}</span>
              </>
            ) : null}
          </p>
          <p className="mt-3 font-semibold">2. Tell us about it</p>
          <p className="mt-1 text-brand-gray">Enter the amount and the transaction ID from your payment message.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="topup-amount" className="mb-1.5 block text-sm font-semibold text-ink">
              Amount (PKR)
            </label>
            <input
              id="topup-amount"
              type="number"
              inputMode="numeric"
              min={MIN_TOP_UP_PKR}
              max={MAX_TOP_UP_PKR}
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={owed > 0 ? String(owed) : String(MIN_TOP_UP_PKR)}
              className={INPUT_CLASS}
              required
            />
          </div>
          <div>
            <label htmlFor="topup-method" className="mb-1.5 block text-sm font-semibold text-ink">
              Sent by
            </label>
            <select id="topup-method" value={method} onChange={(event) => setMethod(event.target.value)} className={INPUT_CLASS}>
              {RIDER_TOP_UP_METHODS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="topup-id" className="mb-1.5 block text-sm font-semibold text-ink">
              Transaction ID
            </label>
            <input
              id="topup-id"
              value={transactionId}
              onChange={(event) => setTransactionId(event.target.value)}
              maxLength={60}
              autoComplete="off"
              className={INPUT_CLASS}
              required
            />
          </div>

          <div className="sm:col-span-3">
            <p className={LABEL_CLASS}>Screenshot of the payment (optional)</p>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickScreenshot} aria-label="Choose a screenshot of the payment" />
            {screenshot ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshot.url} alt="Your payment screenshot" className="h-20 w-20 rounded-xl border border-gray-200 object-cover" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">Screenshot added</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-accent hover:underline">
                      Change
                    </button>
                    <button type="button" onClick={() => setScreenshot(null)} className="inline-flex items-center gap-1 text-danger hover:underline">
                      <X className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPreparing}
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-60"
              >
                <ImageUp className="h-4 w-4" />
                {isPreparing ? 'Preparing…' : 'Add screenshot'}
              </button>
            )}
            <p className="mt-1.5 text-xs text-brand-gray">A screenshot of the EasyPaisa payment message helps Mangwaoo check your payment faster.</p>
          </div>

          {formError ? (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger sm:col-span-3">
              {formError}
            </p>
          ) : null}
          {sent ? (
            <p role="status" className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-success sm:col-span-3">
              <CheckCircle2 className="h-4 w-4" />
              Sent. Mangwaoo will check it and add it to your account.
            </p>
          ) : null}

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={isSending}
              className="rounded-full bg-brand-red-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60"
            >
              {isSending ? 'Sending…' : 'I have sent the money'}
            </button>
            {hasPending ? <span className="ml-3 text-xs text-brand-gray">You have a request being checked.</span> : null}
          </div>
        </form>

        {topUps.length > 0 ? (
          <ul className="mt-5 divide-y divide-gray-100">
            {topUps.map((topUp) => (
              <li key={topUp.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {formatPkr(topUp.amount)} · {topUp.method}
                  </p>
                  <p className="text-xs text-brand-gray">
                    ID {topUp.transactionId} · {formatWhen(topUp.createdAt)}
                    {topUp.status === 'REJECTED' && topUp.rejectionReason ? ` · ${topUp.rejectionReason}` : ''}
                  </p>
                  {topUp.hasScreenshot ? (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-gray">
                      <Paperclip className="h-3 w-3" />
                      Screenshot attached
                    </p>
                  ) : null}
                </div>
                <TopUpStatus status={topUp.status} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-2xl bg-surface p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink">History</h2>
        {entries.length === 0 ? (
          <p className="mt-2 text-sm text-brand-gray">Nothing yet. Each order you complete shows up here.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{ENTRY_LABELS[entry.type]}</p>
                  <p className="text-xs text-brand-gray">
                    {formatWhen(entry.createdAt)}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </p>
                </div>
                <p className={`shrink-0 font-bold ${entry.amount < 0 ? 'text-danger' : 'text-success'}`}>
                  {entry.amount < 0 ? '-' : '+'}
                  {formatPkr(Math.abs(entry.amount))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
