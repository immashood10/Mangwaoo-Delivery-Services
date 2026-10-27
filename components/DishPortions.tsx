'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import AddToCartButton from '@/components/AddToCartButton';
import { formatPortion, type Portion } from '@/lib/food-portions';
import type { CartProduct } from '@/lib/cart-context';

// The dish page of a dish sold by weight (250 g, 500 g, 1 kg ...): the size buttons, the price of the picked size and the
// Order button sit in different places of a server-rendered page, so they share the picked size through this provider.
// (A dish with one price doesn't use any of this.)

type Selection = { portions: Portion[]; selected: Portion; select: (grams: number) => void };

const SelectionContext = createContext<Selection | null>(null);

export function DishPortionsProvider({ portions, children }: { portions: Portion[]; children: ReactNode }) {
  const [grams, setGrams] = useState(portions[0]?.grams ?? 0);
  const selected = portions.find((portion) => portion.grams === grams) ?? portions[0];

  return <SelectionContext.Provider value={{ portions, selected, select: setGrams }}>{children}</SelectionContext.Provider>;
}

function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) throw new Error('This must be used inside DishPortionsProvider');
  return context;
}

/** The big price on the dish page: the price of the picked size. */
export function DishPortionPrice({ className }: { className?: string }) {
  const { selected } = useSelection();

  return <p className={className}>PKR {selected.price.toLocaleString()}</p>;
}

/** The size buttons. */
export function DishPortionChips({ dishName }: { dishName: string }) {
  const { portions, selected, select } = useSelection();

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold text-ink">Choose a size</h2>
      <div role="radiogroup" aria-label={`Choose a size of ${dishName}`} className="flex flex-wrap gap-2">
        {portions.map((portion) => {
          const isSelected = portion.grams === selected.grams;

          return (
            <button
              key={portion.grams}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => select(portion.grams)}
              className={`rounded-xl border px-4 py-2 text-left text-sm transition ${
                isSelected ? 'border-accent bg-brand-red-primary text-white' : 'border-gray-300 text-ink hover:border-accent'
              }`}
            >
              <span className="block font-semibold">{formatPortion(portion.grams)}</span>
              <span className={`block text-xs ${isSelected ? 'text-white/90' : 'text-brand-gray'}`}>PKR {portion.price.toLocaleString()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The Order button: it puts the picked size (at its price) into the cart. */
export function DishPortionOrderButton({ product, className }: { product: CartProduct; className?: string }) {
  const { selected } = useSelection();

  return (
    <AddToCartButton
      product={{ ...product, price: `PKR ${selected.price.toLocaleString()}`, portion: selected.grams }}
      className={className}
    />
  );
}
