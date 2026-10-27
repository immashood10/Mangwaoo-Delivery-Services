'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import FavouriteButton from '@/components/FavouriteButton';
import { formatPortion, withPortionLabel } from '@/lib/food-portions';
import type { FoodItem } from '@/lib/food-search';

/**
 * One menu row: photo, details and an Add / quantity stepper that updates the cart in place. A dish sold by weight shows
 * its sizes (250 g, 500 g, 1 kg ...) as buttons under the description; the price, the Add button and the stepper are for
 * the size that is picked, and each size is its own line in the cart.
 */
export default function RestaurantMenuItem({ item, highlight = false }: { item: FoodItem; highlight?: boolean }) {
  const { items, addItem, updateQty } = useCart();
  const { user, isLoading, openSignIn } = useAuth();
  const [picked, setPicked] = useState<number | null>(null);

  const inCart = items.filter((cartItem) => String(cartItem.id) === item.id);
  const qtyOf = (grams: number) => inCart.find((cartItem) => (cartItem.portion ?? 0) === grams)?.qty ?? 0;

  // The size on show: the one the customer tapped, else one that is already in their cart, else the smallest.
  const selected =
    item.portions.length > 0
      ? (item.portions.find((portion) => portion.grams === picked) ??
        item.portions.find((portion) => qtyOf(portion.grams) > 0) ??
        item.portions[0])
      : null;
  const grams = selected?.grams ?? 0;
  const qty = qtyOf(grams);
  const priceLabel = selected ? `PKR ${selected.price.toLocaleString()}` : item.price;
  const lineName = withPortionLabel(item.name, grams);
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
      price: priceLabel,
      icon: item.icon,
      vendor: item.vendor,
      sellerId: item.sellerId,
      marketplace: 'gulplaza',
      ...(grams > 0 ? { portion: grams } : {}),
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

        {selected ? (
          <div role="radiogroup" aria-label={`Choose a size of ${item.name}`} className="mt-2 flex flex-wrap gap-1.5">
            {item.portions.map((portion) => {
              const isSelected = portion.grams === selected.grams;
              const inCartCount = qtyOf(portion.grams);

              return (
                <button
                  key={portion.grams}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setPicked(portion.grams)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                    isSelected
                      ? 'border-accent bg-brand-red-primary text-white'
                      : 'border-gray-300 text-ink hover:border-accent hover:text-accent'
                  }`}
                >
                  {formatPortion(portion.grams)}
                  {inCartCount > 0 ? (
                    <span
                      className={`rounded-full px-1.5 text-[10px] leading-4 ${isSelected ? 'bg-white text-accent' : 'bg-brand-red-primary text-white'}`}
                      aria-label={`${inCartCount} in your cart`}
                    >
                      {inCartCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <span className="font-bold text-accent">{priceLabel}</span>

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
                onClick={() => updateQty(item.id, qty - 1, grams)}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/20"
                aria-label={`Remove one ${lineName}`}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-6 text-center text-sm font-bold" aria-live="polite">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => updateQty(item.id, qty + 1, grams)}
                disabled={atLimit}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/20 disabled:opacity-40"
                aria-label={`Add one more ${lineName}`}
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
