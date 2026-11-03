'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Bike, CalendarDays, CheckCircle2, Clock, MapPin, XCircle } from 'lucide-react';
import { FormDialog } from '@/components/AdminRiderWallets';
import type { AssignableRider } from '@/lib/area-managers-config';
import type { MonthlyRiderAdminData, MonthlyRiderBookingView } from '@/lib/monthly-rider';
import { MONTHLY_RIDER_STATUS_LABELS, formatMonthlyDate } from '@/lib/monthly-rider-config';
import { formatPkr } from '@/lib/rider-wallet-config';

const FIELD_CLASS =
  'rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100 disabled:opacity-50';

async function send(url: string, body: unknown) {
  try {
    const response = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => null);

    return response.ok ? { ok: true as const } : { ok: false as const, error: (data?.error as string | undefined) ?? 'Something went wrong. Please try again.' };
  } catch {
    return { ok: false as const, error: 'Could not reach the server. Please try again.' };
  }
}

function riderLabel(rider: AssignableRider) {
  const parts = [rider.name, rider.online ? 'online' : 'offline'];

  if (rider.distanceKm !== null) parts.push(`${rider.distanceKm} km`);
  if (rider.reason && rider.hold) parts.push(rider.reason);

  return parts.join(' · ');
}

function RiderSelect({ id, riders, value, onChange }: { id: string; riders: AssignableRider[]; value: string; onChange: (value: string) => void }) {
  return (
    <select id={id} aria-label="Rider" value={value} onChange={(event) => onChange(event.target.value)} className={`${FIELD_CLASS} min-w-0 flex-1`} required>
      <option value="">Choose a rider</option>
      {riders.map((rider) => (
        <option key={rider.id} value={rider.id} disabled={rider.hold === 'ADMIN'}>
          {riderLabel(rider)}
        </option>
      ))}
    </select>
  );
}

type Dialog = { kind: 'reject' | 'end'; booking: MonthlyRiderBookingView } | null;

