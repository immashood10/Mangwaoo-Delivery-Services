'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, CheckCircle2, Clock, Mail, Phone, RotateCcw, XCircle } from 'lucide-react';
import { FormDialog } from '@/components/AdminRiderWallets';
import type { AdminLoyaltyData, CardDecision, CardHolder, PendingApplication } from '@/lib/loyalty-card';
import { CARD_LIMITS } from '@/lib/loyalty-card-config';
import { formatPkr } from '@/lib/points-config';

const FIELD_CLASS =
  'rounded-xl border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-red-100 disabled:opacity-50';
const INPUT_CLASS = `w-full ${FIELD_CLASS}`;
const LABEL_CLASS = 'mb-1.5 block text-sm font-semibold text-ink';

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

type DialogState = { kind: 'reject'; card: PendingApplication } | { kind: 'revoke'; card: CardHolder } | null;

/** Admin > Loyalty Cards: the rules, the applications waiting for approval, the cards in use and the recent decisions. */
export default function AdminLoyaltyCards({ data }: { data: AdminLoyaltyData }) {
  const router = useRouter();
  const { settings, stats, pending, holders, decisions } = data;
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(settings.enabled);
  const [form, setForm] = useState({
    ordersRequired: String(settings.ordersRequired),
    percentMin: String(settings.percentMin),
    percentMax: String(settings.percentMax),
    maxDiscount: String(settings.maxDiscount),
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

    const result = await send('/api/admin/loyalty-card-settings', 'PUT', {
      enabled,
      ordersRequired: Number(form.ordersRequired),
      percentMin: Number(form.percentMin),
      percentMax: Number(form.percentMax),
      maxDiscount: Number(form.maxDiscount),
    });

    setIsSavingRules(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    done('Saved. The new rules apply from now on; cards already given stay as they are.');
  };

  const approve = async (card: { id: string; customerName: string }, message: string) => {
    setBusyId(card.id);
    setNotice('');
    setError('');

    const result = await send(`/api/admin/loyalty-cards/${card.id}`, 'PATCH', { action: 'approve' });

    setBusyId(null);

    if (!result.ok) {
      setError(result.error);
      router.refresh();
      return;
    }

    done(message);
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

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Applications waiting" value={String(stats.waiting)} tone={stats.waiting > 0 ? 'alert' : 'ink'} />
        <Stat label="Cards in use" value={String(stats.active)} />
        <Stat label="Can apply, have not" value={String(stats.invited)} />
        <Stat label="Discount given so far" value={formatPkr(stats.given)} />
        <Stat label="Orders with a discount" value={String(stats.checkouts)} />
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
              The Loyalty Card is on <span className="font-normal text-brand-gray">(off = no new invitations or applications and no discounts; cards stay as they are)</span>
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="card-orders-required" className={LABEL_CLASS}>
                Delivered orders needed to apply
              </label>
              <input id="card-orders-required" type="number" min={1} max={CARD_LIMITS.ordersRequired} step={1} value={form.ordersRequired} onChange={(event) => setField('ordersRequired', event.target.value)} className={INPUT_CLASS} required />
              <p className="mt-1 text-xs text-brand-gray">MangwaooMart and food orders together.</p>
            </div>
            <div>
              <p className={LABEL_CLASS}>Discount on every order (%)</p>
              <div className="flex items-center gap-2">
                <input aria-label="Smallest discount percent" type="number" min={1} max={CARD_LIMITS.percentMax} step={1} value={form.percentMin} onChange={(event) => setField('percentMin', event.target.value)} className={INPUT_CLASS} required />
                <span className="text-sm text-brand-gray">to</span>
                <input aria-label="Biggest discount percent" type="number" min={1} max={CARD_LIMITS.percentMax} step={1} value={form.percentMax} onChange={(event) => setField('percentMax', event.target.value)} className={INPUT_CLASS} required />
              </div>
              <p className="mt-1 text-xs text-brand-gray">A random % in between for each order. Taken off the items, never the delivery fee; Mangwaoo pays it, not the seller.</p>
            </div>
            <div>
              <label htmlFor="card-max-discount" className={LABEL_CLASS}>
                Most one order can be reduced by (PKR)
              </label>
              <input id="card-max-discount" type="number" min={0} max={CARD_LIMITS.maxDiscount} step={1} value={form.maxDiscount} onChange={(event) => setField('maxDiscount', event.target.value)} className={INPUT_CLASS} required />
              <p className="mt-1 text-xs text-brand-gray">0 = no limit. Use it to protect yourself on very big orders.</p>
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
        <h2 className="mb-3 text-lg font-bold text-ink">Applications waiting ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-surface p-10 text-center text-sm text-brand-gray">No one is waiting for a Loyalty Card.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((card) => (
              <li key={card.id} data-card-id={card.id} className="rounded-2xl border border-yellow-200 bg-surface p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">
                      {card.customerName} applied for a Loyalty Card
                    </p>
                    <p className="mt-1 text-sm text-ink">
                      {card.delivered} delivered {card.delivered === 1 ? 'order' : 'orders'} · items worth {formatPkr(card.itemsValue)}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-gray">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatWhen(card.appliedAt)}
                      </span>
                      {card.customerPhone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {card.customerPhone}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {card.customerEmail}
                      </span>
                      {card.accountRemoved ? <span className="font-semibold text-danger">Account removed</span> : null}
                    </p>
                    {card.earlierNote ? <p className="mt-1 text-xs text-brand-gray">Turned down before: {card.earlierNote}</p> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === card.id || card.accountRemoved}
                      onClick={() => approve(card, `${card.customerName}'s Loyalty Card is approved. Their discounts start with their next order.`)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red-primary px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60"
                    >
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {busyId === card.id ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNotice('');
                        setDialog({ kind: 'reject', card });
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
        <h2 className="mb-3 text-lg font-bold text-ink">Cards in use ({holders.length})</h2>
        {holders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-surface p-8 text-center text-sm text-brand-gray">No card has been approved yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-2xl bg-surface px-5 shadow-soft">
            {holders.map((holder) => (
              <li key={holder.id} data-card-id={holder.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {holder.customerName} · <span className="font-mono">{holder.ref}</span>
                    {holder.accountRemoved ? <span className="ml-2 font-semibold text-danger">Account removed</span> : null}
                  </p>
                  <p className="text-xs text-brand-gray">
                    {holder.approvedAt ? `Since ${formatWhen(holder.approvedAt)} · ` : ''}
                    {holder.checkouts > 0 ? `${formatPkr(holder.saved)} off ${holder.checkouts} ${holder.checkouts === 1 ? 'order' : 'orders'}` : 'No order with a discount yet'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNotice('');
                    setDialog({ kind: 'revoke', card: holder });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-red-50"
                >
                  Take back
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Recently dealt with</h2>
        {decisions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-surface p-8 text-center text-sm text-brand-gray">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-2xl bg-surface px-5 shadow-soft">
            {decisions.map((decision: CardDecision) => (
              <li key={decision.id} data-card-id={decision.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {decision.customerName} · <span className="font-mono">{decision.ref}</span>
                  </p>
                  <p className="text-xs text-brand-gray">
                    {formatWhen(decision.reviewedAt)}
                    {decision.note ? ` · ${decision.note}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-danger">
                    <XCircle className="h-3.5 w-3.5" /> {decision.status === 'REVOKED' ? 'Taken back' : 'Turned down'}
                  </span>
                  {decision.status === 'REVOKED' ? (
                    <button
                      type="button"
                      disabled={busyId === decision.id}
                      onClick={() => approve({ id: decision.id, customerName: decision.customerName }, `${decision.customerName}'s Loyalty Card was given back.`)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-60"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Give the card back
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog?.kind === 'reject' ? (
        <FormDialog
          title={`Turn down · ${dialog.card.customerName}`}
          description="They are told, and can apply again."
          fields={[{ name: 'reason', label: 'Reason (optional)', type: 'text', placeholder: 'e.g. please order a few more times first' }]}
          submitLabel="Turn down"
          danger
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            const card = dialog.card;
            const result = await send(`/api/admin/loyalty-cards/${card.id}`, 'PATCH', { action: 'reject', reason: values.reason });

            if (!result.ok) return result.error;

            done(`${card.customerName}'s application was turned down.`);

            return null;
          }}
        />
      ) : null}

      {dialog?.kind === 'revoke' ? (
        <FormDialog
          title={`Take back the card · ${dialog.card.customerName}`}
          description={`${dialog.card.ref} stops giving discounts from their next order, and they are told. You can give it back later.`}
          fields={[{ name: 'reason', label: 'Reason (optional)', type: 'text', placeholder: 'e.g. misuse of the discount' }]}
          submitLabel="Take back"
          danger
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            const card = dialog.card;
            const result = await send(`/api/admin/loyalty-cards/${card.id}`, 'PATCH', { action: 'revoke', reason: values.reason });

            if (!result.ok) return result.error;

            done(`${card.customerName}'s Loyalty Card was taken back.`);

            return null;
          }}
        />
      ) : null}
    </div>
  );
}
