'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BadgePercent, CheckCircle2, Pause, Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import {
  COUPON_SCOPES,
  COUPON_SCOPE_LABELS,
  COUPON_STATUS_LABELS,
  MAX_COUPON_DESCRIPTION_LENGTH,
  type AdminCoupon,
  type CouponScope,
  type CouponStatus,
} from '@/lib/coupons';

const INPUT_CLASS =
  'w-full rounded-xl border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-red-100 disabled:opacity-60';
const LABEL_CLASS = 'mb-1.5 block text-sm font-semibold text-ink';
const HINT_CLASS = 'mt-1 text-xs text-brand-gray';

const STATUS_STYLES: Record<CouponStatus, string> = {
  ACTIVE: 'bg-green-50 text-success',
  PAUSED: 'bg-gray-100 text-brand-gray',
  EXPIRED: 'bg-red-50 text-danger',
  USED_UP: 'bg-yellow-50 text-warning',
};

type FormState = {
  code: string;
  discountPercent: string;
  description: string;
  appliesTo: CouponScope;
  maxDiscountAmount: string;
  minOrderAmount: string;
  maxUses: string;
  expiresOn: string;
  onePerCustomer: boolean;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  code: '',
  discountPercent: '',
  description: '',
  appliesTo: 'ALL',
  maxDiscountAmount: '',
  minOrderAmount: '',
  maxUses: '',
  expiresOn: '',
  onePerCustomer: true,
  isActive: true,
};

const toForm = (coupon: AdminCoupon): FormState => ({
  code: coupon.code,
  discountPercent: String(coupon.discountPercent),
  description: coupon.description ?? '',
  appliesTo: coupon.appliesTo,
  maxDiscountAmount: coupon.maxDiscountAmount === null ? '' : String(coupon.maxDiscountAmount),
  minOrderAmount: coupon.minOrderAmount === null ? '' : String(coupon.minOrderAmount),
  maxUses: coupon.maxUses === null ? '' : String(coupon.maxUses),
  expiresOn: coupon.expiresOn ?? '',
  onePerCustomer: coupon.onePerCustomer,
  isActive: coupon.isActive,
});

const formatDay = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

async function send(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null);

    return response.ok ? { ok: true as const } : { ok: false as const, error: (data?.error as string | undefined) ?? 'Something went wrong. Please try again.' };
  } catch {
    return { ok: false as const, error: 'Could not reach the server. Please try again.' };
  }
}

