'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, CalendarDays, CheckCircle2, Clock, Info, Star, XCircle } from 'lucide-react';
import { AD_PAYMENT } from '@/lib/ad-config';
import { AREA_OPTIONS } from '@/lib/area-managers-config';
import type { CustomerPageData, MonthlyRiderBookingView } from '@/lib/monthly-rider';
import {
  MAX_MONTHLY_ADDRESS_LENGTH,
  MAX_MONTHLY_NOTES_LENGTH,
  MONTHLY_PAYMENT_METHODS,
  MONTHLY_RIDER_DAYS,
  MONTHLY_RIDER_STATUS_LABELS,
  formatMonthlyDate,
  karachiToday,
} from '@/lib/monthly-rider-config';
import { formatPkr } from '@/lib/rider-wallet-config';

const FIELD_CLASS =
  'w-full rounded-xl border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100 disabled:opacity-50';
const LABEL_CLASS = 'mb-1.5 block text-sm font-semibold text-ink';

async function post(url: string, body: unknown) {
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => null);

    return response.ok ? { ok: true as const } : { ok: false as const, error: (data?.error as string | undefined) ?? 'Something went wrong. Please try again.' };
  } catch {
    return { ok: false as const, error: 'Could not reach the server. Please try again.' };
  }
}

function RiderLine({ booking }: { booking: MonthlyRiderBookingView }) {
  if (!booking.riderName) return null;

  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
      <Bike className="h-4 w-4 text-accent" aria-hidden="true" />
      <span className="font-semibold">{booking.riderName}</span>
      {booking.riderRating ? (
        <span className="inline-flex items-center gap-1 text-brand-gray">
          <Star className="h-3.5 w-3.5 fill-current text-warning" aria-hidden="true" />
          {booking.riderRating.average.toFixed(1)} ({booking.riderRating.count})
        </span>
      ) : (
        <span className="text-brand-gray">New rider</span>
      )}
    </p>
  );
}

function RequestForm({ onDone }: { onDone: () => void }) {
  const [areaId, setAreaId] = useState('');
  const [addressText, setAddressText] = useState('');
  const [preferredStart, setPreferredStart] = useState('');
  const [notes, setNotes] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    setError('');

    const result = await post('/api/monthly-rider', { areaId: areaId ? Number(areaId) : null, addressText, preferredStart: preferredStart || null, notes });

    setIsSending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-surface p-6 shadow-soft" data-testid="monthly-rider-form">
      <h2 className="text-lg font-bold text-ink">Ask for a monthly rider</h2>

      <div>
        <label htmlFor="monthly-area" className={LABEL_CLASS}>
          Your area
        </label>
        <select id="monthly-area" value={areaId} onChange={(event) => setAreaId(event.target.value)} className={FIELD_CLASS} required>
          <option value="">Choose your area</option>
          {AREA_OPTIONS.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="monthly-address" className={LABEL_CLASS}>
          Address where the rider should come
        </label>
        <input
          id="monthly-address"
          type="text"
          value={addressText}
          onChange={(event) => setAddressText(event.target.value)}
          maxLength={MAX_MONTHLY_ADDRESS_LENGTH}
          placeholder="House / street / landmark"
          className={FIELD_CLASS}
          required
        />
      </div>

      <div>
        <label htmlFor="monthly-start" className={LABEL_CLASS}>
          Day you want to start <span className="font-normal text-brand-gray">(optional)</span>
        </label>
        <input id="monthly-start" type="date" value={preferredStart} min={karachiToday()} onChange={(event) => setPreferredStart(event.target.value)} className={FIELD_CLASS} />
      </div>

      <div>
        <label htmlFor="monthly-notes" className={LABEL_CLASS}>
          What do you need the rider for? <span className="font-normal text-brand-gray">(optional)</span>
        </label>
        <textarea
          id="monthly-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={MAX_MONTHLY_NOTES_LENGTH}
          rows={3}
          placeholder="For example: food and grocery deliveries every day, mostly in the evening"
          className={FIELD_CLASS}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSending}
        className="rounded-xl bg-brand-red-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60"
      >
        {isSending ? 'Sending…' : 'Send request'}
      </button>
    </form>
  );
}

