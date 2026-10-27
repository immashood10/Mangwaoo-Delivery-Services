'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  /** A food dish sold by weight: the size in grams (`price` is that size's price). Unset = a dish with one price. */
  portion?: number;
};

export type CartItem = CartProduct & { qty: number };

type CartContextValue = {
  items: CartItem[];
  /** True while a customer's saved cart is being loaded from the database. */
  isLoading: boolean;
  cartCount: number;
  subtotalLabel: string;
  subtotal: number;
  addItem: (product: CartProduct) => void;
  /** `portion` picks the size line of a dish sold by weight (250 g and 1 kg of one dish are two lines). */
  removeItem: (id: number | string, portion?: number) => void;
  updateQty: (id: number | string, qty: number, portion?: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const CART_SAVE_DEBOUNCE_MS = 800;

function parsePrice(price: string) {
  const numeric = price.replace(/[^0-9.]/g, '');
  return numeric ? parseFloat(numeric) : 0;
}

/** A cart line is a product, and for a dish sold by weight also its size. */
const itemKey = (item: Pick<CartItem, 'id' | 'marketplace' | 'portion'>) =>
  `${item.marketplace === 'gulplaza' ? 'gulplaza' : 'mart'}:${item.id}:${item.portion ?? 0}`;

const isLine = (item: CartItem, id: number | string, portion = 0) => item.id === id && (item.portion ?? 0) === portion;

/** What is saved for a cart: only products that exist in the database (demo products have no seller). */
function toSavedLines(items: CartItem[]) {
  return items
    .filter((item): item is CartItem & { sellerId: string } => Boolean(item.sellerId))
    .map((item) => ({
      productId: String(item.id),
      marketplace: item.marketplace === 'gulplaza' ? 'GULPLAZA' : 'MART',
      quantity: item.qty,
      ...(item.portion ? { portion: item.portion } : {}),
    }));
}

/**
 * The cart is kept in the database for the logged-in customer (nothing is stored in the browser):
 * it is loaded after login and saved a moment after every change. Others (guests, staff accounts)
 * only have a cart in memory for the page they are on.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const { user, isLoading: isAuthLoading } = useAuth();
  const customerId = user?.role === 'CUSTOMER' ? user.id : null;

  // Whose saved cart `items` currently shows, and whether it has been loaded (saving before that would overwrite it).
  const [shownFor, setShownFor] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastSavedRef = useRef('');
  const pendingSaveRef = useRef<string | null>(null);

  // Logging in or out swaps the cart: never show one person's cart to the next.
  if (!isAuthLoading && shownFor !== customerId) {
    setShownFor(customerId);
    setItems([]);
    setIsLoaded(false);
  }

  useEffect(() => {
    if (isAuthLoading || !customerId) return;

    let cancelled = false;

    fetch('/api/cart')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Could not load the cart'))))
      .then((data: { items?: CartItem[] }) => {
        if (cancelled) return;

        const saved = Array.isArray(data.items) ? data.items : [];
        lastSavedRef.current = JSON.stringify(toSavedLines(saved));

        // Anything added while this was loading stays (and is saved by the effect below).
        setItems((current) => {
          const merged = new Map(saved.map((item) => [itemKey(item), item]));
          for (const item of current) merged.set(itemKey(item), item);
          return [...merged.values()];
        });
        setIsLoaded(true);
      })
      .catch(() => {
        // The saved cart couldn't be loaded. Saving stays off so an empty cart can't overwrite it.
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, isAuthLoading]);

  // `lines` is the JSON of the cart's saved lines; it is what gets compared to know whether anything changed.
  const saveLines = (lines: string, keepalive = false) =>
    fetch('/api/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: `{"items":${lines}}`,
      keepalive,
    }).then((response) => {
      if (!response.ok) return;

      lastSavedRef.current = lines;
      // Saved: leaving the page must not save this same cart again (it could overwrite a newer one saved elsewhere).
      if (pendingSaveRef.current === lines) pendingSaveRef.current = null;
    });

  useEffect(() => {
    if (!isLoaded || !customerId) return;

    const lines = JSON.stringify(toSavedLines(items));

    if (lines === lastSavedRef.current) {
      pendingSaveRef.current = null;
      return;
    }

    pendingSaveRef.current = lines;

    const timeoutId = window.setTimeout(() => {
      saveLines(lines).catch(() => {
        // A missed save is retried with the next change; the cart on screen is still right.
      });
    }, CART_SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [items, isLoaded, customerId]);

  // Leaving the page within a moment of a change must not lose it.
  useEffect(() => {
    const flush = () => {
      if (pendingSaveRef.current) {
        const lines = pendingSaveRef.current;
        pendingSaveRef.current = null;
        saveLines(lines, true).catch(() => undefined);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const addItem = (product: CartProduct) => {
    setItems((current) => {
      const existing = current.find((item) => isLine(item, product.id, product.portion ?? 0));
      if (existing) {
        return current.map((item) =>
          isLine(item, product.id, product.portion ?? 0) ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...current, { ...product, qty: 1 }];
    });
  };

  const removeItem = (id: number | string, portion = 0) => {
    setItems((current) => current.filter((item) => !isLine(item, id, portion)));
  };

  const updateQty = (id: number | string, qty: number, portion = 0) => {
    if (qty <= 0) {
      removeItem(id, portion);
      return;
    }
    setItems((current) => current.map((item) => (isLine(item, id, portion) ? { ...item, qty } : item)));
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
    isLoading: isAuthLoading || (customerId !== null && !isLoaded),
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
