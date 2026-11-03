import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { areaName } from '@/lib/area-managers-config';
import { RIDER_ONLINE_WINDOW_MS } from '@/lib/rider-dispatch';
import { getRiderRatings } from '@/lib/rider-orders';
import { riderHold } from '@/lib/rider-wallet-config';
import {
  MONTHLY_RIDER_DAYS,
  RUNNING_STATUSES,
  daysLeft,
  monthlyRiderRef,
  type MonthlyRiderRequest,
  type MonthlyRiderStatusKey,
} from '@/lib/monthly-rider-config';

// Monthly rider (rules and wording in lib/monthly-rider-config.ts). A booking goes REQUESTED -> QUOTED (price and rider set by
// an admin or the area's manager) -> PAYMENT_SENT (the customer entered the transaction id) -> ACTIVE (an admin confirmed it;
// 30 days) -> ENDED. Every step is a guarded `updateMany` on the status it expects, so two clicks at once change the booking once.
// A partial unique index lets a customer have only one running booking.

type Db = Prisma.TransactionClient | typeof prisma;

const DAY_MS = 24 * 60 * 60 * 1000;
const KARACHI_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;
const FINISHED_LIST_LIMIT = 60;
const RUNNING_LIST_LIMIT = 200;

export type MonthlyRiderBookingView = {
  id: string;
  ref: string;
  status: MonthlyRiderStatusKey;
  areaId: number;
  areaName: string;
  addressText: string;
  /** YYYY-MM-DD, the day the customer asked to start. */
  preferredStart: string | null;
  notes: string | null;
  priceRs: number | null;
  riderId: string | null;
  riderName: string | null;
  /** The rider's average stars (one decimal) and how many ratings, null = a new rider. */
  riderRating: { average: number; count: number } | null;
  paymentMethod: string | null;
  transactionId: string | null;
  paymentSentAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** ACTIVE only: whole days left in the month. */
  daysLeft: number | null;
  /** The reason an admin gave for turning the request down or ending the month. */
  note: string | null;
  createdAt: string;
  customerName: string;
};

const BOOKING_SELECT = {
  id: true,
  refNumber: true,
  status: true,
  areaId: true,
  addressText: true,
  preferredStart: true,
  notes: true,
  priceRs: true,
  riderId: true,
  rider: { select: { user: { select: { name: true } } } },
  paymentMethod: true,
  transactionId: true,
  paymentSentAt: true,
  startsAt: true,
  endsAt: true,
  note: true,
  createdAt: true,
  customer: { select: { user: { select: { name: true } } } },
} satisfies Prisma.MonthlyRiderBookingSelect;

type BookingRow = Prisma.MonthlyRiderBookingGetPayload<{ select: typeof BOOKING_SELECT }>;

function toView(row: BookingRow, ratings: Map<string, { average: number; count: number }>): MonthlyRiderBookingView {
  return {
    id: row.id,
    ref: monthlyRiderRef(row.refNumber),
    status: row.status,
    areaId: row.areaId,
    areaName: areaName(row.areaId) ?? 'Unknown area',
    addressText: row.addressText,
    preferredStart: row.preferredStart ? row.preferredStart.toISOString().slice(0, 10) : null,
    notes: row.notes,
    priceRs: row.priceRs,
    riderId: row.riderId,
    riderName: row.rider?.user.name ?? null,
    riderRating: row.riderId ? (ratings.get(row.riderId) ?? null) : null,
    paymentMethod: row.paymentMethod,
    transactionId: row.transactionId,
    paymentSentAt: row.paymentSentAt?.toISOString() ?? null,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    daysLeft: row.status === 'ACTIVE' && row.endsAt ? daysLeft(row.endsAt) : null,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    customerName: row.customer.user.name,
  };
}

async function toViews(rows: BookingRow[]) {
  const riderIds = [...new Set(rows.flatMap((row) => (row.riderId ? [row.riderId] : [])))];
  const ratings = riderIds.length > 0 ? await getRiderRatings(riderIds) : new Map();

  return rows.map((row) => toView(row, ratings));
}

/** Bookings whose month is over become ENDED (so the customer can ask again). Safe to call as often as you like. */
export async function endFinishedBookings(client: Db = prisma) {
  await client.monthlyRiderBooking.updateMany({
    where: { status: 'ACTIVE', endsAt: { lte: new Date() } },
    data: { status: 'ENDED' },
  });
}

