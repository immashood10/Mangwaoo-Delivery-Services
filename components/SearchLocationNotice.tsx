'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LocateFixed, MapPin } from 'lucide-react';
import { useDeliveryAddress } from '@/lib/delivery-address-context';

const SAME_SPOT_DEGREES = 0.00001;

/**
 * Tells the customer what the list is sorted by, and keeps it in step with the delivery
 * address chosen in the navbar: when the address loads or changes, the page is reloaded
 * with it so the nearest restaurants come first.
 */
export default function SearchLocationNotice({
  query,
  lat,
  lng,
}: {
  query: string;
  /** The coordinates the list was sorted with (from the URL), if any. */
  lat: number | null;
  lng: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { address } = useDeliveryAddress();

  useEffect(() => {
    if (!address) return;

    const alreadySorted =
      lat !== null && lng !== null && Math.abs(lat - address.lat) < SAME_SPOT_DEGREES && Math.abs(lng - address.lng) < SAME_SPOT_DEGREES;

    if (!alreadySorted) {
      router.replace(`${pathname}?q=${encodeURIComponent(query)}&lat=${address.lat}&lng=${address.lng}`);
    }
  }, [address, lat, lng, pathname, query, router]);

  const hasOrigin = lat !== null && lng !== null;

  if (!hasOrigin && !address) {
    return (
      <p className="mb-6 flex items-start gap-2 rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-gray">
        <LocateFixed className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>
          Choose your delivery address in the top bar to see the restaurants nearest to you first.
        </span>
      </p>
    );
  }

  const placeName = address ? `${address.savedAs ? `${address.savedAs} · ` : ''}${address.label}` : 'your location';

  return (
    <p className="mb-6 flex items-start gap-2 rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-gray">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <span className="min-w-0">
        Nearest first, from <span className="font-semibold text-ink break-words">{placeName}</span>
      </span>
    </p>
  );
}
