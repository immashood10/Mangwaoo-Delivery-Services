import { distanceInKm, formatDistance, isRealLocation, type Coordinates } from '@/lib/geo';

// Food delivery is charged by distance: the kilometres from the restaurant to the customer's location, at a flat
// rate per kilometre. Only food has a delivery fee (MangwaooMart has none).

/**
 * What one kilometre of delivery costs, in PKR. Rs 80 since 2026-10-28 (the owner counts the rider's bike at 30 km to
 * the litre, not 40); it was Rs 70 from 2026-10-25, and before that Rs 10, the petrol alone. Orders already placed
 * keep the fee they were charged. Everything that shows or charges a delivery fee reads this one number.
 */
export const DELIVERY_RATE_PER_KM = 80;

/**
 * Distances are worked in tenths of a kilometre, the same precision the screens show, so the fee always matches
 * the "3.2 km" next to it.
 */
export function billedDistanceKm(distanceKm: number) {
  return Math.round(distanceKm * 10) / 10;
}

/** The delivery fee in whole PKR (rounded up) for a ride of `distanceKm` from the restaurant to the customer. */
export function deliveryFeeForDistance(distanceKm: number) {
  const tenthsOfKm = Math.round(distanceKm * 10);

  // The tiny allowance keeps floating point (e.g. 11.000000000000002) from rounding a whole rupee up.
  return Math.ceil((tenthsOfKm * DELIVERY_RATE_PER_KM) / 10 - 1e-9);
}

// ── Where a restaurant delivers ─────────────────────────────

/**
 * The "nearby" distance, in kilometres (in a straight line) from the customer's location: the delivery address they
 * picked, or the drop-off pinned in the cart. The home page and the Food page list only restaurants inside it. A
 * restaurant farther away can still be found (search, favourites) and ordered from, with a note that the delivery
 * charge is higher (`DELIVERY_RATE_PER_KM` a kilometre) and that ordering from a nearby restaurant is better.
 */
export const FOOD_DELIVERY_RADIUS_KM = 5;

/** Whether a distance is inside the radius, judged to 0.1 km like everything else the customer sees ("5.0 km away"). */
export function isWithinFoodRadius(distanceKm: number) {
  return billedDistanceKm(distanceKm) <= FOOD_DELIVERY_RADIUS_KM;
}

/** Whether a restaurant reaches a customer's location. */
export type FoodReach =
  /** The customer's location isn't known, so there is no way to tell. */
  | { status: 'NEEDS_ORIGIN' }
  /** The restaurant hasn't pinned its kitchen on the map, so its distance (and the delivery charge) can't be known. */
  | { status: 'NO_PIN' }
  /** Farther than the nearby radius: it can be ordered from, at the higher delivery charge for the longer ride. */
  | { status: 'FAR'; distanceKm: number }
  | { status: 'OK'; distanceKm: number };

export function foodReach(origin: Coordinates | null | undefined, kitchen: Coordinates | null | undefined): FoodReach {
  if (!isRealLocation(origin)) return { status: 'NEEDS_ORIGIN' };
  if (!kitchen) return { status: 'NO_PIN' };

  const distanceKm = distanceInKm(origin, kitchen);

  return isWithinFoodRadius(distanceKm) ? { status: 'OK', distanceKm } : { status: 'FAR', distanceKm };
}

/** What a customer is told about a restaurant beyond the nearby radius. */
export function farAwayNote(distanceKm: number, name = 'This restaurant') {
  return `${name} is ${formatDistance(distanceKm)} from your delivery address, more than ${FOOD_DELIVERY_RADIUS_KM} km away, so the delivery charge is higher. Ordering from a restaurant closer to you is better.`;
}
