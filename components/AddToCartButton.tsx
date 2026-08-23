'use client';

import { useRouter } from 'next/navigation';
import { useCart, type CartProduct } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';

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
        router.push('/cart');
      }}
      className={className}
    >
      Order
    </button>
  );
}
