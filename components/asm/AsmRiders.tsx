'use client';

import { useEffect, useState } from 'react';
import { Bike } from 'lucide-react';
import { RiderRatingLabel } from '@/components/StarRating';
import type { AssignableRider } from '@/lib/area-managers-config';
import { formatDistance } from '@/lib/geo';

const POLL_MS = 10000;

/** Every approved rider with who is online, how far from the middle of the area, how many orders they have and whether they may get another. */
export default function AsmRiders() {
  const [riders, setRiders] = useState<AssignableRider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const response = await fetch('/api/asm/riders', { cache: 'no-store' });
        const data = await response.json().catch(() => null);

        if (!active) return;

        if (!response.ok) {
          setError(data?.error ?? 'Could not load the riders.');
          return;
        }

        setRiders(data.riders ?? []);
        setError('');
      } catch {
        // The next poll tries again.
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(load, POLL_MS);
    document.addEventListener('visibilitychange', load);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);

  const online = riders.filter((rider) => rider.online).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Riders</h1>
        <p className="mt-1 text-sm text-brand-gray">
          {isLoading ? 'Loading riders…' : `${online} of ${riders.length} approved ${riders.length === 1 ? 'rider is' : 'riders are'} online. Distance is from the middle of your area.`}
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!isLoading && riders.length === 0 ? (
        <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
          <Bike className="mx-auto mb-3 h-10 w-10 text-brand-gray" />
          <p className="font-semibold text-ink">No approved riders yet</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {riders.map((rider) => (
            <li key={rider.id} className="rounded-2xl bg-surface p-4 shadow-soft" data-rider-id={rider.id}>
              <p className="flex items-center gap-2 font-bold text-ink">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${rider.online ? 'bg-green-500' : 'bg-gray-300'}`} aria-hidden="true" />
                <span className="truncate">{rider.name}</span>
              </p>
              <p className="mt-1 text-xs text-brand-gray">
                {rider.online ? 'Online' : 'Offline'}
                {rider.vehicleType ? ` · ${rider.vehicleType}` : ''}
                {rider.distanceKm !== null ? ` · ${formatDistance(rider.distanceKm)} away` : ''}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-brand-gray">
                <span>{rider.activeOrders === 0 ? 'No order now' : `${rider.activeOrders} ${rider.activeOrders === 1 ? 'order' : 'orders'} now`}</span>
                <RiderRatingLabel rating={rider.rating} className="!font-normal" />
              </p>
              <p className={`mt-2 text-xs font-semibold ${rider.hold ? 'text-danger' : rider.online ? 'text-success' : 'text-brand-gray'}`}>
                {rider.hold
                  ? `${rider.reason}${rider.hold === 'PAYMENT' ? ` (${rider.unpaidOrders} unpaid ${rider.unpaidOrders === 1 ? 'order' : 'orders'})` : ''}`
                  : rider.online
                    ? 'Can take an order'
                    : 'Offline'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
