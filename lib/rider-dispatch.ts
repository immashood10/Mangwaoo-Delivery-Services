import { prisma } from '@/lib/prisma';
import { distanceInKm, type Coordinates } from '@/lib/geo';

// The rider dashboard pings its location every ~20s while online; a rider
// who hasn't pinged within this window is treated as offline.
export const RIDER_ONLINE_WINDOW_MS = 2 * 60 * 1000;
// New order chats go to every online rider within this radius…
export const DISPATCH_RADIUS_KM = 5;
// …or, if nobody is that close, to the few nearest online riders.
const FALLBACK_NEAREST_RIDERS = 3;
// OPEN chats older than this are no longer pushed to riders (admin still sees them).
export const OPEN_REQUEST_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export type OnlineRider = Coordinates & { id: string };

/**
 * Where a chat's rider should be nearest to: the pickup point (the rider
 * collects the order there first), or the drop-off for chats that predate pickup.
 */
export function chatDispatchPoint(chat: {
  latitude: number;
  longitude: number;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
}): Coordinates {
  return chat.pickupLatitude !== null && chat.pickupLongitude !== null
    ? { lat: chat.pickupLatitude, lng: chat.pickupLongitude }
    : { lat: chat.latitude, lng: chat.longitude };
}

export async function getOnlineRiders(): Promise<OnlineRider[]> {
  const riders = await prisma.rider.findMany({
    where: {
      isApproved: true,
      isAvailable: true,
      lastSeenAt: { gte: new Date(Date.now() - RIDER_ONLINE_WINDOW_MS) },
      lastLatitude: { not: null },
      lastLongitude: { not: null },
      user: { isActive: true },
      // Not eligible for the next order (unpaid commission, or blocked by an admin): see lib/rider-wallet-config.ts.
      orderAccess: { not: 'BLOCKED' },
      paymentHold: false,
    },
    select: { id: true, lastLatitude: true, lastLongitude: true },
  });

  return riders.map((rider) => ({
    id: rider.id,
    lat: rider.lastLatitude as number,
    lng: rider.lastLongitude as number,
  }));
}

/** Riders who should see (and may claim) an OPEN chat at `location`, nearest first. */
export function ridersForLocation(location: Coordinates, onlineRiders: OnlineRider[]) {
  const byDistance = onlineRiders
    .map((rider) => ({ ...rider, distanceKm: distanceInKm(location, rider) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const withinRadius = byDistance.filter((rider) => rider.distanceKm <= DISPATCH_RADIUS_KM);

  return withinRadius.length > 0 ? withinRadius : byDistance.slice(0, FALLBACK_NEAREST_RIDERS);
}

export async function isRiderEligibleForChat(riderId: string, location: Coordinates) {
  const onlineRiders = await getOnlineRiders();
  return ridersForLocation(location, onlineRiders).some((rider) => rider.id === riderId);
}
