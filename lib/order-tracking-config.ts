// Live order tracking: the shapes the tracking page and its API share, the wording of every step, and the arithmetic
// (how far the rider is, roughly how long). Client-safe: no database and nothing that only runs on the server.
// The data comes from lib/order-tracking.ts; the page is components/OrderTracker.tsx.

import { distanceInKm, formatDistance, type Coordinates } from '@/lib/geo';
import type { OrderKind } from '@/lib/order-number';

export type TrackStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

/** Short names of the statuses, for chips and lists. */
export const TRACK_STATUS_LABEL: Record<TrackStatus, string> = {
  PENDING: 'Waiting for the restaurant',
  CONFIRMED: 'Accepted',
  PREPARING: 'Being prepared',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** How often an open tracking page asks for news (it pauses while the tab is hidden and stops once the order is over). */
export const TRACKING_POLL_MS = 5000;
/** A rider's position older than this is shown as "last seen", not as live… */
export const LOCATION_STALE_SECONDS = 120;
/** …and older than this it is not shown at all (the phone is probably off or out of signal). */
export const LOCATION_HIDE_SECONDS = 15 * 60;
/** A rough city speed for a delivery bike, and how much longer the road is than the straight line: together they give "about N min". */
export const AVERAGE_RIDER_SPEED_KMH = 20;
export const ROAD_DETOUR_FACTOR = 1.35;
/** Closer than this to where they are heading counts as "arriving". */
export const ARRIVING_WITHIN_KM = 0.15;

/** An order that is still going: the tracking page keeps updating for these. */
export function isLiveStatus(status: TrackStatus) {
  return status !== 'DELIVERED' && status !== 'CANCELLED';
}

/** About how many minutes a ride of `straightLineKm` takes (never under 1). */
export function estimateEtaMinutes(straightLineKm: number) {
  const roadKm = Math.max(0, straightLineKm) * ROAD_DETOUR_FACTOR;

  return Math.max(1, Math.round((roadKm / AVERAGE_RIDER_SPEED_KMH) * 60));
}

// ── The timeline ────────────────────────────────────────────

export type TrackStepKey = 'PLACED' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export type TrackStepState = 'done' | 'current' | 'upcoming' | 'cancelled';

export type TrackStep = {
  key: TrackStepKey;
  label: string;
  detail: string;
  /** When the order reached it (ISO); null = not yet, or an order from before step times were kept. */
  at: string | null;
  state: TrackStepState;
};

export type StepTimes = {
  placedAt: Date;
  confirmedAt: Date | null;
  preparingAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
};

const FLOW: Exclude<TrackStepKey, 'CANCELLED'>[] = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const FLOW_POSITION: Record<Exclude<TrackStatus, 'CANCELLED'>, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  PREPARING: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
};

function stepCopy(key: TrackStepKey, kind: OrderKind, storeName: string) {
  switch (key) {
    case 'PLACED':
      return { label: 'Order placed', detail: `Sent to ${storeName}.` };
    case 'CONFIRMED':
      return { label: 'Accepted', detail: `${storeName} accepted your order.` };
    case 'PREPARING':
      return kind === 'gulplaza'
        ? { label: 'Preparing', detail: 'Your food is being prepared.' }
        : { label: 'Packing', detail: 'Your items are being packed.' };
    case 'OUT_FOR_DELIVERY':
      return { label: 'On the way', detail: 'Your rider has picked up your order.' };
    case 'DELIVERED':
      return { label: 'Delivered', detail: 'Delivered to your address.' };
    default:
      return { label: 'Cancelled', detail: 'This order was cancelled.' };
  }
}

/**
 * The steps an order goes through, each with the time it got there. A cancelled order shows the steps it did reach
 * (the ones that have a time) and then "Cancelled" in place of the rest.
 */