// ── The customer ────────────────────────────────────────────

export type CustomerPageData = {
  current: MonthlyRiderBookingView | null;
  history: MonthlyRiderBookingView[];
};

export async function getCustomerMonthlyRiderPage(customerId: string): Promise<CustomerPageData> {
  await endFinishedBookings();

  const rows = await prisma.monthlyRiderBooking.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: BOOKING_SELECT,
  });
  const views = await toViews(rows);
  const current = views.find((view) => RUNNING_STATUSES.includes(view.status)) ?? null;

  return { current, history: views.filter((view) => view !== current) };
}

export type WriteResult<T = object> = ({ ok: true } & T) | { ok: false; status: number; error: string };

export async function createMonthlyRequest(
  customerId: string,
  request: MonthlyRiderRequest
): Promise<WriteResult<{ id: string; ref: string; customerName: string; areaName: string }>> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { user: { select: { name: true, deletedAt: true } } } });

  if (!customer || customer.user.deletedAt) return { ok: false, status: 404, error: 'Customer account not found.' };

  await endFinishedBookings();

  try {
    const created = await prisma.monthlyRiderBooking.create({
      data: {
        customerId,
        areaId: request.areaId,
        addressText: request.addressText,
        preferredStart: request.preferredStart ? new Date(`${request.preferredStart}T00:00:00Z`) : null,
        notes: request.notes,
      },
      select: { id: true, refNumber: true },
    });

    return {
      ok: true,
      id: created.id,
      ref: monthlyRiderRef(created.refNumber),
      customerName: customer.user.name,
      areaName: areaName(request.areaId) ?? 'your area',
    };
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      return { ok: false, status: 409, error: 'You already have a monthly rider request. Cancel it first or wait for it to finish.' };
    }

    throw error;
  }
}

export async function cancelMonthlyRequest(customerId: string, id: string): Promise<WriteResult<{ ref: string; areaId: number; customerName: string }>> {
  const claimed = await prisma.monthlyRiderBooking.updateMany({
    where: { id, customerId, status: { in: ['REQUESTED', 'QUOTED'] } },
    data: { status: 'CANCELLED' },
  });
  const row = await prisma.monthlyRiderBooking.findFirst({
    where: { id, customerId },
    select: { refNumber: true, status: true, areaId: true, customer: { select: { user: { select: { name: true } } } } },
  });

  if (!row) return { ok: false, status: 404, error: 'Booking not found.' };

  if (claimed.count === 0) {
    const error =
      row.status === 'PAYMENT_SENT'
        ? 'Your payment is being checked, so this can no longer be cancelled here. Please contact Mangwaoo Support.'
        : row.status === 'ACTIVE'
          ? 'Your monthly rider is already active. Please contact Mangwaoo Support to end it.'
          : 'This request is already finished.';

    return { ok: false, status: 409, error };
  }

  return { ok: true, ref: monthlyRiderRef(row.refNumber), areaId: row.areaId, customerName: row.customer.user.name };
}

export async function submitMonthlyPayment(
  customerId: string,
  id: string,
  payment: { method: string; transactionId: string }
): Promise<WriteResult<{ ref: string; priceRs: number; customerName: string }>> {
  const reused = await prisma.monthlyRiderBooking.findFirst({
    where: { transactionId: payment.transactionId, id: { not: id }, status: { in: ['PAYMENT_SENT', 'ACTIVE', 'ENDED'] } },
    select: { id: true },
  });

  if (reused) return { ok: false, status: 409, error: 'That transaction ID has already been used for another booking.' };

  const claimed = await prisma.monthlyRiderBooking.updateMany({
    where: { id, customerId, status: 'QUOTED', riderId: { not: null } },
    data: { status: 'PAYMENT_SENT', paymentMethod: payment.method, transactionId: payment.transactionId, paymentSentAt: new Date() },
  });
  const row = await prisma.monthlyRiderBooking.findFirst({
    where: { id, customerId },
    select: { refNumber: true, priceRs: true, status: true, customer: { select: { user: { select: { name: true } } } } },
  });

  if (!row) return { ok: false, status: 404, error: 'Booking not found.' };

  if (claimed.count === 0 || row.priceRs === null) {
    const error =
      row.status === 'PAYMENT_SENT'
        ? 'You already sent your payment. We are checking it.'
        : row.status === 'REQUESTED' || row.status === 'QUOTED'
          ? 'The price and rider are not ready yet. We will tell you when they are.'
          : 'This request can no longer take a payment.';

    return { ok: false, status: 409, error };
  }

  return { ok: true, ref: monthlyRiderRef(row.refNumber), priceRs: row.priceRs, customerName: row.customer.user.name };
}

