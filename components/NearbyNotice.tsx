'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LocateFixed, MapPin } from 'lucide-react';
import { useDeliveryAddress } from '@/lib/delivery-address-context';
import { FOOD_DELIVERY_RADIUS_KM } from '@/lib/delivery';
import { isRealLocation } from '@/lib/geo';

const SAME_SPOT_DEGREES = 0.00001;

/**
 * Food lists are built around the customer's location (the nearby ones within `FOOD_DELIVERY_RADIUS_KM`, or, for search,
 * all of them nearest first). The page itself is built on the server, which only knows the location when the address
 * carries it (`?lat=…&lng=…`), so this keeps the address in the URL in step with the delivery address chosen in the
 * navbar: when it loads or changes, the page is reloaded with it. What it shows:
 * - **banner** (default): no location yet → a card asking for the address, with a button that opens the navbar's
 *   window; a location → a small line saying what the list is around it;
 * - **quiet**: pages that show a single restaurant or dish need nothing while the location is known, and only a short
 *   hint while it isn't.
 */
export default function NearbyNotice({
  lat,
  lng,
  params = {},
  variant = 'banner',
  what = 'restaurants',
  includeFar = false,
}: {
  /** The coordinates the page was built with (from the URL), if any. */
  lat: number | null;
  lng: number | null;
  /** The page's other query values (search words, category), kept when the address is added. */
  params?: Record<string, string>;
  variant?: 'banner' | 'quiet';
  what?: 'restaurants' | 'dishes';
  /** The list also has restaurants farther than the nearby radius (search): they come last and are marked. */
  includeFar?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { address, requestAddressPicker } = useDeliveryAddress();
  const location = isRealLocation(address) ? address : null;
  const hasOrigin = lat !== null && lng !== null;

  useEffect(() => {
    if (!location) return;

    const alreadyThere = hasOrigin && Math.abs(lat - location.lat) < SAME_SPOT_DEGREES && Math.abs(lng - location.lng) < SAME_SPOT_DEGREES;

    if (alreadyThere) return;

    const search = new URLSearchParams({ ...params, lat: String(location.lat), lng: String(location.lng) });

    router.replace(`${pathname}?${search}`);
    // `params` is rebuilt on every render by the page, so it is compared by content below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, location?.lng, hasOrigin, lat, lng, pathname, JSON.stringify(params), router]);

  if (!location && !hasOrigin) {
    if (variant === 'quiet') {
      return (
        <p className="mb-6 flex items-start gap-2 rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-gray">
          <LocateFixed className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            Choose your delivery address to see how far this is and what the delivery costs.{' '}
            <button type="button" onClick={requestAddressPicker} className="font-semibold text-accent hover:underline">
              Select address
            </button>
          </span>
        </p>
      );
    }

    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-surface p-8 text-center">
        <LocateFixed className="mx-auto mb-3 h-8 w-8 text-accent" aria-hidden="true" />
        <p className="font-semibold text-ink">Where should we deliver?</p>
        <p className="mx-auto mt-1 mb-5 max-w-md text-sm text-brand-gray">
          {includeFar
            ? `We show ${what} nearest to you first, and mark the ones more than ${FOOD_DELIVERY_RADIUS_KM} km away. Choose your delivery address to see them.`
            : `We show ${what} within ${FOOD_DELIVERY_RADIUS_KM} km of you. Choose your delivery address to see them.`}
        </p>
        <button
          type="button"
          onClick={requestAddressPicker}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg"
        >
          Select delivery address
        </button>
      </div>
    );
  }

  if (variant === 'quiet') return null;

  const placeName = location ? `${location.savedAs ? `${location.savedAs} · ` : ''}${location.label}` : 'your location';

  return (
    <p className="mb-6 flex items-start gap-2 rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-gray">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <span className="min-w-0">
        {includeFar ? `Showing ${what} nearest to` : `Showing ${what} within ${FOOD_DELIVERY_RADIUS_KM} km of`}{' '}
        <span className="font-semibold text-ink break-words">{placeName}</span>
        {location ? (
          <>
            {' · '}
            <button type="button" onClick={requestAddressPicker} className="font-semibold text-accent hover:underline">
              Change
            </button>
          </>
        ) : null}
      </span>
    </p>
  );
}
