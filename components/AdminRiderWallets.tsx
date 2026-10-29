'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  Bell,
  Bike,
  CheckCircle2,
  ChevronDown,
  Gift,
  History as HistoryIcon,
  Image as ImageIcon,
  Phone,
  Settings2,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { BONUS_LIMITS, type RiderBonusSettingsValues } from '@/lib/rider-bonus-config';
import {
  ACCESS_LABELS,
  MAX_ORDERS_ON_CREDIT,
  formatPkr,
  type RiderHold,
  type RiderLedgerKind,
  type RiderOrderAccess,
} from '@/lib/rider-wallet-config';

export type WalletRider = {
  /** Rider id (what the wallet APIs use). */
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  vehicleType: string | null;
  isApproved: boolean;
  isOnline: boolean;
  completedOrders: number;
  /** Negative = owes Mangwaoo. */
  balance: number;
  unpaidOrders: number;
  paymentHold: boolean;
  orderAccess: RiderOrderAccess;
  hold: RiderHold;
};

export type PendingTopUp = {
  id: string;
  riderId: string;
  riderName: string;
  riderPhone: string | null;
  amount: number;
  method: string;
  transactionId: string;
  /** The rider attached a screenshot of the payment. */
  hasScreenshot: boolean;
  createdAt: string;
};

type Settings = { commissionPercent: number; ordersOnCredit: number };

/** The delivery bonus: its rules, and what it has paid so far. */
export type BonusOverview = { settings: RiderBonusSettingsValues; paid: number; orders: number };

type HistoryEntry = { id: string; type: RiderLedgerKind; amount: number; baseAmount: number | null; note: string | null; createdAt: string };

const FIELD_CLASS =
  'rounded-xl border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-red-100 disabled:opacity-50';
const INPUT_CLASS = `w-full ${FIELD_CLASS}`;
const LABEL_CLASS = 'mb-1.5 block text-sm font-semibold text-ink';
const BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-60';

const ENTRY_LABELS: Record<RiderLedgerKind, string> = { COMMISSION: 'Order commission', TOP_UP: 'Payment received', ADJUSTMENT: 'Adjustment', BONUS: 'Delivery bonus' };

/** The three tiers of the delivery bonus as the form lists them: which settings each one reads. */
const BONUS_TIERS = [
  { id: 'near', title: 'Short orders', km: 'nearMaxKm', min: 'nearMin', max: 'nearMax' },
  { id: 'mid', title: 'Middle orders', km: 'midMaxKm', min: 'midMin', max: 'midMax' },
  { id: 'far', title: 'Long orders', km: null, min: 'farMin', max: 'farMax' },
] as const;

async function send(url: string, method: 'POST' | 'PUT' | 'PATCH', body: unknown) {
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

export function Modal({ titleId, onClose, children, wide = false }: { titleId: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKey);

    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-6 shadow-2xl sm:rounded-2xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        {children}
      </div>
    </div>
  );
}

type DialogField = {
  name: string;
  label: string;
  type: 'number' | 'text';
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  help?: string;
};

/** A small form in a dialog; `onSubmit` answers with an error message, or null when it worked. */
export function FormDialog({
  title,
  description,
  fields,
  submitLabel,
  danger = false,
  onClose,
  onSubmit,
}: {
  title: string;
  description?: string;
  fields: DialogField[];
  submitLabel: string;
  danger?: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => Promise<string | null>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? '']))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');

    const problem = await onSubmit(values);

    setIsSaving(false);
    if (problem) setError(problem);
  };

  return (
    <Modal titleId="wallet-dialog-title" onClose={onClose}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="wallet-dialog-title" className="text-lg font-bold text-ink">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-brand-gray">{description}</p> : null}
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-brand-gray hover:bg-gray-100 hover:text-ink" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.name}>
            <label htmlFor={`wallet-field-${field.name}`} className={LABEL_CLASS}>
              {field.label}
            </label>
            <input
              id={`wallet-field-${field.name}`}
              ref={index === 0 ? firstRef : undefined}
              type={field.type}
              inputMode={field.type === 'number' ? 'numeric' : undefined}
              step={field.type === 'number' ? '1' : undefined}
              value={values[field.name]}
              onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
              placeholder={field.placeholder}
              required={field.required}
              className={INPUT_CLASS}
            />
            {field.help ? <p className="mt-1 text-xs text-brand-gray">{field.help}</p> : null}
          </div>
        ))}

        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
              danger ? 'bg-red-700 hover:bg-red-800' : 'bg-brand-red-primary hover:bg-brand-red-secondary'
            }`}
          >
            {isSaving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** The screenshot of a payment, as the rider attached it. */
function ScreenshotDialog({ topUp, onClose }: { topUp: PendingTopUp; onClose: () => void }) {
  return (
    <Modal titleId="wallet-screenshot-title" onClose={onClose} wide>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="wallet-screenshot-title" className="text-lg font-bold text-ink">
            Payment screenshot · {topUp.riderName}
          </h2>
          <p className="mt-1 text-sm text-brand-gray">
            {formatPkr(topUp.amount)} by {topUp.method} · ID <span className="font-mono font-semibold text-ink">{topUp.transactionId}</span>
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-brand-gray hover:bg-gray-100 hover:text-ink" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/admin/rider-top-ups/${topUp.id}/screenshot`}
        alt={`Payment screenshot from ${topUp.riderName}`}
        className="max-h-[70vh] w-full rounded-xl border border-gray-200 bg-brand-light object-contain"
      />
    </Modal>
  );
}