function PayForm({ booking, onDone }: { booking: MonthlyRiderBookingView; onDone: () => void }) {
  const [method, setMethod] = useState<string>(MONTHLY_PAYMENT_METHODS[0]);
  const [transactionId, setTransactionId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    setError('');

    const result = await post(`/api/monthly-rider/${booking.id}`, { action: 'pay', method, transactionId });

    setIsSending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-gray-200 p-4" data-testid="monthly-rider-pay-form">
      <p className="text-sm text-brand-gray">
        Send <span className="font-bold text-ink">{formatPkr(booking.priceRs ?? 0)}</span> by{' '}
        <span className="font-semibold text-ink">{AD_PAYMENT.method}</span> to <span className="font-bold text-ink">{AD_PAYMENT.accountNumber}</span> (
        {AD_PAYMENT.accountName}), then enter the transaction ID you receive. Your month starts when we have checked the payment.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="monthly-method" className={LABEL_CLASS}>
            How you paid
          </label>
          <select id="monthly-method" value={method} onChange={(event) => setMethod(event.target.value)} className={FIELD_CLASS}>
            {MONTHLY_PAYMENT_METHODS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="monthly-txn" className={LABEL_CLASS}>
            Transaction ID
          </label>
          <input id="monthly-txn" type="text" value={transactionId} onChange={(event) => setTransactionId(event.target.value)} maxLength={60} className={FIELD_CLASS} required />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSending}
        className="rounded-xl bg-brand-red-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60"
      >
        {isSending ? 'Sending…' : 'I have paid'}
      </button>
    </form>
  );
}

