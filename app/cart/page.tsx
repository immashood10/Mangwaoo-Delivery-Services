'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2, ShoppingCart, MessageCircle, Banknote, Smartphone } from 'lucide-react';
import { useCart } from '@/lib/cart-context';

const DELIVERY_FEE = 150;

export default function CartPage() {
  const router = useRouter();
  const { items, subtotal, subtotalLabel, updateQty, removeItem, clearCart } = useCart();

  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'easypaisa_jazzcash'>('cod');
  const [details, setDetails] = useState({
    fullName: '',
    contactNumber: '',
    completeAddress: '',
  });
  const [formError, setFormError] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const total = subtotal + (items.length > 0 ? DELIVERY_FEE : 0);
  const totalLabel = `PKR ${total.toLocaleString()}`;

  const handlePlaceOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setIsPlacingOrder(true);

    const toItemPayload = (item: (typeof items)[number]) => ({
      productId: String(item.id),
      qty: item.qty,
      name: item.name,
      price: item.price,
    });

    const orderDetails = {
      fullName: details.fullName,
      contactNumber: details.contactNumber,
      completeAddress: details.completeAddress,
      paymentMethod,
    };

    // GulPlaza items live in a separate catalog/order flow, so a cart mixing
    // both marketplaces checks out against both endpoints.
    const martItems = items.filter((item) => item.marketplace !== 'gulplaza').map(toItemPayload);
    const gulplazaItems = items.filter((item) => item.marketplace === 'gulplaza').map(toItemPayload);

    const endpoints: string[] = [];
    if (martItems.length > 0) endpoints.push('/api/orders');
    if (gulplazaItems.length > 0) endpoints.push('/api/gulplaza-orders');

    try {
      const responses = await Promise.all(
        endpoints.map((endpoint) =>
          fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: endpoint === '/api/orders' ? martItems : gulplazaItems,
              ...orderDetails,
            }),
          })
        )
      );

      const payloads = await Promise.all(responses.map((response) => response.json().catch(() => null)));

      const unauthorizedIndex = responses.findIndex((response) => response.status === 401);
      if (unauthorizedIndex !== -1 && payloads[unauthorizedIndex]?.requiresLogin) {
        router.push('/login?next=/cart');
        return;
      }

      const failedIndex = responses.findIndex((response) => !response.ok);
      if (failedIndex !== -1) {
        setFormError(payloads[failedIndex]?.error ?? 'Could not place your order. Please try again.');
        return;
      }

      clearCart();
      router.push('/mart');
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 mx-auto mb-4">
          <ShoppingCart className="w-7 h-7 text-brand-red-primary" />
        </div>
        <h1 className="text-2xl font-bold text-brand-dark mb-2">Your cart is empty</h1>
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
      <h1 className="text-2xl md:text-3xl font-bold text-brand-dark mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Payment details - left */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-brand-dark mb-4">Delivery Details</h2>

            <div className="space-y-4">
              <label className="block text-sm text-brand-dark">
                Full Name
                <input
                  type="text"
                  value={details.fullName}
                  onChange={(event) => setDetails((prev) => ({ ...prev, fullName: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
                  placeholder="Enter your full name"
                  required
                />
              </label>

              <label className="block text-sm text-brand-dark">
                Contact Number
                <input
                  type="tel"
                  value={details.contactNumber}
                  onChange={(event) => setDetails((prev) => ({ ...prev, contactNumber: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
                  placeholder="Enter your contact number"
                  required
                />
              </label>

              <label className="block text-sm text-brand-dark">
                Complete Address
                <textarea
                  value={details.completeAddress}
                  onChange={(event) => setDetails((prev) => ({ ...prev, completeAddress: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
                  placeholder="House / street / area"
                  rows={3}
                  required
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-brand-dark mb-4">Payment Method</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('cod')}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                  paymentMethod === 'cod'
                    ? 'border-brand-red-primary bg-red-50'
                    : 'border-gray-200 hover:border-brand-red-primary'
                }`}
              >
                <Banknote className="w-5 h-5 text-brand-red-primary" />
                <div>
                  <p className="text-sm font-semibold text-brand-dark">Cash on Delivery</p>
                  <p className="text-xs text-brand-gray">Pay when your order arrives</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('easypaisa_jazzcash')}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                  paymentMethod === 'easypaisa_jazzcash'
                    ? 'border-brand-red-primary bg-red-50'
                    : 'border-gray-200 hover:border-brand-red-primary'
                }`}
              >
                <Smartphone className="w-5 h-5 text-brand-red-primary" />
                <div>
                  <p className="text-sm font-semibold text-brand-dark">EasyPaisa / JazzCash</p>
                  <p className="text-xs text-brand-gray">Pay via mobile wallet transfer</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Cart items - right */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-soft lg:sticky lg:top-24">
            <h2 className="text-lg font-semibold text-brand-dark mb-4">Order Summary</h2>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-dark">{item.name}</p>
                    <p className="text-xs text-brand-gray">{item.price}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, item.qty - 1)}
                      className="rounded-full border border-gray-200 p-1 text-brand-dark hover:bg-gray-100"
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-5 text-center text-sm font-semibold text-brand-dark">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, item.qty + 1)}
                      className="rounded-full border border-gray-200 p-1 text-brand-dark hover:bg-gray-100"
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="ml-1 rounded-full border border-gray-200 p-1 text-brand-gray hover:border-brand-red-primary hover:text-brand-red-primary"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-brand-gray">Subtotal</span>
                <span className="font-semibold text-brand-dark">{subtotalLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-brand-gray">Delivery Fee</span>
                <span className="font-semibold text-brand-dark">PKR {DELIVERY_FEE}</span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-base">
                <span className="font-semibold text-brand-dark">Total</span>
                <span className="font-bold text-brand-red-primary">{totalLabel}</span>
              </div>
            </div>

            {formError ? <p className="mt-4 text-sm text-red-600">{formError}</p> : null}

            <button
              type="submit"
              disabled={isPlacingOrder}
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