// ── Admin and area manager ──────────────────────────────────

export type MonthlyRiderAdminData = {
  counts: { requested: number; payments: number; active: number };
  running: MonthlyRiderBookingView[];
  finished: MonthlyRiderBookingView[];
};

/** The bookings an admin (no `areaId`) or an area's manager (`areaId`) deals with: the running ones first, then recent finished ones. */
export async function getMonthlyRiderAdminPage(areaId?: number): Promise<MonthlyRiderAdminData> {
  await endFinishedBookings();

  const areaFilter = areaId === undefined ? {} : { areaId };
  const [running, finished] = await Promise.all([
    prisma.monthlyRiderBooking.findMany({
      where: { ...areaFilter, status: { in: RUNNING_STATUSES } },
      orderBy: { createdAt: 'asc' },
      take: RUNNING_LIST_LIMIT,
      select: BOOKING_SELECT,
    }),
    prisma.monthlyRiderBooking.findMany({
      where: { ...areaFilter, status: { in: ['ENDED', 'REJECTED', 'CANCELLED'] } },
      orderBy: { updatedAt: 'desc' },
      take: FINISHED_LIST_LIMIT,
      select: BOOKING_SELECT,
    }),
  ]);
  const [runningViews, finishedViews] = await Promise.all([toViews(running), toViews(finished)]);

  // Waiting for action first (a price to set, a payment to check), then active ones, each oldest first.
  const order: Record<string, number> = { REQUESTED: 0, PAYMENT_SENT: 1, QUOTED: 2, ACTIVE: 3 };

  runningViews.sort((a, b) => order[a.status] - order[b.status]);

  return {
    counts: {
      requested: runningViews.filter((view) => view.status === 'REQUESTED').length,
      payments: runningViews.filter((view) => view.status === 'PAYMENT_SENT').length,
      active: runningViews.filter((view) => view.status === 'ACTIVE').length,
    },
    running: runningViews,
    finished: finishedViews,
  };
}

type Who = { userId: string; areaId?: number };

/** The booking limited to the actor's area when the actor is an area manager. */
function scope(id: string, who: Who) {
  return { id, ...(who.areaId !== undefined ? { areaId: who.areaId } : {}) };
}

async function checkRider(riderId: string): Promise<{ error: string } | { error?: undefined; rider: { userId: string; name: string } }> {
  const rider = await prisma.rider.findUnique({
    where: { id: riderId },
    select: { userId: true, isApproved: true, orderAccess: true, paymentHold: true, user: { select: { name: true, isActive: true, deletedAt: true } } },
  });

  if (!rider || !rider.isApproved || rider.user.deletedAt || !rider.user.isActive) {
    return { error: 'That rider cannot be given a monthly customer.' };
  }

  if (riderHold(rider) === 'ADMIN') return { error: `Mangwaoo has put ${rider.user.name} on hold, so they cannot get a monthly customer.` };

  return { rider: { userId: rider.userId, name: rider.user.name } };
}

export type QuoteResult = WriteResult<{
  customerUserId: string;
  customerName: string;
  riderUserId: string;
  riderName: string;
  ref: string;
  priceRs: number;
}>;

/** Sets the price for the month and the rider: a request (or an already priced one that has not been paid yet) becomes QUOTED. */
export async function quoteMonthlyBooking(id: string, who: Who, quote: { priceRs: number; riderId: string }): Promise<QuoteResult> {
  const checked = await checkRider(quote.riderId);

  if (checked.error !== undefined) return { ok: false, status: 409, error: checked.error };

  const claimed = await prisma.monthlyRiderBooking.updateMany({
    where: { ...scope(id, who), status: { in: ['REQUESTED', 'QUOTED'] } },
    data: { status: 'QUOTED', priceRs: quote.priceRs, riderId: quote.riderId, quotedById: who.userId, quotedAt: new Date() },
  });
  const row = await prisma.monthlyRiderBooking.findFirst({
    where: scope(id, who),
    select: { refNumber: true, status: true, customer: { select: { userId: true, user: { select: { name: true } } } } },
  });

  if (!row) return { ok: false, status: 404, error: 'Booking not found.' };

  if (claimed.count === 0) {
    return { ok: false, status: 409, error: 'This booking has already moved on, so its price can no longer be changed.' };
  }

  return {
    ok: true,
    customerUserId: row.customer.userId,
    customerName: row.customer.user.name,
    riderUserId: checked.rider.userId,
    riderName: checked.rider.name,
    ref: monthlyRiderRef(row.refNumber),
    priceRs: quote.priceRs,
  };
}

