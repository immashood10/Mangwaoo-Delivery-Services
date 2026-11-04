// Where Mangwaoo delivers: Karachi, for now. One place for the rule, used by the checkout and the order chat on the server and by
// the address and map screens in the browser (client-safe, no database).
//
// The area is a rectangle around the whole city (a little wider than the search box the address search uses, so the
// outskirts like Gadap, Malir and Port Qasim are inside). Anything outside it, for example Islamabad, cannot be ordered to:
// without this a faraway address was priced at Rs 80 per km (about Rs 91,000 to Islamabad) or, with a Rs 200 food
// subtotal, got free delivery over 1,100 km. To serve another city, widen or replace the box here.

import { isRealLocation, type Coordinates } from '@/lib/geo';

export const SERVICE_AREA_NAME = 'Karachi';

/** South, north, west and east edges in degrees. */
export const SERVICE_AREA_BOUNDS = { south: 24.7, north: 25.2, west: 66.65, east: 67.45 } as const;

export const SERVICE_AREA_MESSAGE = 'Mangwaoo delivers in Karachi only for now. Please choose a place in Karachi.';

/** Whether a point is inside the delivery area. A missing or empty (0, 0) position is not. */
export function isInServiceArea(point: Coordinates | null | undefined): boolean {
  if (!point || !isRealLocation(point)) return false;

  const { south, north, west, east } = SERVICE_AREA_BOUNDS;

  return point.lat >= south && point.lat <= north && point.lng >= west && point.lng <= east;
}
