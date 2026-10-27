'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, Copy, Phone, Send, XCircle } from 'lucide-react';
import { FormDialog } from '@/components/AdminRiderWallets';
import {
  LOYALTY_LIMITS,
  PAYOUT_LABELS,
  formatPkr,
  formatPoints,
  type LoyaltySettingsValues,
  type PayoutMethodKey,
} from '@/lib/points-config';

export type PayoutStats = {
  waitingCount: number;
  waitingAmount: number;
  pointsHeld: number;
  walletHeld: number;
  paidCount: number;
  paidAmount: number;
  cashbackIssued: number;
};

export type PendingPayout = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  accountRemoved: boolean;
  amount: number;
  method: PayoutMethodKey;
  accountNumber: string;
  accountName: string;
  createdAt: string;
  /** Delivered orders that won points, and the cashback won so far: to help check the request. */
  ordersWon: number;
  cashbackWon: number;
};

export type RecentPayout = {
  id: string;
  customerName: string;
  amount: number;
  method: PayoutMethodKey;
  accountNumber: string;
  status: 'PAID' | 'REJECTED';
  transactionId: string | null;
  rejectionReason: string | null;
  reviewedAt: string;
};

const FIELD_CLASS =
  'rounded-xl border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-red-100 disabled:opacity-50';
const INPUT_CLASS = `w-full ${FIELD_CLASS}`;
const LABEL_CLASS = 'mb-1.5 block text-sm font-semibold text-ink';
const BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-60';

async function send(url: string, method: 'PUT' | 'PATCH', body: unknown) {
  try {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => null);

    return response.ok
      ? { ok: true as const, data }
      : { ok: false as const, error: (data?.error as string | undefined) ?? 'Something went wrong. Please try again.' };
  } catch {
    return { ok: false as const, error: 'Could not reach the server. Please try again.' };
  }
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' });
}

