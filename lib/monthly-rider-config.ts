// Monthly rider: a customer asks for a rider of their own for a month. Shared by the API routes, the customer's page, the
// admin page and the area manager's page (client-safe, no database).
//
// How it works: the customer asks (area, address, the day to start, what they need). An admin or the area's manager sets the
// price for the month and picks the rider. The customer pays Mangwaoo by hand (EasyPaisa etc.) and enters the transaction id;
// an admin checks it and the booking becomes ACTIVE for 30 days. While it is, the customer's new order chats go straight to
// that rider when the rider can take them (see startOrContinueOrderChat).

import { isServiceAreaId } from '@/lib/area-managers-config';
import { RIDER_TOP_UP_METHODS } from '@/lib/rider-wallet-config';
import { normalizePaymentRef } from '@/lib/ad-config';

export type MonthlyRiderStatusKey = 'REQUESTED' | 'QUOTED' | 'PAYMENT_SENT' | 'ACTIVE' | 'ENDED' | 'REJECTED' | 'CANCELLED';

export const MONTHLY_RIDER_STATUS_LABELS: Record<MonthlyRiderStatusKey, string> = {
  REQUESTED: 'Waiting for a price',
  QUOTED: 'Waiting for your payment',
  PAYMENT_SENT: 'Checking your payment',
  ACTIVE: 'Active',
  ENDED: 'Ended',
  REJECTED: 'Not accepted',
  CANCELLED: 'Cancelled',
};

/** Statuses of a booking that is still going: a customer can have only one of these. */
export const RUNNING_STATUSES: MonthlyRiderStatusKey[] = ['REQUESTED', 'QUOTED', 'PAYMENT_SENT', 'ACTIVE'];

/** One booking is one month: this many days from the moment the payment is confirmed. */
export const MONTHLY_RIDER_DAYS = 30;
export const MAX_MONTHLY_ADDRESS_LENGTH = 300;
export const MAX_MONTHLY_NOTES_LENGTH = 500;
export const MAX_MONTHLY_REASON_LENGTH = 200;
export const MAX_MONTHLY_PRICE = 1_000_000;
/** The start day a customer asks for can be at most this many days from now. */
export const MAX_MONTHLY_START_AHEAD_DAYS = 60;

/** The number everyone quotes, e.g. MW-MR10001. */
export function monthlyRiderRef(refNumber: number) {
  return `MW-MR${refNumber}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const KARACHI_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Today's date in Karachi as YYYY-MM-DD. */
export function karachiToday(now = Date.now()) {
  return new Date(now + KARACHI_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/** "5 Nov 2026" for a YYYY-MM-DD day or a date, always on the Karachi calendar. */
export function formatMonthlyDate(value: Date | string) {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  const shifted = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? date : new Date(date.getTime() + KARACHI_UTC_OFFSET_MS);

  return shifted.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Whole days left until `endsAt` (rounded up, never below 0). */
export function daysLeft(endsAt: Date | string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / DAY_MS));
}

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ').slice(0, max) : '';
}

export type MonthlyRiderRequest = { areaId: number; addressText: string; preferredStart: string | null; notes: string | null };

/** What the customer sent when asking for a monthly rider: checked, with a message for the first problem. */
export function parseMonthlyRequest(body: unknown): { request: MonthlyRiderRequest } | { error: string } {
  const data = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;

  if (!isServiceAreaId(data.areaId)) return { error: 'Please choose the area where you need the rider.' };

  const addressText = clean(data.addressText, MAX_MONTHLY_ADDRESS_LENGTH);

  if (addressText.length < 5) return { error: 'Please write the address where the rider should come to you.' };

  let preferredStart: string | null = null;

  if (typeof data.preferredStart === 'string' && data.preferredStart.trim() !== '') {
    const day = data.preferredStart.trim();
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00Z`) : null;

    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) {
      return { error: 'Please choose a valid day to start.' };
    }

    const today = karachiToday();

    if (day < today) return { error: 'The start day cannot be in the past.' };

    const latest = new Date(new Date(`${today}T00:00:00Z`).getTime() + MAX_MONTHLY_START_AHEAD_DAYS * DAY_MS).toISOString().slice(0, 10);

    if (day > latest) return { error: `Please choose a start day within the next ${MAX_MONTHLY_START_AHEAD_DAYS} days.` };

    preferredStart = day;
  }

  const notes = clean(data.notes, MAX_MONTHLY_NOTES_LENGTH);

  return { request: { areaId: data.areaId, addressText, preferredStart, notes: notes || null } };
}

/** What an admin or manager sent when pricing a request: a whole price in PKR and the rider's id. */
export function parseMonthlyQuote(body: unknown): { priceRs: number; riderId: string } | { error: string } {
  const data = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const price = typeof data.priceRs === 'number' ? data.priceRs : typeof data.priceRs === 'string' && data.priceRs.trim() !== '' ? Number(data.priceRs) : NaN;

  if (!Number.isInteger(price) || price < 1 || price > MAX_MONTHLY_PRICE) {
    return { error: `Enter the price for the month in whole rupees (1 to ${MAX_MONTHLY_PRICE.toLocaleString('en-PK')}).` };
  }

  if (typeof data.riderId !== 'string' || data.riderId.trim() === '') return { error: 'Please choose the rider.' };

  return { priceRs: price, riderId: data.riderId.trim() };
}

/** What the customer sent when saying they paid: the method and the transaction id. */
export function parseMonthlyPayment(body: unknown): { method: string; transactionId: string } | { error: string } {
  const data = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const method = typeof data.method === 'string' ? data.method : '';

  if (!(RIDER_TOP_UP_METHODS as readonly string[]).includes(method)) return { error: 'Please choose how you paid.' };

  const transactionId = normalizePaymentRef(data.transactionId);

  if (!transactionId) return { error: 'Enter the transaction ID from your payment message (6 to 40 letters or numbers).' };

  return { method, transactionId };
}

export const MONTHLY_PAYMENT_METHODS = RIDER_TOP_UP_METHODS;