export type ConfirmResult = WriteResult<{
  customerUserId: string;
  riderUserId: string | null;
  riderName: string | null;
  ref: string;
  endsAt: Date;
}>;

/** An admin saw the payment: the month starts (on the customer's chosen day if that is still ahead) and runs 30 days. */
export async function confirmMonthlyPayment(id: string, adminId: string): Promise<ConfirmResult> {
  const row = await prisma.monthlyRiderBooking.findUnique({
    where: { id },
    select: { status: true, riderId: true, preferredStart: true },
  });

  if (!row) return { ok: false, status: 404, error: 'Booking not found.' };
  if (row.status !== 'PAYMENT_SENT') return { ok: false, status: 409, error: 'This booking is not waiting for a payment check.' };
  if (!row.riderId) return { ok: false, status: 409, error: 'The rider of this booking was removed. Choose a rider again first.' };

  const now = Date.now();
  // preferredStart is a calendar day stored at 00:00 UTC; the day begins at 00:00 Karachi time.
  const wanted = row.preferredStart ? row.preferredStart.getTime() - KARACHI_UTC_OFFSET_MS : 0;
  const startsAt = new Date(Math.max(now, wanted));
  const endsAt = new Date(startsAt.getTime() + MONTHLY_RIDER_DAYS * DAY_MS);

  const claimed = await prisma.monthlyRiderBooking.updateMany({
    where: { id, status: 'PAYMENT_SENT', riderId: { not: null } },
    data: { status: 'ACTIVE', startsAt, endsAt, reviewedById: adminId, reviewedAt: new Date(), note: null },
  });

  if (claimed.count === 0) return { ok: false, status: 409, error: 'Someone else already dealt with this booking.' };

  const done = await prisma.monthlyRiderBooking.findUnique({
    where: { id },
    select: {
      refNumber: true,
      customer: { select: { userId: true } },
      rider: { select: { user: { select: { id: true, name: true } } } },
    },
  });

  return {
    ok: true,
    customerUserId: done?.customer.userId ?? '',
    riderUserId: done?.rider?.user.id ?? null,
    riderName: done?.rider?.user.name ?? null,
    ref: monthlyRiderRef(done?.refNumber ?? 0),
    endsAt,
  };
}

export type CloseResult = WriteResult<{ customerUserId: string; riderUserId: string | null; ref: string }>;

/** An admin turns a request down (any step before it is active) or ends an active month early. */
export async function closeMonthlyBooking(id: string, adminId: string, kind: 'reject' | 'end', reason: string): Promise<CloseResult> {
  const from: MonthlyRiderStatusKey[] = kind === 'reject' ? ['REQUESTED', 'QUOTED', 'PAYMENT_SENT'] : ['ACTIVE'];
  const claimed = await prisma.monthlyRiderBooking.updateMany({
    where: { id, status: { in: from } },
    data: {
      status: kind === 'reject' ? 'REJECTED' : 'ENDED',
      note: reason || null,
      reviewedById: adminId,
      reviewedAt: new Date(),
      ...(kind === 'end' ? { endsAt: new Date() } : {}),
    },
  });
  const row = await prisma.monthlyRiderBooking.findUnique({
    where: { id },
    select: { refNumber: true, customer: { select: { userId: true } }, rider: { select: { userId: true } } },
  });

  if (!row) return { ok: false, status: 404, error: 'Booking not found.' };

  if (claimed.count === 0) {
    return { ok: false, status: 409, error: kind === 'reject' ? 'This booking is already finished or active.' : 'Only an active booking can be ended.' };
  }

  return { ok: true, customerUserId: row.customer.userId, riderUserId: row.rider?.userId ?? null, ref: monthlyRiderRef(row.refNumber) };
}