function Stat({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'alert' }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-soft">
      <p className="text-xs text-brand-gray">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === 'alert' ? 'text-warning' : 'text-ink'}`}>{value}</p>
    </div>
  );
}

type DialogState = { kind: 'paid' | 'reject'; payout: PendingPayout } | null;

/** Admin > Wallet Payouts: the rules of Mangwaoo Points, and the customers waiting for their wallet money. */
export default function AdminWalletPayouts({
  settings,
  stats,
  pending,
  recent,
}: {
  settings: LoyaltySettingsValues;
  stats: PayoutStats;
  pending: PendingPayout[];
  recent: RecentPayout[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(settings.enabled);
  const [form, setForm] = useState({
    pointsMin: String(settings.pointsMin),
    pointsMax: String(settings.pointsMax),
    redeemPoints: String(settings.redeemPoints),
    cashbackMin: String(settings.cashbackMin),
    cashbackMax: String(settings.cashbackMax),
    minWithdrawal: String(settings.minWithdrawal),
    minOrderAmount: String(settings.minOrderAmount),
  });
  const [isSavingRules, setIsSavingRules] = useState(false);

  const rulesChanged =
    enabled !== settings.enabled || (Object.keys(form) as (keyof typeof form)[]).some((key) => Number(form[key]) !== settings[key]);

  const setField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const done = (message: string) => {
    setDialog(null);
    setError('');
    setNotice(message);
    router.refresh();
  };

  const saveRules = async (event: FormEvent) => {
    event.preventDefault();
    setIsSavingRules(true);
    setNotice('');
    setError('');

    const result = await send('/api/admin/loyalty-settings', 'PUT', {
      enabled,
      pointsMin: Number(form.pointsMin),
      pointsMax: Number(form.pointsMax),
      redeemPoints: Number(form.redeemPoints),
      cashbackMin: Number(form.cashbackMin),
      cashbackMax: Number(form.cashbackMax),
      minWithdrawal: Number(form.minWithdrawal),
      minOrderAmount: Number(form.minOrderAmount),
    });

    setIsSavingRules(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    done('Saved. The new rules apply from now on; points and money already in wallets stay as they are.');
  };

  const copyNumber = async (payout: PendingPayout) => {
    try {
      await navigator.clipboard.writeText(payout.accountNumber);
      setCopied(payout.id);
      window.setTimeout(() => setCopied((current) => (current === payout.id ? null : current)), 1500);
    } catch {
      // Copying is a convenience: the number is on screen to read.
    }
  };

  return (
    <div className="space-y-8">
      {notice ? (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Requests waiting" value={String(stats.waitingCount)} tone={stats.waitingCount > 0 ? 'alert' : 'ink'} />
        <Stat label="Amount to send" value={formatPkr(stats.waitingAmount)} tone={stats.waitingAmount > 0 ? 'alert' : 'ink'} />
        <Stat label="Points customers hold" value={formatPoints(stats.pointsHeld)} />
        <Stat label="Wallet money held" value={formatPkr(stats.walletHeld)} />
        <Stat label="Cashback given so far" value={formatPkr(stats.cashbackIssued)} />
        <Stat label="Sent so far" value={`${formatPkr(stats.paidAmount)} (${stats.paidCount})`} />
      </section>

      <section className="rounded-2xl bg-surface p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink">The rules</h2>
        <form onSubmit={saveRules} className="mt-3 space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
            />
            <span className="text-sm font-semibold text-ink">
              Mangwaoo Points are on <span className="font-normal text-brand-gray">(off = no new points and no cashing in; wallets and withdrawals still work)</span>
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className={LABEL_CLASS}>Points a delivered order wins</p>
              <div className="flex items-center gap-2">
                <input aria-label="Fewest points per order" type="number" min={1} max={LOYALTY_LIMITS.pointsMax} step={1} value={form.pointsMin} onChange={(event) => setField('pointsMin', event.target.value)} className={INPUT_CLASS} required />
                <span className="text-sm text-brand-gray">to</span>
                <input aria-label="Most points per order" type="number" min={1} max={LOYALTY_LIMITS.pointsMax} step={1} value={form.pointsMax} onChange={(event) => setField('pointsMax', event.target.value)} className={INPUT_CLASS} required />
              </div>
              <p className="mt-1 text-xs text-brand-gray">A random number in between, for every order.</p>
            </div>
            <div>
              <label htmlFor="rule-redeem" className={LABEL_CLASS}>
                Points needed for one cashback
              </label>
              <input id="rule-redeem" type="number" min={1} max={LOYALTY_LIMITS.redeemPoints} step={1} value={form.redeemPoints} onChange={(event) => setField('redeemPoints', event.target.value)} className={INPUT_CLASS} required />
            </div>
            <div>
              <p className={LABEL_CLASS}>Cashback (PKR)</p>
              <div className="flex items-center gap-2">
                <input aria-label="Smallest cashback" type="number" min={1} max={LOYALTY_LIMITS.cashbackMax} step={1} value={form.cashbackMin} onChange={(event) => setField('cashbackMin', event.target.value)} className={INPUT_CLASS} required />
                <span className="text-sm text-brand-gray">to</span>
                <input aria-label="Biggest cashback" type="number" min={1} max={LOYALTY_LIMITS.cashbackMax} step={1} value={form.cashbackMax} onChange={(event) => setField('cashbackMax', event.target.value)} className={INPUT_CLASS} required />
              </div>
              <p className="mt-1 text-xs text-brand-gray">A random amount in between, each time points are cashed in.</p>
            </div>
            <div>
              <label htmlFor="rule-min-withdrawal" className={LABEL_CLASS}>
                Least a customer can withdraw (PKR)
              </label>
              <input id="rule-min-withdrawal" type="number" min={1} max={LOYALTY_LIMITS.minWithdrawal} step={1} value={form.minWithdrawal} onChange={(event) => setField('minWithdrawal', event.target.value)} className={INPUT_CLASS} required />
              <p className="mt-1 text-xs text-brand-gray">Raise it if tiny transfers are not worth sending.</p>
            </div>
            <div>
              <label htmlFor="rule-min-order" className={LABEL_CLASS}>
                Smallest order that wins points (PKR)
              </label>
              <input id="rule-min-order" type="number" min={0} max={LOYALTY_LIMITS.minOrderAmount} step={1} value={form.minOrderAmount} onChange={(event) => setField('minOrderAmount', event.target.value)} className={INPUT_CLASS} required />
              <p className="mt-1 text-xs text-brand-gray">0 = every delivered order wins points. Counts the items only.</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingRules || !rulesChanged}
            className="rounded-xl bg-brand-red-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-50"
          >
            {isSavingRules ? 'Saving…' : 'Save rules'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Waiting to be sent ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-surface p-10 text-center text-sm text-brand-gray">No one is waiting for their money.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((payout) => (
              <li key={payout.id} data-payout-id={payout.id} className="rounded-2xl border border-yellow-200 bg-surface p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">
                      {payout.customerName} asked for {formatPkr(payout.amount)}
                    </p>
                    <p className="mt-1 text-sm text-ink">
                      Send to <span className="font-semibold">{PAYOUT_LABELS[payout.method]}</span>{' '}
                      <span className="font-mono font-semibold">{payout.accountNumber}</span> · name on the account{' '}
                      <span className="font-semibold">{payout.accountName}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-gray">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatWhen(payout.createdAt)}
                      </span>
                      {payout.customerPhone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {payout.customerPhone}
                        </span>
                      ) : null}
                      <span>
                        {payout.ordersWon} {payout.ordersWon === 1 ? 'order' : 'orders'} won points · {formatPkr(payout.cashbackWon)} cashback won so far
                      </span>
                      {payout.accountRemoved ? <span className="font-semibold text-danger">Account removed</span> : null}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => copyNumber(payout)} className={BUTTON_CLASS}>
                      <Copy className="h-3.5 w-3.5" />
                      {copied === payout.id ? 'Copied' : 'Copy number'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNotice('');
                        setDialog({ kind: 'paid', payout });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red-primary px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-secondary"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Mark as sent
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNotice('');
                        setDialog({ kind: 'reject', payout });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-danger hover:bg-red-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Recently dealt with</h2>
        {recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-surface p-8 text-center text-sm text-brand-gray">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-2xl bg-surface px-5 shadow-soft">
            {recent.map((payout) => (
              <li key={payout.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {payout.customerName} · {formatPkr(payout.amount)} to {PAYOUT_LABELS[payout.method]} {payout.accountNumber}
                  </p>
                  <p className="text-xs text-brand-gray">
                    {formatWhen(payout.reviewedAt)}
                    {payout.status === 'PAID' && payout.transactionId ? ` · Transaction ID ${payout.transactionId}` : ''}
                    {payout.status === 'REJECTED' ? ` · ${payout.rejectionReason ?? 'Turned down'}` : ''}
                  </p>
                </div>
                {payout.status === 'PAID' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Sent
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-danger">
                    <XCircle className="h-3.5 w-3.5" /> Turned down
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog?.kind === 'paid' ? (
        <FormDialog
          title={`Mark as sent · ${dialog.payout.customerName}`}
          description={`Send ${formatPkr(dialog.payout.amount)} to ${PAYOUT_LABELS[dialog.payout.method]} ${dialog.payout.accountNumber} (${dialog.payout.accountName}) from Mangwaoo's account first, then enter the transaction ID here. The customer is told.`}
          fields={[{ name: 'transactionId', label: 'Transaction ID of the money you sent', type: 'text', required: true, placeholder: 'e.g. 31234567890', help: '6 to 40 letters or numbers, from the payment message.' }]}
          submitLabel="Mark as sent"
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            const payout = dialog.payout;
            const result = await send(`/api/admin/wallet-withdrawals/${payout.id}`, 'PATCH', { action: 'paid', transactionId: values.transactionId });

            if (!result.ok) return result.error;

            done(`${formatPkr(payout.amount)} to ${payout.customerName} is marked as sent.`);

            return null;
          }}
        />
      ) : null}

      {dialog?.kind === 'reject' ? (
        <FormDialog
          title="Turn this request down"
          description={`${dialog.payout.customerName}'s ${formatPkr(dialog.payout.amount)} goes back into their wallet and they are told.`}
          fields={[{ name: 'reason', label: 'Reason (optional)', type: 'text', placeholder: 'e.g. that number is not a JazzCash account' }]}
          submitLabel="Turn down"
          danger
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            const payout = dialog.payout;
            const result = await send(`/api/admin/wallet-withdrawals/${payout.id}`, 'PATCH', { action: 'reject', reason: values.reason });

            if (!result.ok) return result.error;

            done(`${payout.customerName}'s request was turned down and the money is back in their wallet.`);

            return null;
          }}
        />
      ) : null}
    </div>
  );
}
