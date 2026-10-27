'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, CheckCircle2, Clock, Gift, Info, Send, Sparkles, Wallet, XCircle } from 'lucide-react';
import type { ActivityLine, PointsPageData, WithdrawalView } from '@/lib/points';
import {
  MAX_PENDING_WITHDRAWALS,
  PAYOUT_LABELS,
  PAYOUT_METHODS,
  WALLET_ENTRY_LABELS,
  formatPkr,
  formatPoints,
  rangeLabel,
  type PayoutMethodKey,
} from '@/lib/points-config';

const INPUT_CLASS =
  'w-full rounded-xl border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-red-100';
const LABEL_CLASS = 'mb-1.5 block text-sm font-semibold text-ink';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' });
}

function WithdrawalStatus({ status }: { status: WithdrawalView['status'] }) {
  if (status === 'PAID') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> Sent
      </span>
    );
  }

  if (status === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-danger">
        <XCircle className="h-3.5 w-3.5" /> Not sent
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-semibold text-warning">
      <Clock className="h-3.5 w-3.5" /> Being sent
    </span>
  );
}

function ActivityRow({ line }: { line: ActivityLine }) {
  if (line.kind === 'POINTS') {
    const title =
      line.type === 'EARNED'
        ? `Delivered order${line.orderRef ? ` ${line.orderRef}` : ''}`
        : line.type === 'REDEEMED'
          ? 'Points cashed in'
          : 'Points correction';
    const detail =
      line.type === 'REDEEMED' && line.cashback !== null ? `You got ${formatPkr(line.cashback)} cashback` : line.type === 'ADJUSTMENT' ? line.note : null;

    return (
      <li className="flex items-start justify-between gap-3 py-2.5 text-sm">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{title}</p>
          <p className="text-xs text-brand-gray">
            {formatWhen(line.at)}
            {detail ? ` · ${detail}` : ''}
          </p>
        </div>
        <p className={`shrink-0 font-bold ${line.points < 0 ? 'text-danger' : 'text-success'}`}>
          {line.points < 0 ? '−' : '+'}
          {formatPoints(Math.abs(line.points))} pts
        </p>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-3 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{WALLET_ENTRY_LABELS[line.type]}</p>
        <p className="text-xs text-brand-gray">
          {formatWhen(line.at)}
          {line.note ? ` · ${line.note}` : ''}
        </p>
      </div>
      <p className={`shrink-0 font-bold ${line.amount < 0 ? 'text-danger' : 'text-success'}`}>
        {line.amount < 0 ? '−' : '+'}
        {formatPkr(Math.abs(line.amount))}
      </p>
    </li>
  );
}

/** Mangwaoo Points: the points won, cashing them in, the wallet and sending its money to JazzCash / EasyPaisa. */
export default function PointsWallet({ data, defaultName, defaultPhone }: { data: PointsPageData; defaultName: string; defaultPhone: string }) {
  const router = useRouter();
  const { settings } = data;

  const [won, setWon] = useState<{ cashback: number; cost: number } | null>(null);
  const [redeemError, setRedeemError] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [method, setMethod] = useState<PayoutMethodKey>('EASYPAISA');
  const [accountNumber, setAccountNumber] = useState(defaultPhone);
  const [accountName, setAccountName] = useState(defaultName);
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [sentMessage, setSentMessage] = useState('');

  const cashIns = Math.floor(data.points / settings.redeemPoints);
  const canRedeem = settings.enabled && cashIns >= 1 && !isRedeeming;
  const progress = Math.min(100, Math.round((data.points / settings.redeemPoints) * 100));
  const pending = data.withdrawals.filter((withdrawal) => withdrawal.status === 'PENDING');
  const canWithdraw = data.walletBalance >= settings.minWithdrawal && pending.length < MAX_PENDING_WITHDRAWALS;

  const redeem = async () => {
    setIsRedeeming(true);
    setRedeemError('');
    setWon(null);
    setSentMessage('');

    try {
      const response = await fetch('/api/points/redeem', { method: 'POST' });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setRedeemError(body?.error ?? 'Something went wrong. Please try again.');
        router.refresh();
        return;
      }

      setWon({ cashback: body.cashback, cost: body.cost });
      router.refresh();
    } catch {
      setRedeemError('Could not reach the server. Please try again.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const openWithdraw = () => {
    setAmount(String(data.walletBalance));
    setWithdrawError('');
    setSentMessage('');
    setIsWithdrawOpen(true);
  };

  const withdraw = async (event: FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    setWithdrawError('');

    try {
      const response = await fetch('/api/points/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), method, accountNumber, accountName }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setWithdrawError(body?.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setIsWithdrawOpen(false);
      setSentMessage(`Request sent. Mangwaoo will send ${formatPkr(Number(amount))} to your ${PAYOUT_LABELS[method]} account and tell you here.`);
      router.refresh();
    } catch {
      setWithdrawError('Could not reach the server. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {!settings.enabled ? (
        <p role="note" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-ink">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span>Mangwaoo Points are paused for now. Your points and wallet are safe, and you can still withdraw your wallet money.</span>
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-surface p-5 shadow-soft">
          <p className="flex items-center gap-2 text-sm text-brand-gray">
            <Gift className="h-4 w-4 text-accent" aria-hidden="true" /> Your points
          </p>
          <p className="mt-1 text-4xl font-extrabold text-ink" data-testid="points-balance">
            {formatPoints(data.points)}
          </p>

          <div className="mt-3" aria-hidden="true">
            <div className="h-2 overflow-hidden rounded-full bg-brand-light">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-red-primary to-brand-red-secondary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <p className="mt-2 text-xs text-brand-gray">
            {cashIns >= 1
              ? `You can cash in ${cashIns === 1 ? 'now' : `${cashIns} times`}!`
              : `${formatPoints(settings.redeemPoints - data.points)} more points to your next cashback (${formatPoints(settings.redeemPoints)} needed).`}
          </p>

          <button
            type="button"
            onClick={redeem}
            disabled={!canRedeem}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-red-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {isRedeeming ? 'Opening…' : `Cash in ${formatPoints(settings.redeemPoints)} points`}
          </button>
          {redeemError ? (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
              {redeemError}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-brand-gray">
            {formatPoints(data.totalEarned)} points won so far · {formatPkr(data.totalCashback)} cashback so far
          </p>
        </div>

        <div className="rounded-2xl bg-surface p-5 shadow-soft">
          <p className="flex items-center gap-2 text-sm text-brand-gray">
            <Wallet className="h-4 w-4 text-accent" aria-hidden="true" /> Your wallet
          </p>
          <p className="mt-1 text-4xl font-extrabold text-success" data-testid="wallet-balance">
            {formatPkr(data.walletBalance)}
          </p>
          <p className="mt-2 text-xs text-brand-gray">Cashback you can send to your JazzCash or EasyPaisa account whenever you like.</p>

          <button
            type="button"
            onClick={openWithdraw}
            disabled={!canWithdraw || isWithdrawOpen}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent px-5 py-2.5 text-sm font-semibold text-accent transition hover:bg-brand-red-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Send to JazzCash / EasyPaisa
          </button>
          {data.walletBalance < settings.minWithdrawal ? (
            <p className="mt-3 text-xs text-brand-gray">You can send money once you have at least {formatPkr(settings.minWithdrawal)}.</p>
          ) : pending.length >= MAX_PENDING_WITHDRAWALS ? (
            <p className="mt-3 text-xs text-brand-gray">You have {pending.length} requests waiting. You can ask again once Mangwaoo has sent them.</p>
          ) : null}
        </div>
      </section>

      <AnimatePresence>
        {won ? (
          <motion.div
            key="won"
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            role="status"
            className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center"
          >
            <p className="text-3xl" aria-hidden="true">
              🎉
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">You cashed in {formatPoints(won.cost)} points and won</p>
            <p className="my-1 text-5xl font-extrabold text-success" data-testid="won-amount">
              {formatPkr(won.cashback)}
            </p>
            <p className="text-sm text-brand-gray">cashback. It is in your wallet now.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {sentMessage ? (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {sentMessage}
        </p>
      ) : null}

      {isWithdrawOpen ? (
        <section className="rounded-2xl bg-surface p-5 shadow-soft" aria-label="Send money to your account">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <Banknote className="h-5 w-5 text-accent" aria-hidden="true" />
            Send money to your account
          </h2>
          <p className="mt-1 text-sm text-brand-gray">
            The money leaves your wallet now. Mangwaoo checks the request, sends it to the account below and tells you. If it can&apos;t be sent, it comes back to your wallet.
          </p>

          <form onSubmit={withdraw} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className={LABEL_CLASS}>Send to</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Send to">
                {PAYOUT_METHODS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={method === option}
                    onClick={() => {
                      setMethod(option);
                      setWithdrawError('');
                    }}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      method === option ? 'border-accent bg-brand-red-primary text-white' : 'border-gray-300 text-ink hover:border-accent'
                    }`}
                  >
                    {PAYOUT_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="payout-number" className={LABEL_CLASS}>
                {PAYOUT_LABELS[method]} mobile number
              </label>
              <input
                id="payout-number"
                type="tel"
                inputMode="tel"
                value={accountNumber}
                onChange={(event) => {
                  setAccountNumber(event.target.value);
                  setWithdrawError('');
                }}
                placeholder="0300 1234567"
                autoComplete="tel"
                className={INPUT_CLASS}
                required
              />
            </div>
            <div>
              <label htmlFor="payout-name" className={LABEL_CLASS}>
                Name on the account
              </label>
              <input
                id="payout-name"
                value={accountName}
                onChange={(event) => {
                  setAccountName(event.target.value);
                  setWithdrawError('');
                }}
                maxLength={60}
                autoComplete="name"
                className={INPUT_CLASS}
                required
              />
            </div>
            <div>
              <label htmlFor="payout-amount" className={LABEL_CLASS}>
                Amount (PKR)
              </label>
              <input
                id="payout-amount"
                type="number"
                inputMode="numeric"
                min={settings.minWithdrawal}
                max={data.walletBalance}
                step="1"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setWithdrawError('');
                }}
                className={INPUT_CLASS}
                required
              />
              <p className="mt-1 text-xs text-brand-gray">
                {formatPkr(settings.minWithdrawal)} to {formatPkr(data.walletBalance)}
              </p>
            </div>

            {withdrawError ? (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger sm:col-span-2">
                {withdrawError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={isSending}
                className="rounded-full bg-brand-red-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60"
              >
                {isSending ? 'Sending…' : 'Send request'}
              </button>
              <button
                type="button"
                onClick={() => setIsWithdrawOpen(false)}
                className="rounded-full border border-gray-300 px-6 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl bg-surface p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink">How it works</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-brand-gray">
          <li>
            Every order that is delivered wins you <span className="font-semibold text-ink">{rangeLabel(settings.pointsMin, settings.pointsMax)} Mangwaoo Points</span>
            {settings.minOrderAmount > 0 ? ` (orders of ${formatPkr(settings.minOrderAmount)} or more)` : ''}.
          </li>
          <li>
            Cash in <span className="font-semibold text-ink">{formatPoints(settings.redeemPoints)} points</span> for a surprise cashback of{' '}
            <span className="font-semibold text-ink">{formatPkr(settings.cashbackMin)}{settings.cashbackMax > settings.cashbackMin ? ` to ${formatPkr(settings.cashbackMax)}` : ''}</span> in your wallet.
          </li>
          <li>
            Send your wallet money to your JazzCash or EasyPaisa account whenever you like (at least {formatPkr(settings.minWithdrawal)}). Mangwaoo checks and sends it.
          </li>
        </ul>
      </section>

      {data.withdrawals.length > 0 ? (
        <section className="rounded-2xl bg-surface p-5 shadow-soft">
          <h2 className="text-lg font-bold text-ink">Your requests</h2>
          <ul className="mt-2 divide-y divide-gray-100">
            {data.withdrawals.map((withdrawal) => (
              <li key={withdrawal.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {formatPkr(withdrawal.amount)} to {PAYOUT_LABELS[withdrawal.method]} {withdrawal.accountNumber}
                  </p>
                  <p className="text-xs text-brand-gray">
                    {formatWhen(withdrawal.createdAt)}
                    {withdrawal.status === 'PAID' && withdrawal.transactionId ? ` · Transaction ID ${withdrawal.transactionId}` : ''}
                    {withdrawal.status === 'REJECTED' ? ` · ${withdrawal.rejectionReason ?? 'Not sent'}. The money is back in your wallet.` : ''}
                  </p>
                </div>
                <WithdrawalStatus status={withdrawal.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl bg-surface p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink">Activity</h2>
        {data.activity.length === 0 ? (
          <p className="mt-2 text-sm text-brand-gray">Nothing yet. Order something, and when it is delivered you win your first points.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {data.activity.map((line) => (
              <ActivityRow key={line.id} line={line} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
