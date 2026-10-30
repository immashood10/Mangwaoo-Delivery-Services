'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDeliveryAddress } from '@/lib/delivery-address-context';

type Dish = { id: string; name: string; category: string; icon: string; vendor: string; price: number; portions: { grams: number; price: number }[] };
type Result = { products: Dish[]; hasOrderHistory: boolean };

export default function FoodRecommendations() {
  const { address } = useDeliveryAddress();
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const query = new URLSearchParams();
    if (address) { query.set('lat', String(address.lat)); query.set('lng', String(address.lng)); }
    let active = true;
    fetch(`/api/recommendations?${query}`, { cache: 'no-store' })
      .then(async (response) => response.ok ? await response.json() as Result : null)
      .then((data) => { if (active && data?.products?.length) setResult(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [address]);

  if (!result?.products.length) return null;
  return (
    <section aria-label="Recommended dishes" className="border-b border-gray-100 bg-surface py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-ink">{result.hasOrderHistory ? 'Picked for you' : 'Popular food picks'}</h2>
        <p className="mt-1 text-sm text-brand-gray">{result.hasOrderHistory ? 'Based on your delivered orders, meal time, and nearby kitchens.' : 'Popular available dishes near you. Recommendations improve as you order.'}</p>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {result.products.map((dish) => <Link key={dish.id} href={`/gulplaza/${dish.id}`} className="min-w-48 rounded-xl border border-gray-200 bg-surface p-3 hover:border-accent">
            <span className="text-xl" aria-hidden="true">{dish.icon}</span><p className="mt-1 font-semibold text-ink">{dish.name}</p><p className="text-xs text-brand-gray">{dish.vendor} · {dish.category}</p><p className="mt-1 text-sm font-semibold text-ink">{dish.portions.length ? `From PKR ${Math.min(...dish.portions.map((portion) => portion.price)).toLocaleString()}` : `PKR ${dish.price.toLocaleString()}`}</p>
          </Link>)}
        </div>
      </div>
    </section>
  );
}
