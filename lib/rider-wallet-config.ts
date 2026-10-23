// Rider wallet rules shared by the API routes, the rider dashboard and the admin page (client-safe, no database).
//
// How it works: Mangwaoo keeps a percentage (30 % to start with) of the delivery charge of every order a rider
// finishes. Each finished order adds a COMMISSION line to the rider's wallet (a negative amount); the rider pays by
// sending money to Mangwaoo and an admin adds it (TOP_UP). A rider may have a few finished orders unpaid
// ("orders on credit", 5 to start with); once that many are unpaid the rider is not eligible for the next order until
// the commission is paid. An admin can override this for one rider (always allow / block).

import { deliveryFeeForDistance } from '@/lib/delivery';
import { distanceInKm } from '@/lib/geo';

export const DEFAULT_COMMISSION_PERCENT = 30;
export const DEFAULT_ORDERS_ON_CREDIT = 5;
export const MAX_ORDERS_ON_CREDIT = 100;

export const MIN_TOP_UP_PKR = 50;
export const MAX_TOP_UP_PKR = 100000;
/** The most a rider may declare as the delivery charge of one order. */
export const MAX_DECLARED_FEE_PKR = 100000;
export const MAX_WALLET_NOTE_LENGTH = 200;
/** The screenshot a rider may attach to a recharge request (the browser shrinks it first, so this is generous). */
export const MAX_PAYMENT_SCREENSHOT_BYTES = 3 * 1024 * 1024;
export const MAX_ADJUSTMENT_PKR = 1000000;

export const RIDER_TOP_UP_METHODS = ['EasyPaisa', 'JazzCash', 'Bank transfer'] as const;

export type RiderOrderAccess = 'AUTO' | 'ALLOWED' | 'BLOCKED';
export type RiderLedgerKind = 'COMMISSION' | 'TOP_UP' | 'ADJUSTMENT';
export type RiderTopUpState = 'PENDING' | 'APPROVED' | 'REJECTED';

/** Why a rider can't receive the next order: unpaid commission, or an admin blocked them. null = eligible. */
export type RiderHold = 'PAYMENT' | 'ADMIN' | null;

export const RECHARGE_TITLE = 'Please recharge your account';

export const ACCESS_LABELS: Record<RiderOrderAccess, string> = {
  AUTO: 'Automatic (by payments)',
  ALLOWED: 'Always allowed',
  BLOCKED: 'Blocked',
};

/** Whether the rider may receive the next order, as far as the wallet and the admin are concerned. */
export function riderHold(rider: { orderAccess: RiderOrderAccess; paymentHold: boolean }): RiderHold {
  if (rider.orderAccess === 'BLOCKED') return 'ADMIN';
  if (rider.orderAccess === 'ALLOWED') return null;

  return rider.paymentHold ? 'PAYMENT' : null;
}

/** Mangwaoo's share of `fee`, in whole PKR (rounded up). */
export function commissionFor(fee: number, percent: number) {
  // The tiny allowance keeps floating point (e.g. 30 % of 70 = 21.000000000000004) from rounding a whole rupee up.
  return Math.ceil((fee * percent) / 100 - 1e-9);
}

/**
 * The least an order chat's delivery charge can be: the petrol for the ride from the pickup to the drop-off
 * (`lib/delivery.ts`), so a rider can't avoid the commission by declaring nothing. 0 when the chat has no pickup point.
 */
export function minimumFeeForChat(chat: {
  lat: number;
  lng: number;
  pickupLat: number | null;
  pickupLng: number | null;
}) {
  if (chat.pickupLat === null || chat.pickupLng === null) return 0;

  return deliveryFeeForDistance(distanceInKm({ lat: chat.pickupLat, lng: chat.pickupLng }, { lat: chat.lat, lng: chat.lng }));
}

/** "Rs 1,250". Negative amounts keep their minus sign: "-Rs 450". */
export function formatPkr(amount: number) {
  const text = `Rs ${Math.abs(amount).toLocaleString('en-PK')}`;

  return amount < 0 ? `-${text}` : text;
}

/** The wallet as the rider and the admin see it. */
export type WalletSummary = {
  /** Negative = the rider owes Mangwaoo. */
  balance: number;
  unpaidOrders: number;
  hold: RiderHold;
};

/** What a rider is told when the commission is due. */
export function rechargeMessage(wallet: { balance: number; unpaidOrders: number }) {
  const owed = Math.max(0, -wallet.balance);

  return owed > 0
    ? `You owe Mangwaoo ${formatPkr(owed)} commission for ${wallet.unpaidOrders} finished ${wallet.unpaidOrders === 1 ? 'order' : 'orders'}. Recharge your account to receive new orders.`
    : 'Recharge your account to receive new orders.';
}
