'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bike, Flag, MapPin, Send, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import RiderChatThread from './RiderChatThread';
import LocationPicker, { type PickedLocation } from './LocationPicker';
import RouteSummary from './RouteSummary';
import type { RiderChatSummary } from '@/lib/rider-chat-types';

type DeliveryAddress = {
  label: string;
  lat: number;
  lng: number;
};

function ChatStatusBanner({ chat }: { chat: RiderChatSummary }) {
  if (chat.status === 'ACTIVE') {
    return (
      <div className="flex items-center gap-2 bg-green-50 px-4 py-2 text-xs font-semibold text-success">
        <Bike className="h-4 w-4" />
        {chat.riderName ?? 'Your rider'} is chatting with you
      </div>
    );
  }

  if (chat.status === 'CLOSED') {
    return <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-brand-gray">This order chat has ended.</div>;
  }

  return (
    <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-xs font-semibold text-warning">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
      </span>
      {chat.nearbyRiderCount
        ? `Finding the nearest rider… ${chat.nearbyRiderCount} ${chat.nearbyRiderCount === 1 ? 'rider' : 'riders'} nearby`
        : 'Finding a rider… our team will reply shortly'}
    </div>
  );
}

export default function OrderChat({
  onClose,
  address,
  onRequestAddress,
  pickup,
  onPickupChange,
}: {
  onClose: () => void;
  address: DeliveryAddress | null;
  onRequestAddress: () => void;
  /** Pickup point is held by the parent so it survives a trip to change the delivery address. */
  pickup: PickedLocation | null;
  onPickupChange: (pickup: PickedLocation | null) => void;
}) {
  const { user } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER';

  const [chat, setChat] = useState<RiderChatSummary | null>(null);
  const [isLoadingChat, setIsLoadingChat] = useState(isCustomer);
  const [draft, setDraft] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isCustomer) return;

    let isMounted = true;

    fetch('/api/rider-chats')
      .then((response) => response.json())
      .then((data) => {
        if (isMounted) setChat(data.chat ?? null);
      })
      .catch(() => {
        if (isMounted) setError('Could not load your chat. Please try again.');
      })
      .finally(() => {
        if (isMounted) setIsLoadingChat(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isCustomer]);

  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !address || isStarting) return;

    if (!pickup) {
      setError('Please choose where the rider should pick up your order.');
      return;
    }

    setIsStarting(true);
    setError('');

    try {
      const response = await fetch('/api/rider-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: address.lat,
          lng: address.lng,
          addressText: address.label,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          pickupText: pickup.label,
          body: text,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Could not send your order. Please try again.');
        return;
      }

      setChat(data.chat);
      setDraft('');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleEnd = async () => {
    if (!chat || isEnding) return;

    setIsEnding(true);

    try {
      await fetch(`/api/rider-chats/${chat.id}/close`, { method: 'POST' });
      setChat(null);
    } finally {
      setIsEnding(false);
    }
  };

  let content: React.ReactNode;

  if (!isCustomer) {
    content = (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-brand-gray">
        Order chat is for customer accounts. Please log in with a customer account to place an order.
      </div>
    );
  } else if (isLoadingChat) {
    content = (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-brand-gray">Loading…</p>
      </div>
    );
  } else if (chat) {
    content = (
      <>
        <ChatStatusBanner chat={chat} />
        <RouteSummary chat={chat} className="max-h-40 overflow-y-auto border-b border-gray-100 px-4 py-2" />
        <RiderChatThread
          key={chat.id}
          chatId={chat.id}
          currentRole="CUSTOMER"
          onChatUpdate={setChat}
          onMissing={() => {
            setChat(null);
            setError('This order chat was removed by Mangwaoo Support. You can start a new one below.');
          }}
          placeholder="Message your rider…"
        />
      </>
    );
  } else if (!address) {
    content = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <MapPin className="h-10 w-10 text-accent" />
        <p className="text-sm text-ink">
          Select your delivery address first so we can connect you with the nearest rider.
        </p>
        <button
          type="button"
          onClick={onRequestAddress}
          className="rounded-full bg-[#9b0000] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-red-200 hover:bg-[#840000]"
        >
          Select delivery address
        </button>
      </div>
    );
  } else {
    content = (
      <form onSubmit={handleStart} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <MapPin className="h-4 w-4 text-success" />
            Pickup location
          </p>
          <LocationPicker value={pickup} onChange={onPickupChange} placeholder="Where should the rider pick it up?" />
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Flag className="h-4 w-4 text-accent" />
            Drop-off location
          </p>
          <div className="rounded-xl bg-brand-light p-3 text-xs text-ink">
            <p className="line-clamp-2">{address.label}</p>
            <button
              type="button"
              onClick={onRequestAddress}
              className="mt-1 font-semibold text-accent hover:underline"
            >
              Change address
            </button>
          </div>
        </div>

        <label className="flex flex-1 flex-col text-sm font-semibold text-ink">
          What would you like to order?
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={2000}
            placeholder="e.g. 2 zinger burgers from KFC Gulshan, 1 litre milk…"
            className="mt-2 min-h-20 flex-1 resize-none rounded-xl border border-gray-300 p-3 text-sm font-normal outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
          />
        </label>

        <p className="text-xs text-brand-gray">Your message goes to the nearest available rider. The first rider to reply takes your order.</p>

        <button
          type="submit"
          disabled={isStarting || !draft.trim() || !pickup}
          className="flex items-center justify-center gap-2 rounded-full bg-[#9b0000] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-200 hover:bg-[#840000] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {isStarting ? 'Sending…' : 'Send to nearest rider'}
        </button>
      </form>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 sm:items-center">
      <div className="flex h-[34rem] max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 p-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">Order with Mangwaoo</p>
            <p className="text-xs text-brand-gray">Chat directly with a rider near you</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {chat && chat.status !== 'CLOSED' && (
              <button
                type="button"
                onClick={handleEnd}
                disabled={isEnding}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-red-300 hover:text-danger disabled:opacity-60"
              >
                End chat
              </button>
            )}
            {chat?.status === 'CLOSED' && (
              <button
                type="button"
                onClick={() => setChat(null)}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
              >
                New order
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-gray-200 p-2 text-ink hover:bg-gray-100"
              aria-label="Close order chat"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {error ? <p className="px-4 pt-2 text-xs text-danger">{error}</p> : null}

        {content}
      </div>
    </div>,
    document.body
  );
}