function CouponCard({
  coupon,
  isEditing,
  isBusy,
  onEdit,
  onToggle,
  onDelete,
}: {
  coupon: AdminCoupon;
  isEditing: boolean;
  isBusy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const details = [
    COUPON_SCOPE_LABELS[coupon.appliesTo].replace(' (food and MangwaooMart)', ''),
    coupon.minOrderAmount !== null ? `min order PKR ${coupon.minOrderAmount.toLocaleString()}` : null,
    coupon.maxDiscountAmount !== null ? `up to PKR ${coupon.maxDiscountAmount.toLocaleString()} off` : null,
    coupon.onePerCustomer ? 'one use per customer' : 'can be reused',
    coupon.expiresOn ? `until ${formatDay(coupon.expiresOn)}` : 'no expiry',
  ].filter(Boolean);

  return (
    <li className={`rounded-2xl border bg-surface p-5 shadow-soft ${isEditing ? 'border-accent' : 'border-gray-100'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-brand-light px-3 py-1 font-mono text-base font-bold tracking-wider text-ink">{coupon.code}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[coupon.status]}`}>
              {COUPON_STATUS_LABELS[coupon.status]}
            </span>
          </div>
          {coupon.description ? <p className="mt-2 text-sm text-ink">{coupon.description}</p> : null}
        </div>
        <p className="text-2xl font-bold text-accent">{coupon.discountPercent}% off</p>
      </div>

      <p className="mt-3 text-sm text-brand-gray">{details.join(' · ')}</p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <p className="text-sm text-brand-gray">
          Used <span className="font-semibold text-ink">{coupon.usedCount}</span>
          {coupon.maxUses !== null ? ` of ${coupon.maxUses.toLocaleString()}` : ''} {coupon.usedCount === 1 ? 'time' : 'times'}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-60"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {coupon.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {coupon.isActive ? 'Pause' : 'Resume'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-red-600 hover:text-danger disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

/** Admin > Discount: the coupons on the left, the form to make or edit one on the right. */
export default function AdminDiscounts({ coupons }: { coupons: AdminCoupon[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const startEdit = (coupon: AdminCoupon) => {
    setEditing(coupon);
    setForm(toForm(coupon));
    setError('');
    setNotice('');
  };

  const reset = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setNotice('');

    const result = editing
      ? await send(`/api/admin/coupons/${editing.id}`, 'PATCH', form)
      : await send('/api/admin/coupons', 'POST', form);

    setIsSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice(editing ? `Saved ${form.code.trim().toUpperCase()}.` : `Coupon ${form.code.trim().toUpperCase()} is live.`);
    setEditing(null);
    setForm(EMPTY_FORM);
    router.refresh();
  };

  const toggle = async (coupon: AdminCoupon) => {
    setBusyId(coupon.id);
    setError('');
    setNotice('');

    const result = await send(`/api/admin/coupons/${coupon.id}`, 'PATCH', { isActive: !coupon.isActive });

    setBusyId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.refresh();
  };

  const remove = async (coupon: AdminCoupon) => {
    if (!window.confirm(`Delete the coupon ${coupon.code}?`)) return;

    setBusyId(coupon.id);
    setError('');
    setNotice('');

    const result = await send(`/api/admin/coupons/${coupon.id}`, 'DELETE');

    setBusyId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (editing?.id === coupon.id) reset();
    setNotice(`Deleted ${coupon.code}.`);
    router.refresh();
  };

  const codeLocked = Boolean(editing && editing.usedCount > 0);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      {/* Coupons - left */}
      <section aria-labelledby="coupons-heading">
        <h2 id="coupons-heading" className="mb-4 text-lg font-bold text-ink">
          Coupons <span className="text-sm font-normal text-brand-gray">({coupons.length})</span>
        </h2>

        {notice ? (
          <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {notice}
          </p>
        ) : null}

        {coupons.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-surface p-10 text-center">
            <BadgePercent className="mx-auto mb-3 h-8 w-8 text-accent" aria-hidden="true" />
            <p className="mb-1 font-semibold text-ink">No coupons yet</p>
            <p className="mx-auto max-w-sm text-sm text-brand-gray">
              Make the first one with the form. Customers type the code in their cart before they place an order.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {coupons.map((coupon) => (
              <CouponCard
                key={coupon.id}
                coupon={coupon}
                isEditing={editing?.id === coupon.id}
                isBusy={busyId === coupon.id}
                onEdit={() => startEdit(coupon)}
                onToggle={() => toggle(coupon)}
                onDelete={() => remove(coupon)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Form - right */}
      <section aria-labelledby="coupon-form-heading" className="rounded-2xl border border-gray-100 bg-surface p-6 shadow-soft lg:sticky lg:top-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id="coupon-form-heading" className="flex items-center gap-2 text-lg font-bold text-ink">
              {editing ? <Pencil className="h-5 w-5 text-accent" /> : <Plus className="h-5 w-5 text-accent" />}
              {editing ? `Edit ${editing.code}` : 'New coupon'}
            </h2>
            <p className="mt-1 text-sm text-brand-gray">
              {editing ? 'Changes apply to the next customers. Orders already placed keep what they got.' : 'Customers enter the code in their cart before checkout.'}
            </p>
          </div>
          {editing ? (
            <button type="button" onClick={reset} className="rounded-lg p-1.5 text-brand-gray hover:bg-gray-100 hover:text-ink" aria-label="Stop editing">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="coupon-code" className={LABEL_CLASS}>
              Coupon code
            </label>
            <input
              id="coupon-code"
              type="text"
              value={form.code}
              onChange={(event) => set('code', event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
              maxLength={20}
              placeholder="e.g. EID25"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              disabled={codeLocked}
              required
              className={`${INPUT_CLASS} font-mono tracking-wider`}
            />
            <p className={HINT_CLASS}>
              {codeLocked ? 'This coupon has been used, so its code can no longer change.' : '3 to 20 letters, digits, "-" or "_". Customers can type it in any case.'}
            </p>
          </div>

          <div>
            <label htmlFor="coupon-percent" className={LABEL_CLASS}>
              Discount %
            </label>
            <div className="relative">
              <input
                id="coupon-percent"
                type="number"
                inputMode="decimal"
                min={0.01}
                max={100}
                step="any"
                value={form.discountPercent}
                onChange={(event) => set('discountPercent', event.target.value)}
                placeholder="e.g. 15"
                required
                className={`${INPUT_CLASS} pr-10`}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-brand-gray">%</span>
            </div>
            <p className={HINT_CLASS}>Taken off the items only, never the delivery fee.</p>
          </div>

          <fieldset>
            <legend className={LABEL_CLASS}>Applies to</legend>
            <div className="space-y-2">
              {COUPON_SCOPES.map((scope) => (
                <label
                  key={scope}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                    form.appliesTo === scope ? 'border-accent bg-red-50' : 'border-gray-200 hover:border-accent'
                  }`}
                >
                  <input
                    type="radio"
                    name="appliesTo"
                    value={scope}
                    checked={form.appliesTo === scope}
                    onChange={() => set('appliesTo', scope)}
                    className="h-4 w-4 border-gray-300 text-accent focus:ring-accent"
                  />
                  <span className="text-ink">{COUPON_SCOPE_LABELS[scope]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div>
              <label htmlFor="coupon-max-discount" className={LABEL_CLASS}>
                Max discount (PKR)
              </label>
              <input
                id="coupon-max-discount"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.maxDiscountAmount}
                onChange={(event) => set('maxDiscountAmount', event.target.value)}
                placeholder="No limit"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="coupon-min-order" className={LABEL_CLASS}>
                Minimum order (PKR)
              </label>
              <input
                id="coupon-min-order"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.minOrderAmount}
                onChange={(event) => set('minOrderAmount', event.target.value)}
                placeholder="No minimum"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div>
              <label htmlFor="coupon-max-uses" className={LABEL_CLASS}>
                Usage limit
              </label>
              <input
                id="coupon-max-uses"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.maxUses}
                onChange={(event) => set('maxUses', event.target.value)}
                placeholder="Unlimited"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="coupon-expires" className={LABEL_CLASS}>
                Valid until
              </label>
              <input
                id="coupon-expires"
                type="date"
                value={form.expiresOn}
                onChange={(event) => set('expiresOn', event.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <p className={`${HINT_CLASS} -mt-2`}>Leave the limit and date empty for a coupon that never runs out. It works through the whole last day.</p>

          <div>
            <label htmlFor="coupon-description" className={LABEL_CLASS}>
              Note <span className="font-normal text-brand-gray">(optional)</span>
            </label>
            <input
              id="coupon-description"
              type="text"
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              maxLength={MAX_COUPON_DESCRIPTION_LENGTH}
              placeholder="e.g. Eid offer"
              className={INPUT_CLASS}
            />
            <p className={HINT_CLASS}>Shown next to the code in the customer&apos;s cart.</p>
          </div>

          <div className="space-y-2.5">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.onePerCustomer}
                onChange={(event) => set('onePerCustomer', event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
              />
              <span>
                One use per customer
                <span className="block text-xs text-brand-gray">A cancelled order gives the use back.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => set('isActive', event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
              />
              Active (customers can use it now)
            </label>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-6 py-2.5 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : editing ? 'Save changes' : 'Create coupon'}
            </button>
            {editing ? (
              <button type="button" onClick={reset} className="text-sm font-semibold text-brand-gray hover:text-ink">
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
