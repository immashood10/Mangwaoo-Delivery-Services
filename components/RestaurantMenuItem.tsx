'use client';

import { Minus, Plus } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import FavouriteButton from '@/components/FavouriteButton';
import type { FoodItem } from '@/lib/food-search';

/** One menu row: photo, details and an Add / quantity stepper that updates the cart in place. */
export default function RestaurantMenuItem({ item, highlight = false }: { item: FoodItem; highlight?: boolean }) {
  const { items, addItem, updateQty } = useCart();
  const { user, isLoading, openSignIn } = useAuth();

  const qty = items.find((cartItem) => String(cartItem.id) === item.id)?.qty ?? 0;
  const soldOut = item.stock <= 0;
  const atLimit = qty >= item.stock;

  const handleAdd = () => {
    if (isLoading) return;
    if (!user) {
      openSignIn();
      return;
    }
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      icon: item.icon,
      vendor: item.vendor,
      sellerId: item.sellerId,
      marketplace: 'gulplaza',
    });
  };

  return (
    <div
      className={`flex gap-4 rounded-2xl bg-surface p-3 shadow-soft transition ${
        highlight ? 'ring-2 ring-accent/40' : ''
      } ${soldOut ? 'opacity-60' : ''}`}
    >
      <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-brand-light">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- seller-supplied image URL
            <img src={item.imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="text-4xl">{item.icon}</span>
          )}
        </div>
        <FavouriteButton kind="DISH" id={item.id} name={item.name} className="absolute right-1 top-1 scale-90" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-semibold text-ink">{item.name}</h3>
        {item.description ? <p className="mt-0.5 line-clamp-2 text-xs text-brand-gray">{item.description}</p> : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <span className="font-bold text-accent">{item.price}</span>

          {soldOut ? (
            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-brand-gray">Sold out</span>
          ) : qty === 0 ? (
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-1 rounded-full bg-brand-red-primary px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-red-secondary"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          ) : (
            <div className="inline-flex items-center gap-1 rounded-full bg-brand-red-primary p-1 text-white">
              <button
                type="button"
                onClick={() => updateQty(item.id, qty - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/20"
                aria-label={`Remove one ${item.name}`}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-6 text-center text-sm font-bold" aria-live="polite">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => updateQty(item.id, qty + 1)}
                disabled={atLimit}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/20 disabled:opacity-40"
                aria-label={`Add one more ${item.name}`}
                title={atLimit ? `Only ${item.stock} available` : undefined}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
