// Food delivery is charged by what the rider's motorbike burns: the distance from the restaurant to the
// customer's location, at the petrol the bike uses. Only food has a delivery fee (MangwaooMart has none).

/** How far an average motorbike goes on one litre of petrol. */
export const MOTORBIKE_KM_PER_LITRE = 40;

/** Price of one litre of petrol, in PKR. */
export const PETROL_PRICE_PER_LITRE = 400;

/** What one kilometre costs in petrol: Rs 400 / 40 km = Rs 10. */
export const DELIVERY_RATE_PER_KM = PETROL_PRICE_PER_LITRE / MOTORBIKE_KM_PER_LITRE;

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