export type ChangeRiderResult = WriteResult<{
  customerUserId: string;
  previousRiderUserId: string | null;
  riderUserId: string;
  riderName: string;
  ref: string;
}>;

/** Gives a running month to another rider (an admin, or the area's manager). */
export async function changeMonthlyRider(id: string, who: Who, riderId: string): Promise<ChangeRiderResult> {
  const checked = await checkRider(riderId);

  if (checked.error !== undefined) return { ok: false, status: 409, error: checked.error };

  const before = await prisma.monthlyRiderBooking.findFirst({
    where: scope(id, who),
    select: { riderId: true, rider: { select: { userId: true } } },
  });

  if (!before) return { ok: false, status: 404, error: 'Booking not found.' };
  if (before.riderId === riderId) return { ok: false, status: 409, error: 'That rider already has this customer.' };

  const claimed = await prisma.monthlyRiderBooking.updateMany({
    where: { ...scope(id, who), status: { in: ['QUOTED', 'PAYMENT_SENT', 'ACTIVE'] } },
    data: { riderId },
  });

  if (claimed.count === 0) return { ok: false, status: 409, error: 'The rider of this booking can no longer be changed.' };

  const row = await prisma.monthlyRiderBooking.findUnique({
    where: { id },
    select: { refNumber: true, status: true, customer: { select: { userId: true } } },
  });

  return {
    ok: true,
    customerUserId: row?.customer.userId ?? '',
    previousRiderUserId: before.rider?.userId ?? null,
    riderUserId: checked.rider.userId,
    riderName: checked.rider.name,
    ref: monthlyRiderRef(row?.refNumber ?? 0),
  };
}

// ── Orders go to the dedicated rider ────────────────────────

/**
 * The rider who is this customer's monthly rider right now AND can take an order this minute (approved, online, not held for
 * unpaid commission or blocked), else null: the order then goes the usual way (area manager or first rider to reply).
 */
export async function dedicatedRiderFor(customerId: string): Promise<{ bookingId: string; riderId: string; riderUserId: string } | null> {
  const now = new Date();
  const booking = await prisma.monthlyRiderBooking.findFirst({
    where: { customerId, status: 'ACTIVE', riderId: { not: null }, startsAt: { lte: now }, endsAt: { gt: now } },
    select: {
      id: true,
      riderId: true,
      rider: {
        select: {
          userId: true,
          isApproved: true,
          isAvailable: true,
          lastSeenAt: true,
          orderAccess: true,
          paymentHold: true,
          user: { select: { isActive: true, deletedAt: true } },
        },
      },
    },
  });

  const rider = booking?.rider;

  if (!booking || !booking.riderId || !rider) return null;
  if (!rider.isApproved || rider.user.deletedAt || !rider.user.isActive) return null;
  if (riderHold(rider) !== null) return null;

  const online = rider.isAvailable && rider.lastSeenAt !== null && rider.lastSeenAt.getTime() >= Date.now() - RIDER_ONLINE_WINDOW_MS;

  if (!online) return null;

  return { bookingId: booking.id, riderId: booking.riderId, riderUserId: rider.userId };
}

/** Called when an account is removed: the customer's running booking ends; a removed rider's customers wait for a new rider. */
export async function closeMonthlyBookingsForAccount(tx: Prisma.TransactionClient, who: { customerId?: string; riderId?: string }) {
  if (who.customerId) {
    await tx.monthlyRiderBooking.updateMany({
      where: { customerId: who.customerId, status: { in: ['REQUESTED', 'QUOTED', 'PAYMENT_SENT'] } },
      data: { status: 'CANCELLED', note: 'The account was removed.' },
    });
    await tx.monthlyRiderBooking.updateMany({
      where: { customerId: who.customerId, status: 'ACTIVE' },
      data: { status: 'ENDED', endsAt: new Date(), note: 'The account was removed.' },
    });
  }

  if (who.riderId) {
    // The booking stays; an admin or the area manager picks another rider (orders go the usual way until then).
    await tx.monthlyRiderBooking.updateMany({
      where: { riderId: who.riderId, status: { in: ['QUOTED', 'PAYMENT_SENT', 'ACTIVE'] } },
      data: { riderId: null },
    });
  }
}
