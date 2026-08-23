'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './auth-context';

export type CartProduct = {
  id: number | string;
  name: string;
  price: string;
  icon: string;
  vendor: string;
  /** Real DB seller id — present only for products backed by an actual Seller account. */
  sellerId?: string;
  /** Which catalog/order flow this item belongs to. Defaults to 'mart' when unset. */
  marketplace?: 'mart' | 'gulplaza';
};

export type CartItem = CartProduct & { qty: number };

type CartContextValue = {
  items: CartItem[];
  cartCount: number;
  subtotalLabel: string;
  subtotal: number;
  addItem: (product: CartProduct) => void;
  removeItem: (id: number | string) => void;
  updateQty: (id: number | string, qty: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const CART_STORAGE_KEY = 'mangwaoo_cart';
const CART_SYNC_DEBOUNCE_MS = 800;

function parsePrice(price: string) {
  const numeric = price.replace(/[^0-9.]/g, '');
  return numeric ? parseFloat(numeric) : 0;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const { user, isLoading: isAuthLoading } = useAuth();

  // The cart itself lives only in memory (no server-side cart of record), so
  // it has to be mirrored to localStorage or it'd vanish on every refresh —
  // which would also make the DB "pending in cart" sync below meaningless,
  // since a page reload would look identical to the customer clearing it.
  useEffect(() => {
    (async () => {
      try {
        const stored = window.localStorage.getItem(CART_STORAGE_KEY);
        if (stored) setItems(JSON.parse(stored));
      } catch {
        // Corrupt or inaccessible storage — just start with an empty cart.
      } finally {
        setIsHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full or unavailable (e.g. private browsing) — non-fatal.
    }
  }, [items, isHydrated]);

  // Mirrors real, seller-backed cart contents to the DB so sellers can see
  // "pending — still in cart" demand before (or instead of) a real order.
  // Gated on isHydrated so we never sync a still-loading empty cart over a
  // real one that's about to be read from localStorage.
  useEffect(() => {
    if (!isHydrated || isAuthLoading || !user || user.role !== 'CUSTOMER') return;

    const timeoutId = window.setTimeout(() => {
      const syncableItems = items
        .filter((item): item is CartItem & { sellerId: string } => Boolean(item.sellerId))
        .map((item) => ({
          productId: String(item.id),
          sellerId: item.sellerId,
          marketplace: item.marketplace === 'gulplaza' ? 'GULPLAZA' : 'MART',
          name: item.name,
          price: parsePrice(item.price),
          quantity: item.qty,
        }));

      fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: syncableItems }),
      }).catch(() => {
        // A missed sync just means sellers see slightly stale "pending" data
        // — not worth surfacing to the customer.
      });
    }, CART_SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [items, isHydrated, user, isAuthLoading]);

  const addItem = (product: CartProduct) => {
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...current, { ...product, qty: 1 }];
    });
  };

  const removeItem = (id: number | string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const updateQty = (id: number | string, qty: number) => {
    if (qty <= 0) {
      removeItem(id);
      return;
    }
    setItems((current) => current.map((item) => (item.id === id ? { ...item, qty } : item)));
  };

  const clearCart = () => setItems([]);

  const cartCount = useMemo(() => items.reduce((sum, item) => sum + item.qty, 0), [items]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + parsePrice(item.price) * item.qty, 0),
    [items]
  );

  const subtotalLabel = useMemo(() => `PKR ${subtotal.toLocaleString()}`, [subtotal]);

  const value: CartContextValue = {
    items,
    cartCount,
    subtotalLabel,
    subtotal,
    addItem,
    removeItem,
    updateQty,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
