'use client';

import Link from 'next/link';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart-context';

/**
 * Sticky bottom bar with the cart total and the checkout button; hidden while the cart is empty. With `spacer`, empty
 * room is left at the end of the page while the bar is showing, so it never covers the last thing on the page.
 */
export default function CartBar({ spacer = false }: { spacer?: boolean }) {
  const { cartCount, subtotalLabel } = useCart();

  if (cartCount === 0) return null;

  return (
    <>
      {spacer ? <div aria-hidden="true" className="h-24" /> : null}
      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
        <Link
          href="/cart"
          className="mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-2xl bg-brand-dark px-5 py-3.5 text-white shadow-2xl transition hover:bg-black"
        >
          <span className="flex items-center gap-3">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red-primary px-1 text-[11px] font-bold">
                {cartCount}
              </span>
            </span>
            <span className="text-sm">
              <span className="block font-semibold">{subtotalLabel}</span>
              <span className="block text-xs text-white/60">{cartCount === 1 ? '1 item' : `${cartCount} items`} in your cart</span>
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-sm font-bold">
            Proceed to checkout
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </>
  );
}
