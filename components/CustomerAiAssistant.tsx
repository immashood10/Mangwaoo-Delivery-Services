'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { Bot, Check, ChevronDown, MessageCircle, Send, X } from 'lucide-react';
import { useCart, type CartProduct } from '@/lib/cart-context';
import { useDeliveryAddress } from '@/lib/delivery-address-context';

type Portion = { grams: number; price: number };
type Dish = {
  id: string;
  marketplace: 'gulplaza';
  name: string;
  category: string;
  icon: string;
  vendor: string;
  sellerId: string;
  price: number;
  portions: Portion[];
  spiceLevel: string | null;
  dishTags: string[];
  available: boolean;
  distanceKm: number | null;
  deliveryNearby: boolean | null;
};
type ChatMessage = { role: 'user' | 'assistant'; content: string; products?: Dish[]; link?: string };
type PendingAdd = { dish: Dish; portion: Portion | null };
type AssistantResponse = { reply?: string; products?: Dish[]; link?: string; error?: string };

const DASHBOARD_ROOTS = ['/admin', '/seller', '/rider', '/asm'];
const suggestions = ['Mujhe 500 rupees tak kuch spicy chahiye', 'Halka khana', 'Bachon ke liye food'];

export default function CustomerAiAssistant() {
  const pathname = usePathname();
  const { addItem } = useCart();
  const { address } = useDeliveryAddress();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingAdd | null>(null);
  const [added, setAdded] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Assalam-o-alaikum! I can find dishes by name, budget, spice level, or food tags. You can also ask for your latest order status.' },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [messages, busy, pending]);

  if (DASHBOARD_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`))) return null;

  const sendMessage = async (event?: FormEvent, suggested?: string) => {
    event?.preventDefault();
    const message = (suggested ?? text).trim();
    if (!message || busy) return;
    setError('');
    setText('');
    setPending(null);
    setAdded('');
    const next = [...messages, { role: 'user' as const, content: message }];
    setMessages(next);
    setBusy(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: next.slice(-6).map(({ role, content }) => ({ role, content })),
          ...(address ? { lat: address.lat, lng: address.lng } : {}),
        }),
      });
      const data = await response.json() as AssistantResponse;
      if (!response.ok) throw new Error(data.error || 'The assistant could not reply. Please try again.');
      setMessages((current) => [...current, { role: 'assistant', content: data.reply || 'I could not prepare an answer.', products: data.products, link: data.link }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reach the assistant. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmAdd = () => {
    if (!pending) return;
    const { dish, portion } = pending;
    const item: CartProduct = {
      id: dish.id,
      name: dish.name,
      price: `PKR ${(portion?.price ?? dish.price).toLocaleString()}`,
      icon: dish.icon,
      vendor: dish.vendor,
      sellerId: dish.sellerId,
      marketplace: 'gulplaza',
      ...(portion ? { portion: portion.grams } : {}),
    };
    addItem(item);
    setAdded(`${dish.name}${portion ? ` (${portion.grams >= 1000 ? `${portion.grams / 1000} kg` : `${portion.grams} g`})` : ''} added to your cart.`);
    setPending(null);
  };

  return (
    <div className="fixed bottom-5 right-4 z-[60] sm:bottom-6 sm:right-6">
      {open ? (
        <section aria-label="Mangwaoo AI assistant" className="mb-3 flex h-[min(74vh,620px)] w-[min(94vw,390px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-surface shadow-2xl">
          <header className="flex items-center justify-between bg-brand-red-primary px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <Bot className="h-5 w-5" />
              <div><p className="font-bold">Mangwaoo AI</p><p className="text-xs text-white/75">Shopping and order help</p></div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Minimize assistant" className="rounded-full p-2 hover:bg-white/10"><ChevronDown className="h-5 w-5" /></button>
          </header>

          <div className="border-b border-gray-200 bg-brand-light px-3 py-2 text-[11px] leading-4 text-brand-gray">
            Some messages may be sent to Google Gemini to understand your request. Avoid sharing passwords, OTPs, payment details, or personal contact information. Order status is checked securely from your account.
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-5 ${message.role === 'user' ? 'bg-brand-red-primary text-white' : 'bg-brand-light text-ink'}`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.link ? <a href={message.link} className="mt-1 inline-block font-semibold underline">Track this order</a> : null}
                  {message.products?.length ? (
                    <ul className="mt-2 space-y-2">
                      {message.products.map((dish) => (
                        <li key={dish.id} className="rounded-xl border border-gray-200 bg-surface p-2.5 text-ink">
                          <div className="flex items-start gap-2">
                            <span aria-hidden="true" className="text-lg">{dish.icon}</span>
                            <div className="min-w-0 flex-1">
                              <a href={`/gulplaza/${dish.id}`} className="font-semibold hover:text-accent">{dish.name}</a>
                              <p className="text-xs text-brand-gray">{dish.vendor} · {dish.category}</p>
                              <p className="mt-0.5 text-xs font-semibold">{dish.portions.length ? `From PKR ${Math.min(...dish.portions.map((portion) => portion.price)).toLocaleString()}` : `PKR ${dish.price.toLocaleString()}`}</p>
                              <p className="text-[11px] text-brand-gray">{dish.spiceLevel ? `Spice: ${dish.spiceLevel.toLowerCase()}` : 'Spice not specified'}{dish.dishTags.length ? ` · ${dish.dishTags.map((tag) => tag.replaceAll('_', ' ').toLowerCase()).join(', ')}` : ''}{dish.distanceKm !== null ? ` · ${dish.distanceKm.toFixed(1)} km away` : ''}</p>
                              {dish.portions.length > 0 ? <p className="text-[11px] text-brand-gray">Options: {dish.portions.map((portion) => `${portion.grams >= 1000 ? `${portion.grams / 1000} kg` : `${portion.grams} g`} Rs ${portion.price.toLocaleString()}`).join(' · ')}</p> : null}
                              <button type="button" onClick={() => setPending({ dish, portion: dish.portions.length === 1 ? dish.portions[0] : null })} className="mt-1.5 rounded-lg border border-accent px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent hover:text-white">Add to cart</button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ))}
            {busy ? <p className="text-xs text-brand-gray">Mangwaoo AI is thinking…</p> : null}
            {pending ? (
              <div className="rounded-xl border border-accent/30 bg-surface p-3 text-sm text-ink">
                <p>Add <strong>{pending.dish.name}</strong> to your cart?</p>
                {pending.dish.portions.length > 1 ? (
                  <label className="mt-2 block text-xs text-brand-gray">Choose size
                    <select value={pending.portion?.grams ?? ''} onChange={(event) => setPending({ ...pending, portion: pending.dish.portions.find((portion) => portion.grams === Number(event.target.value)) ?? null })} className="mt-1 block w-full rounded-lg border border-gray-300 bg-surface px-2 py-1.5 text-ink">
                      <option value="">Select a size</option>{pending.dish.portions.map((portion) => <option key={portion.grams} value={portion.grams}>{portion.grams >= 1000 ? `${portion.grams / 1000} kg` : `${portion.grams} g`} · PKR {portion.price.toLocaleString()}</option>)}
                    </select>
                  </label>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={confirmAdd} disabled={pending.dish.portions.length > 1 && !pending.portion} className="rounded-lg bg-brand-red-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Confirm add</button>
                  <button type="button" onClick={() => setPending(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-ink">Cancel</button>
                </div>
              </div>
            ) : null}
            {added ? <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-success"><Check className="mr-1 inline h-3.5 w-3.5" />{added}</p> : null}
            {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
            <div ref={bottomRef} />
          </div>

          {messages.length === 1 ? (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void sendMessage(undefined, suggestion)} className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-ink hover:border-accent hover:text-accent">{suggestion}</button>)}</div>
          ) : null}
          <form onSubmit={(event) => void sendMessage(event)} className="flex items-center gap-2 border-t border-gray-200 p-3">
            <input value={text} onChange={(event) => setText(event.target.value)} maxLength={500} aria-label="Message Mangwaoo AI" placeholder="Ask in English or Roman Urdu…" className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Send message" className="rounded-xl bg-brand-red-primary p-2.5 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </form>
        </section>
      ) : null}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Close Mangwaoo AI' : 'Open Mangwaoo AI'} className="ml-auto flex items-center gap-2 rounded-full bg-brand-red-primary px-4 py-3 font-semibold text-white shadow-xl hover:bg-brand-red-secondary">
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        <span className="text-sm">{open ? 'Close' : 'Ask Mangwaoo AI'}</span>
      </button>
    </div>
  );
}