function CurrentBooking({ booking, onChanged }: { booking: MonthlyRiderBookingView; onChanged: () => void }) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState('');
  const canCancel = booking.status === 'REQUESTED' || booking.status === 'QUOTED';

  const cancel = async () => {
    if (!window.confirm('Cancel this monthly rider request?')) return;

    setIsCancelling(true);
    setError('');

    const result = await post(`/api/monthly-rider/${booking.id}`, { action: 'cancel' });

    setIsCancelling(false);

    if (!result.ok) {
      setError(result.error);
      onChanged();
      return;
    }

    onChanged();
  };

  return (
    <section className="space-y-4 rounded-2xl bg-surface p-6 shadow-soft" data-testid="monthly-rider-current" data-status={booking.status}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-gray">{booking.ref}</p>
          <h2 className="text-lg font-bold text-ink">
            {booking.status === 'ACTIVE' ? 'Your monthly rider' : 'Your monthly rider request'}
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            booking.status === 'ACTIVE' ? 'bg-green-50 text-success' : 'bg-yellow-50 text-warning'
          }`}
        >
          {booking.status === 'ACTIVE' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {MONTHLY_RIDER_STATUS_LABELS[booking.status]}
        </span>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-brand-gray">Area</dt>
          <dd className="font-semibold text-ink">{booking.areaName}</dd>
        </div>
        <div>
          <dt className="text-brand-gray">Address</dt>
          <dd className="font-semibold text-ink">{booking.addressText}</dd>
        </div>
        {booking.preferredStart ? (
          <div>
            <dt className="text-brand-gray">Wanted start</dt>
            <dd className="font-semibold text-ink">{formatMonthlyDate(booking.preferredStart)}</dd>
          </div>
        ) : null}
        {booking.notes ? (
          <div>
            <dt className="text-brand-gray">Your note</dt>
            <dd className="font-semibold text-ink">{booking.notes}</dd>
          </div>
        ) : null}
      </dl>

      {booking.status === 'REQUESTED' ? (
        <p className="rounded-xl bg-brand-light p-4 text-sm text-brand-gray">
          We got your request. Mangwaoo will set the price for the month and choose a rider for you, and you will get a notification.
        </p>
      ) : null}

      {booking.status === 'QUOTED' ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-brand-light p-4">
            <p className="text-sm text-brand-gray">Price for {MONTHLY_RIDER_DAYS} days</p>
            <p className="text-2xl font-bold text-ink">{formatPkr(booking.priceRs ?? 0)}</p>
            <div className="mt-2">
              <RiderLine booking={booking} />
            </div>
          </div>
          <PayForm booking={booking} onDone={onChanged} />
        </div>
      ) : null}

      {booking.status === 'PAYMENT_SENT' ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-brand-light p-4">
            <p className="text-sm text-brand-gray">Your payment</p>
            <p className="font-bold text-ink">
              {formatPkr(booking.priceRs ?? 0)} · {booking.paymentMethod} · ID {booking.transactionId}
            </p>
            <div className="mt-2">
              <RiderLine booking={booking} />
            </div>
          </div>
          <p className="text-sm text-brand-gray">We are checking your payment. Your month starts as soon as it is confirmed.</p>
        </div>
      ) : null}

      {booking.status === 'ACTIVE' && booking.startsAt && booking.endsAt ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-brand-light p-4">
            <RiderLine booking={booking} />
            <p className="mt-2 flex items-center gap-2 text-sm text-ink">
              <CalendarDays className="h-4 w-4 text-accent" aria-hidden="true" />
              {formatMonthlyDate(booking.startsAt)} to {formatMonthlyDate(booking.endsAt)}
              <span className="font-semibold">· {booking.daysLeft} {booking.daysLeft === 1 ? 'day' : 'days'} left</span>
            </p>
          </div>
          <p className="flex gap-2 text-sm text-brand-gray">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Send your order from the Chat window or the cart and it goes straight to your rider. If they are offline or busy, your order
            goes the usual way so you are never left waiting. You can chat with your rider inside the order.
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      {canCancel ? (
        <button
          type="button"
          onClick={cancel}
          disabled={isCancelling}
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-light disabled:opacity-60"
        >
          {isCancelling ? 'Cancelling…' : 'Cancel request'}
        </button>
      ) : null}
    </section>
  );
}

/** Monthly rider: ask for one, pay when the price is set, and see the rider once the month is active. */
export default function MonthlyRiderView({ data }: { data: CustomerPageData }) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-surface p-6 shadow-soft">
        <h2 className="mb-3 text-lg font-bold text-ink">How it works</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-brand-gray">
          <li>Tell us your area and address.</li>
          <li>Mangwaoo sets the price for the month and chooses a rider for you.</li>
          <li>You pay and enter the transaction ID. We check it.</li>
          <li>For {MONTHLY_RIDER_DAYS} days your orders go straight to your own rider.</li>
        </ol>
      </section>

      {data.current ? <CurrentBooking booking={data.current} onChanged={refresh} /> : <RequestForm onDone={refresh} />}

      {data.history.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold text-ink">Earlier requests</h2>
          <ul className="space-y-2">
            {data.history.map((booking) => (
              <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-4 text-sm shadow-soft">
                <div>
                  <p className="font-semibold text-ink">
                    {booking.ref} · {booking.areaName}
                  </p>
                  <p className="text-brand-gray">
                    {booking.startsAt && booking.endsAt
                      ? `${formatMonthlyDate(booking.startsAt)} to ${formatMonthlyDate(booking.endsAt)}`
                      : formatMonthlyDate(booking.createdAt)}
                    {booking.riderName ? ` · ${booking.riderName}` : ''}
                    {booking.priceRs ? ` · ${formatPkr(booking.priceRs)}` : ''}
                  </p>
                  {booking.note ? <p className="text-brand-gray">{booking.note}</p> : null}
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-gray">
                  {booking.status === 'REJECTED' || booking.status === 'CANCELLED' ? <XCircle className="h-3.5 w-3.5" /> : null}
                  {MONTHLY_RIDER_STATUS_LABELS[booking.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
