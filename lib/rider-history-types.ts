// A rider's order history and the customer's rating of a ride. Client-safe: shared by the API routes and the screens.

export const RIDER_HISTORY_FILTERS = ['all', 'delivered', 'cancelled', 'pending'] as const;
export type RiderHistoryFilter = (typeof RIDER_HISTORY_FILTERS)[number];

export const RIDER_HISTORY_RANGES = ['today', '7d', '30d', 'all'] as const;
export type RiderHistoryRange = (typeof RIDER_HISTORY_RANGES)[number];

export const RIDER_HISTORY_RANGE_LABELS: Record<RiderHistoryRange, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

export const RIDER_HISTORY_PAGE_SIZE = 20;

/** How an order shows in the history: still going (pending), or how it ended. */
export type RiderHistoryKind = 'PENDING' | 'DELIVERED' | 'CANCELLED' | 'CLOSED';
export type RiderOrderCancelledBy = 'RIDER' | 'CUSTOMER' | 'ADMIN';

export type RiderHistoryItem = {
  /** The order chat's id for a pending order, the history line's id for a finished one. */
  id: string;
  kind: RiderHistoryKind;
  customerName: string;
  pickupText: string | null;
  addressText: string;
  /** Whole PKR; null when the order ended without one being worked out (cancelled, closed). */
  deliveryCharge: number | null;
  /** What Mangwaoo took from the delivery charge (delivered orders). */
  commission: number | null;
  cancelledBy: RiderOrderCancelledBy | null;
  takenAt: string;
  endedAt: string | null;
  /** The customer's rating of the ride (delivered orders), with what they wrote for the rider. */
  stars: number | null;
  ratingComment: string | null;
};

export type RiderHistorySummary = {
  delivered: number;
  cancelled: number;
  /** Closed by Mangwaoo without a delivery being confirmed. */
  closed: number;
  /** Taken and not finished yet (always the current number, whatever the date range). */
  pending: number;
  /** The delivery charges of the delivered orders, and the part of it Mangwaoo took. */
  deliveryCharges: number;
  commission: number;
};

export type RiderRatingSummary = { average: number; count: number };

export type RiderHistoryResponse = {
  summary: RiderHistorySummary;
  /** The rider's rating from customers over all time (null: nobody has rated yet). */
  rating: RiderRatingSummary | null;
  items: RiderHistoryItem[];
  /** Pass it back as `cursor` to get the next page; null when this was the last one. */
  nextCursor: string | null;
};

// ── Rating a ride ────────────────────────────────────────────────────────────

export const MAX_RATING_COMMENT_LENGTH = 500;
export const MAX_COMPLAINT_LENGTH = 1000;

export const RATING_LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'] as const;

/** "4.8", or "5.0": one decimal. */
export function formatRatingAverage(average: number) {
  return average.toFixed(1);
}