function StatusChip({ rider }: { rider: WalletRider }) {
  if (rider.hold === 'ADMIN') {
    return <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-danger">Blocked by admin</span>;
  }

  if (rider.hold === 'PAYMENT') {
    return <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-danger">Defaulter · unpaid commission</span>;
  }

  if (rider.orderAccess === 'ALLOWED') {
    return <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-info">Manual allow</span>;
  }

  return <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-success">Eligible for next order</span>;
}

/** One rider's money lines, loaded when their card is opened. */
function RiderHistory({ riderId }: { riderId: string }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    fetch(`/api/admin/rider-wallets/${riderId}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then((result: { entries: HistoryEntry[] }) => {
        if (active) setEntries(result.entries);
      })
      .catch(() => {
        if (active) setError('Could not load the history.');
      });

    return () => {
      active = false;
    };
  }, [riderId]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!entries) return <p className="text-sm text-brand-gray">Loading…</p>;
  if (entries.length === 0) return <p className="text-sm text-brand-gray">No money lines yet.</p>;

  return (
    <ul className="divide-y divide-gray-200">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start justify-between gap-3 py-2 text-sm">
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
  );
}

function RiderCard({
  rider,
  isBusy,
  isOpen,
  onToggleHistory,
  onRemind,
  onDialog,
  onAccess,
}: {
  rider: WalletRider;
  isBusy: boolean;
  isOpen: boolean;
  onToggleHistory: () => void;
  onRemind: () => void;
  onDialog: (kind: 'payment' | 'adjust') => void;
  onAccess: (access: RiderOrderAccess) => void;
}) {
  const owes = rider.balance < 0;

  return (
    <li id={`rider-${rider.id}`} className={`rounded-2xl border bg-surface p-5 shadow-soft ${rider.hold ? 'border-red-200' : 'border-gray-100'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Bike className="h-4 w-4 text-accent" />
            <h3 className="truncate font-bold text-ink">{rider.name}</h3>
            <StatusChip rider={rider} />
            {rider.isOnline ? <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-success">Online now</span> : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-brand-gray">
            {rider.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {rider.phone}
              </span>
            ) : null}
            {rider.vehicleType ? <span>{rider.vehicleType}</span> : null}
            {!rider.isApproved ? <span className="text-warning">Not approved</span> : null}
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-x-6 text-right text-sm">
          <div>
            <dt className="text-xs text-brand-gray">{owes ? 'Owes' : rider.balance > 0 ? 'Credit' : 'Balance'}</dt>
            <dd className={`font-bold ${owes ? 'text-danger' : 'text-ink'}`}>{formatPkr(Math.abs(rider.balance))}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-gray">Unpaid orders</dt>
            <dd className="font-bold text-ink">{rider.unpaidOrders}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-gray">Completed</dt>
            <dd className="font-bold text-ink">{rider.completedOrders}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {owes ? (
          <button type="button" onClick={onRemind} disabled={isBusy} className={BUTTON_CLASS}>
            <Bell className="h-3.5 w-3.5" />
            Send &quot;recharge&quot; reminder
          </button>
        ) : null}
        <button type="button" onClick={() => onDialog('payment')} disabled={isBusy} className={BUTTON_CLASS}>
          <Banknote className="h-3.5 w-3.5" />
          Record payment
        </button>
        <button type="button" onClick={() => onDialog('adjust')} disabled={isBusy} className={BUTTON_CLASS}>
          <Settings2 className="h-3.5 w-3.5" />
          Adjust
        </button>
        <button type="button" onClick={onToggleHistory} className={BUTTON_CLASS} aria-expanded={isOpen}>
          <HistoryIcon className="h-3.5 w-3.5" />
          History
          <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-1.5" role="group" aria-label={`Orders for ${rider.name}`}>
          <ShieldCheck className="h-3.5 w-3.5 text-brand-gray" />
          {(['AUTO', 'ALLOWED', 'BLOCKED'] as const).map((access) => (
            <button
              key={access}
              type="button"
              onClick={() => rider.orderAccess !== access && onAccess(access)}
              disabled={isBusy}
              aria-pressed={rider.orderAccess === access}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                rider.orderAccess === access
                  ? access === 'BLOCKED'
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'border-brand-dark bg-brand-dark text-white'
                  : 'border-gray-200 text-ink hover:border-accent hover:text-accent'
              }`}
            >
              {ACCESS_LABELS[access]}
            </button>
          ))}
        </div>
      </div>

      {isOpen ? (
        <div className="mt-4 rounded-xl bg-brand-light p-4">
          <RiderHistory riderId={rider.id} />
        </div>
      ) : null}
    </li>
  );
}

function Stat({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'danger' }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-soft">
      <p className="text-xs text-brand-gray">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{value}</p>
    </div>
  );
}

type DialogState = { kind: 'payment' | 'adjust'; rider: WalletRider } | { kind: 'reject'; topUp: PendingTopUp } | null;
type Filter = 'all' | 'not-eligible' | 'owes';

/** Admin > Rider Wallets: who owes Mangwaoo commission, who may receive the next order, and the tools to manage it. */
export default function AdminRiderWallets({ riders, pending, settings, bonus }: { riders: WalletRider[]; pending: PendingTopUp[]; settings: Settings; bonus: BonusOverview }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [percent, setPercent] = useState(String(settings.commissionPercent));
  const [credit, setCredit] = useState(String(settings.ordersOnCredit));
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [bonusOn, setBonusOn] = useState(bonus.settings.enabled);
  const [bonusForm, setBonusForm] = useState({
    nearMaxKm: String(bonus.settings.nearMaxKm),
    midMaxKm: String(bonus.settings.midMaxKm),
    nearMin: String(bonus.settings.nearMin),
    nearMax: String(bonus.settings.nearMax),
    midMin: String(bonus.settings.midMin),
    midMax: String(bonus.settings.midMax),
    farMin: String(bonus.settings.farMin),
    farMax: String(bonus.settings.farMax),
  });
  const [isSavingBonus, setIsSavingBonus] = useState(false);
  const [approveAmounts, setApproveAmounts] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<PendingTopUp | null>(null);

  const owing = riders.filter((rider) => rider.balance < 0);
  const totalOwed = owing.reduce((sum, rider) => sum - rider.balance, 0);
  const notEligible = riders.filter((rider) => rider.hold !== null);

  const shown = useMemo(
    () => riders.filter((rider) => (filter === 'all' ? true : filter === 'not-eligible' ? rider.hold !== null : rider.balance < 0)),
    [riders, filter]
  );

  const done = (message: string) => {
    setDialog(null);
    setError('');
    setNotice(message);
    router.refresh();
  };

  const run = async (id: string, job: () => ReturnType<typeof send>, success: string) => {
    setBusyId(id);
    setNotice('');
    setError('');

    const result = await job();

    setBusyId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    done(success);
  };

  const saveRule = async (event: FormEvent) => {
    event.preventDefault();
    setIsSavingRule(true);
    setNotice('');
    setError('');

    const result = await send('/api/admin/rider-wallets/settings', 'PUT', { commissionPercent: Number(percent), ordersOnCredit: Number(credit) });

    setIsSavingRule(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    done(
      result.data?.changedRiders > 0
        ? `Saved. ${result.data.changedRiders} ${result.data.changedRiders === 1 ? 'rider was' : 'riders were'} put on hold or released by the new rule.`
        : 'Saved. The new rule applies to orders finished from now on.'
    );
  };

  const ruleChanged = Number(percent) !== settings.commissionPercent || Number(credit) !== settings.ordersOnCredit;

  const bonusChanged =
    bonusOn !== bonus.settings.enabled || (Object.keys(bonusForm) as (keyof typeof bonusForm)[]).some((key) => Number(bonusForm[key]) !== bonus.settings[key]);

  const setBonusField = (key: keyof typeof bonusForm, value: string) => setBonusForm((current) => ({ ...current, [key]: value }));

  const saveBonus = async (event: FormEvent) => {
    event.preventDefault();
    setIsSavingBonus(true);
    setNotice('');
    setError('');

    const result = await send('/api/admin/rider-bonus-settings', 'PUT', {
      enabled: bonusOn,
      nearMaxKm: Number(bonusForm.nearMaxKm),
      midMaxKm: Number(bonusForm.midMaxKm),
      nearMin: Number(bonusForm.nearMin),
      nearMax: Number(bonusForm.nearMax),
      midMin: Number(bonusForm.midMin),
      midMax: Number(bonusForm.midMax),
      farMin: Number(bonusForm.farMin),
      farMax: Number(bonusForm.farMax),
    });

    setIsSavingBonus(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    done('Saved. The new bonus rules apply to orders completed from now on; bonuses already paid stay.');
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
        <Stat label="Riders who owe money" value={String(owing.length)} tone={owing.length > 0 ? 'danger' : 'ink'} />
        <Stat label="Total owed to Mangwaoo" value={formatPkr(totalOwed)} tone={totalOwed > 0 ? 'danger' : 'ink'} />
        <Stat label="Not eligible for orders" value={String(notEligible.length)} tone={notEligible.length > 0 ? 'danger' : 'ink'} />
        <Stat label="Recharges to check" value={String(pending.length)} />
        <Stat label="Delivery bonuses paid so far" value={`${formatPkr(bonus.paid)} (${bonus.orders})`} />
      </section>

      <section className="rounded-2xl bg-surface p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink">The rule</h2>
        <form onSubmit={saveRule} className="mt-3 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="rule-percent" className={LABEL_CLASS}>
              Mangwaoo&apos;s share of each delivery charge (%)
            </label>
            <input id="rule-percent" type="number" min={1} max={100} step={1} value={percent} onChange={(event) => setPercent(event.target.value)} className={INPUT_CLASS} required />
          </div>
          <div>
            <label htmlFor="rule-credit" className={LABEL_CLASS}>
              Finished orders a rider may leave unpaid
            </label>
            <input id="rule-credit" type="number" min={0} max={MAX_ORDERS_ON_CREDIT} step={1} value={credit} onChange={(event) => setCredit(event.target.value)} className={INPUT_CLASS} required />
          </div>
          <button
            type="submit"
            disabled={isSavingRule || !ruleChanged}
            className="rounded-xl bg-brand-red-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-50"
          >
            {isSavingRule ? 'Saving…' : 'Save rule'}
          </button>
        </form>
        <p className="mt-2 text-xs text-brand-gray">
          After that many unpaid orders a rider can&apos;t go online or take the next order until they have paid everything they owe. Orders already finished keep the
          commission they were charged. Set 0 to ask for payment before every next order.
        </p>
      </section>

      <section className="rounded-2xl bg-surface p-5 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Gift className="h-5 w-5 text-accent" aria-hidden="true" />
          Delivery bonus
        </h2>
        <p className="mt-1 text-sm text-brand-gray">
          A rider who completes an order gets a random bonus, added to their wallet (so it counts against what they owe). The farther the order, the bigger it can be.
          Mangwaoo pays it. An order whose distance is not known (MangwaooMart only) counts as a short one.
          Only a completed order pays a bonus: a rider who cancels an order, or whose customer cancels it, gets none.
        </p>
        <form onSubmit={saveBonus} className="mt-3 space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={bonusOn}
              onChange={(event) => setBonusOn(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
            />
            <span className="text-sm font-semibold text-ink">
              The delivery bonus is on <span className="font-normal text-brand-gray">(off = no new bonuses)</span>
            </span>
          </label>

          <div className="space-y-3">
            {BONUS_TIERS.map((tier) => (
              <div key={tier.id} className="grid gap-3 rounded-xl border border-gray-100 p-3 sm:grid-cols-[9rem_1fr_1fr] sm:items-end" data-bonus-tier={tier.id}>
                <p className="text-sm font-semibold text-ink sm:pb-2.5">{tier.title}</p>
                <div>
                  <p className={LABEL_CLASS}>{tier.km ? 'Up to (km)' : 'Distance'}</p>
                  {tier.km ? (
                    <input
                      aria-label={`${tier.title}: up to km`}
                      type="number"
                      min={0.1}
                      max={BONUS_LIMITS.km}
                      step={0.1}
                      value={bonusForm[tier.km]}
                      onChange={(event) => setBonusField(tier.km, event.target.value)}
                      className={INPUT_CLASS}
                      required
                    />
                  ) : (
                    <p className="rounded-xl border border-dashed border-gray-200 px-4 py-2.5 text-sm text-brand-gray">Farther than {bonusForm.midMaxKm || '…'} km</p>
                  )}
                </div>
                <div>
                  <p className={LABEL_CLASS}>Bonus (PKR)</p>
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`${tier.title}: lowest bonus`}
                      type="number"
                      min={1}
                      max={BONUS_LIMITS.amount}
                      step={1}
                      value={bonusForm[tier.min]}
                      onChange={(event) => setBonusField(tier.min, event.target.value)}
                      className={INPUT_CLASS}
                      required
                    />
                    <span className="text-sm text-brand-gray">to</span>
                    <input
                      aria-label={`${tier.title}: highest bonus`}
                      type="number"
                      min={1}
                      max={BONUS_LIMITS.amount}
                      step={1}
                      value={bonusForm[tier.max]}
                      onChange={(event) => setBonusField(tier.max, event.target.value)}
                      className={INPUT_CLASS}
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-brand-gray">A random whole number of rupees between the two, for each completed order. Distances are judged to 0.1 km, like the delivery fee.</p>

          <button
            type="submit"
            disabled={isSavingBonus || !bonusChanged}
            className="rounded-xl bg-brand-red-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-50"
          >
            {isSavingBonus ? 'Saving…' : 'Save bonus rules'}
          </button>
        </form>
      </section>

      {pending.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold text-ink">Recharges waiting to be checked ({pending.length})</h2>
          <ul className="space-y-3">
            {pending.map((topUp) => (
              <li key={topUp.id} className="rounded-2xl border border-yellow-200 bg-surface p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">
                      {topUp.riderName} sent {formatPkr(topUp.amount)}
                    </p>
                    <p className="mt-0.5 text-sm text-brand-gray">
                      {topUp.method} · Transaction ID <span className="font-mono font-semibold text-ink">{topUp.transactionId}</span> · {formatWhen(topUp.createdAt)}
                      {topUp.riderPhone ? ` · ${topUp.riderPhone}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-brand-gray">Check that this payment reached Mangwaoo&apos;s account, then approve.</p>
                    {topUp.hasScreenshot ? (
                      <button
                        type="button"
                        onClick={() => setViewing(topUp)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        View screenshot
                      </button>
                    ) : (
                      <p className="mt-2 text-xs text-brand-gray">No screenshot attached.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label htmlFor={`approve-${topUp.id}`} className="mb-1 block text-xs text-brand-gray">
                        Amount received
                      </label>
                      <input
                        id={`approve-${topUp.id}`}
                        type="number"
                        min={1}
                        step={1}
                        value={approveAmounts[topUp.id] ?? String(topUp.amount)}
                        onChange={(event) => setApproveAmounts((current) => ({ ...current, [topUp.id]: event.target.value }))}
                        className={`w-28 ${FIELD_CLASS} py-1.5`}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={busyId === topUp.id}
                      onClick={() =>
                        run(
                          topUp.id,
                          () => send(`/api/admin/rider-top-ups/${topUp.id}`, 'PATCH', { action: 'approve', amount: Number(approveAmounts[topUp.id] ?? topUp.amount) }),
                          `Added to ${topUp.riderName}'s account.`
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red-primary px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {busyId === topUp.id ? 'Adding…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === topUp.id}
                      onClick={() => setDialog({ kind: 'reject', topUp })}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-danger hover:bg-red-50 disabled:opacity-60"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Riders</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter riders">
            {(
              [
                ['all', `All (${riders.length})`],
                ['not-eligible', `Not eligible (${notEligible.length})`],
                ['owes', `Owe money (${owing.length})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${filter === value ? 'bg-brand-dark text-white' : 'border border-gray-200 text-ink hover:border-accent hover:text-accent'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-surface p-10 text-center text-sm text-brand-gray">
            {riders.length === 0 ? 'No riders yet.' : 'No riders match this filter.'}
          </p>
        ) : (
          <ul className="space-y-4">
            {shown.map((rider) => (
              <RiderCard
                key={rider.id}
                rider={rider}
                isBusy={busyId === rider.id}
                isOpen={openHistory === rider.id}
                onToggleHistory={() => setOpenHistory((current) => (current === rider.id ? null : rider.id))}
                onRemind={() => run(rider.id, () => send(`/api/admin/rider-wallets/${rider.id}`, 'POST', { action: 'remind' }), `Reminder sent to ${rider.name}: "Please recharge your account".`)}
                onDialog={(kind) => {
                  setNotice('');
                  setDialog({ kind, rider });
                }}
                onAccess={(access) =>
                  run(
                    rider.id,
                    () => send(`/api/admin/rider-wallets/${rider.id}`, 'POST', { action: 'access', access }),
                    `${rider.name}: ${ACCESS_LABELS[access].toLowerCase()}.`
                  )
                }
              />
            ))}
          </ul>
        )}
      </section>

      {viewing ? <ScreenshotDialog topUp={viewing} onClose={() => setViewing(null)} /> : null}

      {dialog?.kind === 'payment' ? (
        <FormDialog
          title={`Record payment · ${dialog.rider.name}`}
          description="Money Mangwaoo received from this rider outside the app (cash, a transfer). It is added to their account and they are told."
          fields={[
            { name: 'amount', label: 'Amount received (PKR)', type: 'number', required: true, defaultValue: dialog.rider.balance < 0 ? String(-dialog.rider.balance) : '' },
            { name: 'note', label: 'Note (optional)', type: 'text', placeholder: 'e.g. cash at the office' },
          ]}
          submitLabel="Add to account"
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            const rider = dialog.rider;
            const result = await send(`/api/admin/rider-wallets/${rider.id}`, 'POST', { action: 'payment', amount: Number(values.amount), note: values.note });

            if (!result.ok) return result.error;

            done(`${formatPkr(Number(values.amount))} added to ${rider.name}'s account.`);

            return null;
          }}
        />
      ) : null}

      {dialog?.kind === 'adjust' ? (
        <FormDialog
          title={`Adjust account · ${dialog.rider.name}`}
          description="A correction. A plus amount adds money to their account (they owe less); a minus amount takes money away (they owe more). They are told why."
          fields={[
            { name: 'amount', label: 'Amount (PKR, can be negative)', type: 'number', required: true, placeholder: 'e.g. -100 or 250' },
            { name: 'note', label: 'Reason', type: 'text', required: true, placeholder: 'e.g. wrong delivery charge on an order' },
          ]}
          submitLabel="Save correction"
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            const rider = dialog.rider;
            const result = await send(`/api/admin/rider-wallets/${rider.id}`, 'POST', { action: 'adjust', amount: Number(values.amount), note: values.note });

            if (!result.ok) return result.error;

            done(`${rider.name}'s account was corrected.`);

            return null;
          }}
        />
      ) : null}

      {dialog?.kind === 'reject' ? (
        <FormDialog
          title="Reject this recharge"
          description={`${dialog.topUp.riderName}'s ${formatPkr(dialog.topUp.amount)} (ID ${dialog.topUp.transactionId}) is not added. They are told and can send it again.`}
          fields={[{ name: 'reason', label: 'Reason (optional)', type: 'text', placeholder: 'e.g. no such payment in our account' }]}
          submitLabel="Reject"
          danger
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            const topUp = dialog.topUp;
            const result = await send(`/api/admin/rider-top-ups/${topUp.id}`, 'PATCH', { action: 'reject', reason: values.reason });

            if (!result.ok) return result.error;

            done(`Recharge from ${topUp.riderName} rejected.`);

            return null;
          }}
        />
      ) : null}
    </div>
  );
}
