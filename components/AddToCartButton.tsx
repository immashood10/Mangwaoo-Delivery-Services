'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart, type CartProduct } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';

const ADDED_FEEDBACK_MS = 1800;

/**
 * The "Order" button on a product. A MangwaooMart product goes into the cart and the customer stays where they are
 * (the button says "Added ✓" for a moment, the cart count in the top bar goes up and the bar at the bottom offers
 * "Proceed to checkout"), so they can keep shopping. A Food dish still opens the cart straight away.
 */
export default function AddToCartButton({
  product,
  className,
}: {
  product: CartProduct;
  className?: string;
}) {
  const { addItem } = useCart();
  const { user, isLoading, openSignIn } = useAuth();
  const router = useRouter();
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!justAdded) return;

    const timer = window.setTimeout(() => setJustAdded(false), ADDED_FEEDBACK_MS);

    return () => window.clearTimeout(timer);
  }, [justAdded]);

  return (
    <button
      type="button"
      onClick={(event) => {
        // Cards this button sits inside are themselves links to the product
        // detail page — stop the click from also triggering that navigation.
        event.preventDefault();
        event.stopPropagation();
        if (isLoading) {
          return;
        }
        if (!user) {
          openSignIn();
          return;
        }
        addItem(product);

        if (product.marketplace === 'gulplaza') {
          router.push('/cart');
        } else {
          setJustAdded(true);
        }
      }}
      aria-live="polite"
      className={className}
    >
      {justAdded ? 'Added ✓' : 'Order'}
    </button>
  );
}
