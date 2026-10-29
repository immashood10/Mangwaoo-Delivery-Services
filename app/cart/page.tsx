'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2, ShoppingCart, MessageCircle, Banknote, Smartphone, BadgePercent, X, Gift, CreditCard } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { useDeliveryAddress } from '@/lib/delivery-address-context';
import { DELIVERY_RATE_PER_KM, FOOD_DELIVERY_RADIUS_KM, MINIMUM_DELIVERY_FEE, farAwayNote } from '@/lib/delivery';
import { formatPortion, withPortionLabel } from '@/lib/food-portions';
import type { Quote } from '@/lib/checkout-types';
import LocationPicker, { type PickedLocation } from '@/components/LocationPicker';

const MAX_NOTE_LENGTH = 500;
const QUOTE_DELAY_MS = 350;

const pkr = (amount: number) => `PKR ${amount.toLocaleString()}`;

/** What the server answered for one set of cart lines + drop-off + coupon (the key says which). */
type QuoteResult = { key: string; quote: Quote; couponError: string | null };

export default function CartPage() {
  const router = useRouter();
  const { items, isLoading, subtotal, updateQty, removeItem, clearCart } = useCart();
  const { address: navbarAddress } = useDeliveryAddress();

  // Drop-off follows the address picked in the navbar until the customer changes it here
  // (`null` = cleared on purpose, so they can pick a different spot).
  const [dropoffOverride, setDropoffOverride] = useState<PickedLocation | null | undefined>(undefined);
  const dropoff: PickedLocation | null =
    dropoffOverride !== undefined
      ? dropoffOverride
      : navbarAddress
        ? { label: navbarAddress.label, lat: navbarAddress.lat, lng: navbarAddress.lng }
        : null;

  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'easypaisa_jazzcash'>('cod');
  const [details, setDetails] = useState({
    fullName: '',
    contactNumber: '',
    completeAddress: '',
  });
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // The price comes from the server (the same calculation checkout uses): food delivery by distance, the coupon's discount.
  const [couponInput, setCouponInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [result, setResult] = useState<QuoteResult | null>(null);
  // Bumped when placing the order failed because a price changed (e.g. the Loyalty Card's discount), to ask the server for the price again.
  const [quoteTick, setQuoteTick] = useState(0);

  const dropoffLat = dropoff?.lat ?? null;
  const dropoffLng = dropoff?.lng ?? null;
  const lines = useMemo(
    () =>
      items.map((item) => ({
        productId: String(item.id),
        marketplace: item.marketplace === 'gulplaza' ? 'gulplaza' : 'mart',
        qty: item.qty,
        ...(item.portion ? { portion: item.portion } : {}),
      })),
    [items]
  );
  const quoteKey = JSON.stringify([lines, dropoffLat, dropoffLng, appliedCode]);

  useEffect(() => {
    if (lines.length === 0) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch('/api/checkout/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines,
          dropoff: dropoffLat !== null && dropoffLng !== null ? { lat: dropoffLat, lng: dropoffLng } : null,
          couponCode: appliedCode,
        }),
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { quote: Quote; couponError?: string } | null) => {
          if (data) setResult({ key: quoteKey, quote: data.quote, couponError: data.couponError ?? null });
        })
        // Offline, or the cart changed again: the numbers on screen stay as they are.
        .catch(() => {});
    }, QUOTE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [quoteKey, quoteTick, lines, dropoffLat, dropoffLng, appliedCode]);

  const quote = result?.quote ?? null;
  const isPricing = result?.key !== quoteKey;
  const couponError = result?.key === quoteKey ? result.couponError : null;
  const foodOrders = quote?.orders.filter((order) => order.marketplace === 'gulplaza') ?? [];
  // Food from a restaurant whose kitchen isn't on the map has no distance, so no delivery fee, and can't be ordered.
  const blockedOrders = foodOrders.filter((order) => order.deliveryNote === 'NO_RESTAURANT_PIN');
  // Restaurants beyond the nearby radius can be ordered from; the customer is told the delivery fee is higher.
  const farOrders = foodOrders.filter((order) => order.farAway);
  const cartHasFood = items.some((item) => item.marketplace === 'gulplaza');
  const shownSubtotal = quote ? quote.subtotal : subtotal;
  const total = quote ? quote.total : subtotal;
  // Removing the coupon hides it at once, while the price without it is still on its way.
  const appliedCoupon = appliedCode !== null ? (quote?.coupon ?? null) : null;

  const applyCoupon = () => {
    const code = couponInput.trim();
    if (code) setAppliedCode(code);
  };

  const removeCoupon = () => {
    setAppliedCode(null);
    setCouponInput('');
  };

  const handlePlaceOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!dropoff) {
      setFormError('Please pin your delivery location so a rider near you can be found.');
      return;
    }

    setFormError('');
    setIsPlacingOrder(true);

    const completeAddress = details.completeAddress.trim() || dropoff.label;

    // The summary the rider reads in the order chat. The amounts are the ones the server priced for the cart on screen;
    // the delivery charge the rider's commission is worked out from is saved by the server itself, not read from this text.
    const totals: Pick<Quote, 'subtotal' | 'delivery' | 'discount' | 'couponDiscount' | 'loyalty' | 'total'> = quote ?? {
      subtotal: shownSubtotal,
      delivery: 0,
      discount: 0,
      couponDiscount: 0,
      loyalty: null,
      total,
    };
    const vendors = [...new Set(items.map((item) => item.vendor))];
    const priceLine =
      totals.discount > 0 || totals.delivery > 0
        ? [
            `Items ${pkr(totals.subtotal)}`,
            ...(totals.couponDiscount > 0 ? [`− coupon ${appliedCoupon?.code ?? ''} ${pkr(totals.couponDiscount)}`] : []),
            ...(totals.loyalty && totals.loyalty.discount > 0 ? [`− loyalty card ${totals.loyalty.percent}% ${pkr(totals.loyalty.discount)}`] : []),
            ...(totals.delivery > 0 ? [`+ delivery ${pkr(totals.delivery)}`] : []),
            `= ${pkr(totals.total)}`,
          ].join(' ')
        : `Total ${pkr(totals.total)}`;
    const summary = [
      `🛒 New order from ${vendors.join(' + ')}`,
      '',
      ...items.map((item) => `• ${item.qty} × ${withPortionLabel(item.name, item.portion)} — ${item.price}`),
      '',
      priceLine,
      `Payment: ${paymentMethod === 'cod' ? 'Cash on delivery' : 'EasyPaisa / JazzCash'}`,
      `Customer: ${details.fullName} · ${details.contactNumber}`,
      `Address: ${completeAddress}`,
      ...(note.trim() ? ['', `📝 Note for the vendor: ${note.trim()}`] : []),
    ].join('\n');

    try {
      // One request for the whole cart (MangwaooMart and food together). The server works out every amount itself,
      // and, once the orders are placed, opens the rider's order chat with the summary above.
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: String(item.id),
            marketplace: item.marketplace === 'gulplaza' ? 'gulplaza' : 'mart',
            qty: item.qty,
            ...(item.portion ? { portion: item.portion } : {}),
            name: withPortionLabel(item.name, item.portion),
            price: item.price,
          })),
          fullName: details.fullName,
          contactNumber: details.contactNumber,
          completeAddress,
          paymentMethod,
          note: note.trim(),
          dropoff: { lat: dropoff.lat, lng: dropoff.lng },
          couponCode: appliedCoupon ? appliedCode : null,
          chat: { addressText: dropoff.label, pickupText: vendors.join(' + '), body: summary },
        }),
      });

      const payload = await response.json().catch(() => null);

      if (response.status === 401 && payload?.requiresLogin) {
        router.push('/login?next=/cart');
        return;
      }

      if (!response.ok) {
        setFormError(payload?.error ?? 'Could not place your order. Please try again.');
        // A price or stock changed while the customer was looking at the cart: show them the current numbers.
        if (response.status === 409) setQuoteTick((tick) => tick + 1);
        return;
      }

      // Orders are placed and the rider's order chat is open — send the customer to the "finding your rider" screen
      // (or to their account when the chat could not be opened).
      clearCart();
      router.push(payload?.chat?.id ? `/finding-rider/${payload.chat.id}` : '/account');
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (items.length === 0 && isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center" role="status">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 mx-auto mb-4">
          <ShoppingCart className="w-7 h-7 text-accent animate-pulse" />
        </div>
        <p className="text-brand-gray">Loading your cart…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 mx-auto mb-4">
          <ShoppingCart className="w-7 h-7 text-accent" />
        </div>
        <h1 className="text-2xl font-bold text-ink mb-2">Your cart is empty</h1>
        <p className="text-brand-gray mb-8">
          Browse MangwaooMart to add groceries and everyday essentials.
        </p>
        <Link
          href="/mart"
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-6 py-3 text-sm font-semibold text-white hover:shadow-lg transition-all duration-300"
        >
          Browse MangwaooMart
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handlePlaceOrder} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <h1 className="text-2xl md:text-3xl font-bold text-ink mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Payment details - left */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-surface p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink mb-4">Delivery Details</h2>

            <div className="space-y-4">
              <label className="block text-sm text-ink">
                Full Name
                <input
                  type="text"
                  value={details.fullName}
                  onChange={(event) => setDetails((prev) => ({ ...prev, fullName: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                  placeholder="Enter your full name"
                  required
                />
              </label>

              <label className="block text-sm text-ink">
                Contact Number
                <input
                  type="tel"
                  value={details.contactNumber}
                  onChange={(event) => setDetails((prev) => ({ ...prev, contactNumber: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                  placeholder="Enter your contact number"
                  required
                />
              </label>

              <div>
                <p className="mb-1 text-sm text-ink">Delivery location</p>
                <LocationPicker
                  value={dropoff}
                  onChange={setDropoffOverride}
                  placeholder="Search your area or street"
                  changeLabel="Change delivery location"
                  mapTitle="Choose your delivery place"
                />
              </div>

              <label className="block text-sm text-ink">
                House / flat / landmark
                <textarea
                  value={details.completeAddress}
                  onChange={(event) => setDetails((prev) => ({ ...prev, completeAddress: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                  placeholder="e.g. Flat 4B, near Al-Fatah store (optional if the pin above is exact)"
                  rows={2}
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-surface p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink mb-4">Payment Method</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('cod')}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                  paymentMethod === 'cod'
                    ? 'border-accent bg-red-50'
                    : 'border-gray-200 hover:border-accent'
                }`}
              >
                <Banknote className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-ink">Cash on Delivery</p>
                  <p className="text-xs text-brand-gray">Pay when your order arrives</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('easypaisa_jazzcash')}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                  paymentMethod === 'easypaisa_jazzcash'
                    ? 'border-accent bg-red-50'
                    : 'border-gray-200 hover:border-accent'
                }`}
              >
                <Smartphone className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-ink">EasyPaisa / JazzCash</p>
                  <p className="text-xs text-brand-gray">Pay via mobile wallet transfer</p>
                </div>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-surface p-6 shadow-soft">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Note for the vendor</h2>
              <span className="text-xs text-brand-gray">Optional</span>
            </div>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={MAX_NOTE_LENGTH}
              rows={3}
              aria-label="Note for the vendor"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
              placeholder="Anything the vendor should know? e.g. less spicy, no onions, extra ketchup, call me when you reach"
            />
            <p className="mt-1 text-right text-xs text-brand-gray">
              {note.length}/{MAX_NOTE_LENGTH}
            </p>
          </div>
        </div>

        {/* Cart items - right */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-gray-100 bg-surface p-6 shadow-soft lg:sticky lg:top-24">
            <h2 className="text-lg font-semibold text-ink mb-4">Order Summary</h2>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={`${item.id}:${item.portion ?? 0}`} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                    <p className="text-xs text-brand-gray">
                      {item.portion ? <span className="font-semibold text-ink">{formatPortion(item.portion)} · </span> : null}
                      {item.price}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, item.qty - 1, item.portion)}
                      className="rounded-full border border-gray-200 p-1 text-ink hover:bg-gray-100"
                      aria-label={`Decrease quantity of ${withPortionLabel(item.name, item.portion)}`}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold text-ink">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, item.qty + 1, item.portion)}
                      className="rounded-full border border-gray-200 p-1 text-ink hover:bg-gray-100"
                      aria-label={`Increase quantity of ${withPortionLabel(item.name, item.portion)}`}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id, item.portion)}
                      className="ml-1 rounded-full border border-gray-200 p-1 text-brand-gray hover:border-accent hover:text-accent"
                      aria-label={`Remove ${withPortionLabel(item.name, item.portion)}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Coupon: the code is checked by the server; pressing Enter here must not place the order. */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <label htmlFor="coupon-code" className="mb-1.5 block text-sm font-semibold text-ink">
                Coupon code
              </label>
              {appliedCoupon ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2">
                  <p className="flex min-w-0 items-center gap-2 text-sm text-success">
                    <BadgePercent className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="font-bold">{appliedCoupon.code}</span> · {appliedCoupon.percent}% off
                      {appliedCoupon.description ? <span className="block truncate text-xs">{appliedCoupon.description}</span> : null}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="shrink-0 rounded-full p-1 text-success hover:bg-green-100"
                    aria-label="Remove coupon"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    id="coupon-code"
                    type="text"
                    value={couponInput}
                    onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        applyCoupon();
                      }
                    }}
                    maxLength={20}
                    placeholder="Enter code"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm uppercase tracking-wide text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={!couponInput.trim() || (appliedCode !== null && isPricing)}
                    className="shrink-0 rounded-xl border border-accent px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-brand-red-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {appliedCode !== null && isPricing ? 'Checking…' : 'Apply'}
                  </button>
                </div>
              )}
              {couponError ? (
                <p role="alert" className="mt-1.5 text-xs text-danger">
                  {couponError}
                </p>
              ) : null}
            </div>

            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-brand-gray">Subtotal</span>
                <span className="font-semibold text-ink">{pkr(shownSubtotal)}</span>
              </div>

              {quote && appliedCoupon && quote.couponDiscount > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-brand-gray">Coupon {appliedCoupon.code}</span>
                  <span className="font-semibold text-success">− {pkr(quote.couponDiscount)}</span>
                </div>
              ) : null}

              {/* The Loyalty Card: the random % the card drew for this order (only for a customer with an active card). */}
              {quote?.loyalty && quote.loyalty.discount > 0 ? (
                <div className="flex items-center justify-between" data-testid="loyalty-line">
                  <span className="flex items-center gap-1.5 text-brand-gray">
                    <CreditCard className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                    Loyalty Card · {quote.loyalty.percent}% off
                  </span>
                  <span className="font-semibold text-success">− {pkr(quote.loyalty.discount)}</span>
                </div>
              ) : null}

              {/* Delivery is charged on food only: one line per restaurant, by its distance to the delivery location. */}
              {foodOrders.map((order) => (
                <div key={order.sellerId} className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-brand-gray">
                    Delivery · {order.sellerName}
                    {order.distanceKm !== null ? <span className="block text-xs">{order.distanceKm.toFixed(1)} km from the restaurant</span> : null}
                  </span>
                  {order.deliveryNote ? (
                    <span className={`shrink-0 text-xs ${order.deliveryNote === 'NEEDS_DROPOFF' ? 'text-brand-gray' : 'font-semibold text-danger'}`}>
                      {order.deliveryNote === 'NEEDS_DROPOFF' ? 'Pin your location' : "Can't deliver"}
                    </span>
                  ) : (
                    <span className="shrink-0 font-semibold text-ink">{pkr(order.deliveryFee)}</span>
                  )}
                </div>
              ))}
              {cartHasFood && !quote ? (
                <div className="flex items-center justify-between">
                  <span className="text-brand-gray">Delivery fee</span>
                  <span className="text-xs text-brand-gray">Calculating…</span>
                </div>
              ) : null}
              {foodOrders.some((order) => order.deliveryNote === 'NEEDS_DROPOFF') ? (
                <p className="text-xs text-brand-gray">Pin your delivery location to see the delivery fee.</p>
              ) : null}
              {farOrders.map((order) => (
                <p key={order.sellerId} role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-ink">
                  {farAwayNote(order.distanceKm ?? FOOD_DELIVERY_RADIUS_KM, order.sellerName)}
                </p>
              ))}
              {blockedOrders.map((order) => (
                <p key={order.sellerId} role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-danger">
                  {`${order.sellerName} hasn't set its location on the map yet, so we can't work out the delivery fee. Please choose another restaurant.`}
                </p>
              ))}
              {cartHasFood ? (
                <p className="text-xs text-gray-400">
                  {`Delivery is charged on food only: PKR ${DELIVERY_RATE_PER_KM} per km from the restaurant to you, never less than PKR ${MINIMUM_DELIVERY_FEE}.`}
                </p>
              ) : null}

              <ul className="list-disc space-y-0.5 pl-5 text-xs font-bold text-ink">
                <li>No other taxes</li>
                <li>No platform fees</li>
                <li>No other charges</li>
              </ul>
              <p className="flex items-center gap-1.5 text-xs text-brand-gray">
                <Gift className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                Win Mangwaoo Points when this order is delivered.
              </p>
              <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-base">
                <span className="font-semibold text-ink">Total</span>
                <span className={`font-bold text-accent ${isPricing && quote ? 'opacity-60' : ''}`}>{pkr(total)}</span>
              </div>
            </div>

            {formError ? <p className="mt-4 text-sm text-danger">{formError}</p> : null}

            <button
              type="submit"
              disabled={isPlacingOrder || blockedOrders.length > 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary py-3 text-sm font-semibold text-white hover:shadow-lg transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MessageCircle className="w-4 h-4" />
              {isPlacingOrder ? 'Placing Order…' : 'Place Order'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