export function buildSteps(input: { status: TrackStatus; kind: OrderKind; storeName: string } & StepTimes): TrackStep[] {
  const { status, kind, storeName } = input;
  const iso = (date: Date | null) => (date ? date.toISOString() : null);
  const times: Record<Exclude<TrackStepKey, 'CANCELLED'>, Date | null> = {
    PLACED: input.placedAt,
    CONFIRMED: input.confirmedAt,
    PREPARING: input.preparingAt,
    OUT_FOR_DELIVERY: input.outForDeliveryAt,
    DELIVERED: input.deliveredAt,
  };

  if (status === 'CANCELLED') {
    const reached = FLOW.filter((key) => key === 'PLACED' || (key !== 'DELIVERED' && times[key] !== null));

    return [
      ...reached.map((key) => ({ key, ...stepCopy(key, kind, storeName), at: iso(times[key]), state: 'done' as const })),
      { key: 'CANCELLED' as const, ...stepCopy('CANCELLED', kind, storeName), at: iso(input.cancelledAt), state: 'cancelled' as const },
    ];
  }

  const position = FLOW_POSITION[status];

  return FLOW.map((key, index) => ({
    key,
    ...stepCopy(key, kind, storeName),
    at: iso(times[key]),
    state: (index < position || (index === position && status === 'DELIVERED') ? 'done' : index === position ? 'current' : 'upcoming') as TrackStepState,
  }));
}

// ── The rider ───────────────────────────────────────────────

export type TrackRiderState = 'NONE' | 'SEARCHING' | 'ASSIGNED';

export type TrackRider = {
  /** NONE: no rider and none being looked for (or the order is over). SEARCHING: the order chat is open, nobody took it yet. */
  state: TrackRiderState;
  /** SEARCHING only: the order is with the customer's Area Sales Manager, who picks the rider (otherwise the first rider to accept takes it). */
  managed: boolean;
  /** The order chat (where the customer talks to the rider), when there is a live one. */
  chatId: string | null;
  name: string | null;
  vehicle: string | null;
  rating: { average: number; count: number } | null;
  /** Where the rider is (only while the order is going). `stale`: older than LOCATION_STALE_SECONDS, so not live any more. */
  location: { lat: number; lng: number; updatedAt: string; ageSeconds: number; stale: boolean } | null;
  /** What the rider is heading for: the restaurant before the order has left it, the customer once it is on the way. */
  target: 'STORE' | 'CUSTOMER' | null;
  /** Straight-line distance to the target (0.1 km) and the rough minutes it takes; null without a fresh position. */
  distanceKm: number | null;
  etaMinutes: number | null;
  /** Within ARRIVING_WITHIN_KM of the target. */
  arriving: boolean;
};

const NO_RIDER: TrackRider = {
  state: 'NONE',
  managed: false,
  chatId: null,
  name: null,
  vehicle: null,
  rating: null,
  location: null,
  target: null,
  distanceKm: null,
  etaMinutes: null,
  arriving: false,
};

/**
 * What the customer may know about the rider of a live order: that one is being looked for, or who it is and where they are.
 * The position is only handed out while the order is going, and only for a rider who has taken it.
 */
export function buildRiderView(input: {
  status: TrackStatus;
  chat: { id: string; status: 'OPEN' | 'ACTIVE' | 'CLOSED'; managed?: boolean } | null;
  rider: { name: string; vehicle: string | null; lat: number | null; lng: number | null; locationAt: Date | null } | null;
  rating: { average: number; count: number } | null;
  store: Coordinates | null;
  dropOff: Coordinates | null;
  now: Date;
}): TrackRider {
  const { status, chat, rider } = input;

  if (!isLiveStatus(status) || !chat || chat.status === 'CLOSED') return NO_RIDER;
  if (chat.status === 'OPEN' || !rider) return { ...NO_RIDER, state: 'SEARCHING', managed: chat.managed === true, chatId: chat.id };

  const ageSeconds = rider.locationAt ? Math.max(0, Math.round((input.now.getTime() - rider.locationAt.getTime()) / 1000)) : null;
  const position = rider.lat !== null && rider.lng !== null && rider.locationAt && ageSeconds !== null && ageSeconds <= LOCATION_HIDE_SECONDS ? { lat: rider.lat, lng: rider.lng } : null;
  const location =
    position && rider.locationAt && ageSeconds !== null
      ? { ...position, updatedAt: rider.locationAt.toISOString(), ageSeconds, stale: ageSeconds > LOCATION_STALE_SECONDS }
      : null;

  const target = status === 'OUT_FOR_DELIVERY' ? (input.dropOff ? ('CUSTOMER' as const) : null) : input.store ? ('STORE' as const) : null;
  const targetPoint = target === 'CUSTOMER' ? input.dropOff : target === 'STORE' ? input.store : null;
  const km = location && !location.stale && targetPoint ? distanceInKm(position as Coordinates, targetPoint) : null;

  return {
    state: 'ASSIGNED',
    managed: false,
    chatId: chat.id,
    name: rider.name,
    vehicle: rider.vehicle,
    rating: input.rating,
    location,
    target,
    distanceKm: km === null ? null : Math.round(km * 10) / 10,
    etaMinutes: km === null ? null : estimateEtaMinutes(km),
    arriving: km !== null && km <= ARRIVING_WITHIN_KM,
  };
}