function BookingCard({
  booking,
  riders,
  apiBase,
  isAdmin,
  onDialog,
}: {
  booking: MonthlyRiderBookingView;
  riders: AssignableRider[];
  apiBase: string;
  isAdmin: boolean;
  onDialog: (dialog: Dialog) => void;
}) {
  const router = useRouter();
  const [price, setPrice] = useState(booking.priceRs ? String(booking.priceRs) : '');
  const [riderId, setRiderId] = useState(booking.riderId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const url = `${apiBase}/${booking.id}`;

  const run = async (body: unknown) => {
    setBusy(true);
    setError('');

    const result = await send(url, body);

    setBusy(false);

    if (!result.ok) setError(result.error);

    router.refresh();
  };

  const submitQuote = (event: FormEvent) => {
    event.preventDefault();
    void run({ action: 'quote', priceRs: price, riderId });
  };

  const submitChange = (event: FormEvent) => {
    event.preventDefault();
    void run({ action: 'change-rider', riderId });
  };

  const waiting = booking.status === 'REQUESTED' || booking.status === 'PAYMENT_SENT';

  return (
    <li className="space-y-3 rounded-2xl bg-surface p-5 shadow-soft" data-booking-id={booking.id} data-status={booking.status}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-gray">{booking.ref}</p>
          <p className="font-bold text-ink">{booking.customerName}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            booking.status === 'ACTIVE' ? 'bg-green-50 text-success' : waiting ? 'bg-yellow-50 text-warning' : 'bg-brand-light text-brand-gray'
          }`}
        >
          {booking.status === 'ACTIVE' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {booking.status === 'REQUESTED'
            ? 'Needs a price and rider'
            : booking.status === 'PAYMENT_SENT'
              ? 'Payment to check'
              : booking.status === 'QUOTED'
                ? 'Waiting for the customer to pay'
                : MONTHLY_RIDER_STATUS_LABELS[booking.status]}
        </span>
      </div>

      <div className="space-y-1 text-sm text-brand-gray">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold text-ink">{booking.areaName}</span> · {booking.addressText}
          </span>
        </p>
        {booking.preferredStart ? (
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            Wants to start {formatMonthlyDate(booking.preferredStart)}
          </p>
        ) : null}
        {booking.notes ? <p className="text-ink">&ldquo;{booking.notes}&rdquo;</p> : null}
        <p>Asked on {formatMonthlyDate(booking.createdAt)}</p>
      </div>

      {booking.priceRs && booking.status !== 'REQUESTED' ? (
        <p className="text-sm text-ink">
          <span className="font-bold">{formatPkr(booking.priceRs)}</span> for the month
          {booking.riderName ? (
            <>
              {' '}
              ·{' '}
              <span className="inline-flex items-center gap-1 font-semibold">
                <Bike className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                {booking.riderName}
              </span>
            </>
          ) : (
            <span className="font-semibold text-warning"> · no rider (choose one again)</span>
          )}
        </p>
      ) : null}

      {booking.status === 'PAYMENT_SENT' ? (
        <p className="rounded-xl bg-brand-light p-3 text-sm text-ink">
          Paid by <span className="font-semibold">{booking.paymentMethod}</span>, transaction ID <span className="font-mono font-semibold">{booking.transactionId}</span>
          {booking.paymentSentAt ? ` (${formatMonthlyDate(booking.paymentSentAt)})` : ''}. Check that the money arrived, then confirm.
        </p>
      ) : null}

      {booking.status === 'ACTIVE' && booking.startsAt && booking.endsAt ? (
        <p className="text-sm text-ink">
          {formatMonthlyDate(booking.startsAt)} to {formatMonthlyDate(booking.endsAt)} · <span className="font-semibold">{booking.daysLeft} {booking.daysLeft === 1 ? 'day' : 'days'} left</span>
        </p>
      ) : null}

      {booking.status === 'REQUESTED' || booking.status === 'QUOTED' ? (
        <form onSubmit={submitQuote} className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Price for the month (PKR)"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="Price (PKR)"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className={`${FIELD_CLASS} w-36`}
            required
          />
          <RiderSelect id={`rider-${booking.id}`} riders={riders} value={riderId} onChange={setRiderId} />
          <button type="submit" disabled={busy} className="rounded-lg bg-brand-red-primary px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60">
            {booking.status === 'QUOTED' ? 'Update price and rider' : 'Set price and rider'}
          </button>
        </form>
      ) : null}

      {booking.status === 'PAYMENT_SENT' || booking.status === 'ACTIVE' ? (
        <form onSubmit={submitChange} className="flex flex-wrap items-center gap-2">
          <RiderSelect id={`change-${booking.id}`} riders={riders} value={riderId} onChange={setRiderId} />
          <button
            type="submit"
            disabled={busy || riderId === '' || riderId === booking.riderId}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-ink hover:bg-brand-light disabled:opacity-50"
          >
            Change rider
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isAdmin && booking.status === 'PAYMENT_SENT' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run({ action: 'confirm' })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red-primary px-3 py-2 text-xs font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60"
          >
            <BadgeCheck className="h-3.5 w-3.5" />
            Payment received, start the month
          </button>
        ) : null}
        {!isAdmin && booking.status === 'PAYMENT_SENT' ? <p className="text-xs text-brand-gray">An admin will check the payment.</p> : null}
        {isAdmin && (booking.status === 'REQUESTED' || booking.status === 'QUOTED' || booking.status === 'PAYMENT_SENT') ? (
          <button
            type="button"
            onClick={() => onDialog({ kind: 'reject', booking })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-ink hover:bg-brand-light"
          >
            <XCircle className="h-3.5 w-3.5" />
            Turn down
          </button>
        ) : null}
        {isAdmin && booking.status === 'ACTIVE' ? (
          <button
            type="button"
            onClick={() => onDialog({ kind: 'end', booking })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-ink hover:bg-brand-light"
          >
            <XCircle className="h-3.5 w-3.5" />
            End the month now
          </button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The admin's and the area manager's monthly rider screen. An admin sees every area and does every step; a manager sees only
 * their area's bookings and can set the price and rider (the admins check the payments).
 */
export default function MonthlyRiderManage({
  data,
  riders,
  mode,
}: {
  data: MonthlyRiderAdminData;
  riders: AssignableRider[];
  mode: 'admin' | 'asm';
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const isAdmin = mode === 'admin';
  const apiBase = isAdmin ? '/api/admin/monthly-riders' : '/api/asm/monthly-riders';

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <p className="text-xs text-brand-gray">Need a price and rider</p>
          <p className={`mt-1 text-2xl font-bold ${data.counts.requested > 0 ? 'text-warning' : 'text-ink'}`}>{data.counts.requested}</p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <p className="text-xs text-brand-gray">Payments to check</p>
          <p className={`mt-1 text-2xl font-bold ${data.counts.payments > 0 ? 'text-warning' : 'text-ink'}`}>{data.counts.payments}</p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <p className="text-xs text-brand-gray">Active monthly riders</p>
          <p className="mt-1 text-2xl font-bold text-ink">{data.counts.active}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Running ({data.running.length})</h2>
        {data.running.length === 0 ? (
          <p className="rounded-2xl bg-surface p-6 text-sm text-brand-gray shadow-soft">No monthly rider requests right now.</p>
        ) : (
          <ul className="space-y-3">
            {data.running.map((booking) => (
              <BookingCard key={`${booking.id}-${booking.status}-${booking.riderId ?? ''}`} booking={booking} riders={riders} apiBase={apiBase} isAdmin={isAdmin} onDialog={setDialog} />
            ))}
          </ul>
        )}
      </section>

      {data.finished.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold text-ink">Finished</h2>
          <ul className="space-y-2">
            {data.finished.map((booking) => (
              <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-4 text-sm shadow-soft">
                <div>
                  <p className="font-semibold text-ink">
                    {booking.ref} · {booking.customerName} · {booking.areaName}
                  </p>
                  <p className="text-brand-gray">
                    {booking.startsAt && booking.endsAt ? `${formatMonthlyDate(booking.startsAt)} to ${formatMonthlyDate(booking.endsAt)}` : formatMonthlyDate(booking.createdAt)}
                    {booking.riderName ? ` · ${booking.riderName}` : ''}
                    {booking.priceRs ? ` · ${formatPkr(booking.priceRs)}` : ''}
                  </p>
                  {booking.note ? <p className="text-brand-gray">{booking.note}</p> : null}
                </div>
                <span className="text-xs font-semibold text-brand-gray">{MONTHLY_RIDER_STATUS_LABELS[booking.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dialog ? (
        <FormDialog
          title={dialog.kind === 'reject' ? `Turn down ${dialog.booking.ref}` : `End ${dialog.booking.ref} now`}
          description={
            dialog.kind === 'reject'
              ? dialog.booking.status === 'PAYMENT_SENT'
                ? 'The customer says they paid. Turning this down does not return the money: send it back yourself.'
                : 'The customer is told their request was not accepted.'
              : 'The month ends now and the customer’s orders go the usual way again. The customer and the rider are told.'
          }
          fields={[{ name: 'reason', label: 'Reason (optional)', type: 'text', placeholder: 'Shown to the customer' }]}
          submitLabel={dialog.kind === 'reject' ? 'Turn down' : 'End the month'}
          danger
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            const result = await send(`${apiBase}/${dialog.booking.id}`, { action: dialog.kind, reason: values.reason });

            if (!result.ok) return result.error;

            setDialog(null);
            router.refresh();

            return null;
          }}
        />
      ) : null}
    </div>
  );
}