// ── The words on top of the page ────────────────────────────

/** The big line and the small line under it, for where the order and its rider are now. */
export function describeProgress(input: { status: TrackStatus; kind: OrderKind; storeName: string; rider: TrackRider }): { headline: string; subline: string } {
  const { status, kind, storeName, rider } = input;
  const riderName = rider.name ?? 'Your rider';
  const away = rider.distanceKm !== null ? formatDistance(rider.distanceKm) : null;

  switch (status) {
    case 'PENDING':
      return {
        headline: `Waiting for ${storeName} to accept your order`,
        subline: rider.state === 'ASSIGNED' ? `${riderName} has already taken your delivery.` : 'This usually takes a few minutes.',
      };
    case 'CONFIRMED':
      return {
        headline: `${storeName} accepted your order`,
        subline: rider.state === 'ASSIGNED' && rider.etaMinutes !== null ? `${riderName} is about ${rider.etaMinutes} min from ${storeName}.` : 'They will start on it shortly.',
      };
    case 'PREPARING':
      return {
        headline: kind === 'gulplaza' ? 'Your food is being prepared' : 'Your order is being packed',
        subline:
          rider.state === 'ASSIGNED' && rider.target === 'STORE' && rider.etaMinutes !== null
            ? rider.arriving
              ? `${riderName} is at ${storeName}.`
              : `${riderName} is about ${rider.etaMinutes} min from ${storeName}.`
            : 'We will tell you as soon as it is on the way.',
      };
    case 'OUT_FOR_DELIVERY':
      if (rider.state === 'ASSIGNED' && rider.arriving) {
        return { headline: 'Your rider is arriving', subline: `${riderName} is right outside. Please be ready.` };
      }

      if (rider.state === 'ASSIGNED' && rider.etaMinutes !== null) {
        return { headline: `On the way · about ${rider.etaMinutes} min`, subline: `${riderName} is ${away} from you.` };
      }

      return {
        headline: 'Your order is on the way',
        subline: rider.state === 'ASSIGNED' ? `${riderName} is bringing it. Waiting for their live location.` : 'Your rider is bringing it.',
      };
    case 'DELIVERED':
      return { headline: 'Your order was delivered', subline: 'Thank you for ordering with Mangwaoo!' };
    default:
      return { headline: 'This order was cancelled', subline: 'You can place a new order any time.' };
  }
}

// ── What the API and the page exchange ──────────────────────

export type TrackItem = { id: string; name: string; quantity: number; price: number };

/** Everything the tracking page shows about one order, as GET /api/track/[ref] answers it. */
export type OrderTracking = {
  /** The order number, e.g. MW-F10001. */
  ref: string;
  marketplace: OrderKind;
  status: TrackStatus;
  /** Still going: the page keeps updating. */
  isLive: boolean;
  headline: string;
  subline: string;
  placedAt: string;
  store: { name: string; coords: Coordinates | null };
  dropOff: { text: string; coords: Coordinates | null };
  steps: TrackStep[];
  rider: TrackRider;
  items: TrackItem[];
  /** In PKR: the items, what the coupon / Loyalty Card took off, the delivery fee (food only) and what the customer pays. */
  money: { items: number; discount: number; delivery: number; total: number };
  payment: { method: string | null; status: string | null };
  /** When the server built this (ISO), for "updated N s ago". */
  serverTime: string;
};
