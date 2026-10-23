'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bike, ChevronRight, Clock, Headset, Inbox, MapPin, MessagesSquare, Power } from 'lucide-react';
import RiderChatThread from '@/components/RiderChatThread';
import SupportChat from '@/components/SupportChat';
import { useRider } from '@/components/rider/RiderShell';
import type { RiderChatSummary } from '@/lib/rider-chat-types';

function PendingApproval() {
  return (
    <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
      <Clock className="mx-auto mb-3 h-10 w-10 text-warning" />
      <h2 className="text-xl font-bold text-ink">Your account is pending approval</h2>
      <p className="mt-2 text-sm text-brand-gray">
        Our team will review your rider account shortly. Once approved, you can go online and receive nearby order requests.
      </p>
    </div>
  );
}

function ChatCard({ chat, active, onClick, request = false }: { chat: RiderChatSummary; active: boolean; onClick: () => void; request?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left ${active ? 'border-accent bg-brand-light' : 'border-gray-200 bg-surface hover:border-accent'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-ink">{chat.customerName}</span>
        {request && chat.distanceKm !== undefined ? <span className="text-xs text-brand-gray">{chat.distanceKm.toFixed(1)} km</span> : null}
      </div>
      {chat.lastMessage ? <p className="mt-1 line-clamp-2 text-xs text-brand-gray">{chat.lastMessage}</p> : null}
      <p className="mt-1 flex items-center gap-1 truncate text-xs text-brand-gray">
        <MapPin className="h-3 w-3 shrink-0" />
        {chat.addressText}
      </p>
    </button>
  );
}

/** Dashboard: the online switch and where to go next. */
export function RiderHome() {
  const { rider, isOnline, hasLocation, error, toggleOnline, requests, chats } = useRider();

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
          <Bike className="h-4 w-4" /> Rider
        </div>
        <h1 className="text-3xl font-bold text-ink">Welcome, {rider.name.split(' ')[0]}</h1>
      </div>

      {!rider.isApproved ? (
        <PendingApproval />
      ) : (
        <>
          <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-brand-gray">Status{rider.vehicleType ? ` · ${rider.vehicleType}` : ''}</p>
              <p className={`mt-1 text-lg font-bold ${isOnline ? 'text-success' : 'text-brand-gray'}`}>
                {isOnline ? (hasLocation ? 'Online · receiving requests' : 'Online · getting your location…') : 'Offline'}
              </p>
              {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
              {isOnline && !error ? <p className="mt-1 text-xs text-brand-gray">Keep the dashboard open to receive order requests.</p> : null}
            </div>
            <button
              type="button"
              onClick={toggleOnline}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ${isOnline ? 'border border-gray-300 text-ink' : 'bg-success text-white'}`}
            >
              <Power className="h-4 w-4" />
              {isOnline ? 'Go offline' : 'Go online'}
            </button>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link href="/rider/requests" className="group flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-soft transition hover:ring-2 hover:ring-accent">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-red-primary/10 text-accent">
                <Inbox className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-2xl font-bold text-ink">{requests.length}</span>
                <span className="text-sm text-brand-gray">New requests nearby</span>
              </span>
              <ChevronRight className="h-5 w-5 text-brand-gray group-hover:text-accent" />
            </Link>
            <Link href="/rider/chats" className="group flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-soft transition hover:ring-2 hover:ring-accent">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-red-primary/10 text-accent">
                <MessagesSquare className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-2xl font-bold text-ink">{chats.length}</span>
                <span className="text-sm text-brand-gray">Your order chats</span>
              </span>
              <ChevronRight className="h-5 w-5 text-brand-gray group-hover:text-accent" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/** New requests, or the rider's accepted chats: the list on the left and the order chat on the right. */
export function RiderOrders({ mode }: { mode: 'requests' | 'chats' }) {
  const { rider, requests, chats } = useRider();
  const [selectedChat, setSelectedChat] = useState<RiderChatSummary | null>(null);
  const isRequests = mode === 'requests';
  const items = isRequests ? requests : chats;

  if (!rider.isApproved) return <PendingApproval />;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <section className={`space-y-2 ${selectedChat ? 'hidden lg:block' : ''}`}>
        <h1 className="text-sm font-bold uppercase tracking-wide text-ink">
          {isRequests ? 'New requests' : 'Your chats'} ({items.length})
        </h1>
        {items.length ? (
          items.map((chat) => (
            <ChatCard key={chat.id} chat={chat} active={selectedChat?.id === chat.id} request={isRequests} onClick={() => setSelectedChat(chat)} />
          ))
        ) : (
          <p className="rounded-xl bg-surface p-4 text-sm text-brand-gray">
            {isRequests ? 'No nearby requests right now.' : 'Accepted orders will appear here.'}
          </p>
        )}
      </section>

      <section className={`${selectedChat ? '' : 'hidden lg:block'} min-h-[28rem] rounded-2xl bg-surface p-4 shadow-soft`}>
        {selectedChat ? (
          <>
            <button
              type="button"
              onClick={() => setSelectedChat(null)}
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-accent lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {isRequests ? 'requests' : 'chats'}
            </button>
            <RiderChatThread key={selectedChat.id} chatId={selectedChat.id} currentRole="RIDER" placeholder="Message the customer…" />
          </>
        ) : (
          <div className="flex h-full min-h-[24rem] flex-col items-center justify-center text-center text-brand-gray">
            <Bike className="mb-3 h-10 w-10" />
            <p>Select a request or chat to view the order details.</p>
          </div>
        )}
      </section>
    </div>
  );
}

/** Messages from the Mangwaoo team (admin). */
export function RiderMessages() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-ink">Messages</h1>
      <SupportChat
        emptyState={
          <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
            <Headset className="mx-auto mb-3 h-10 w-10 text-brand-gray" />
            <p className="font-semibold text-ink">No messages from Mangwaoo yet</p>
            <p className="mt-1 text-sm text-brand-gray">When the Mangwaoo team writes to you, the chat shows up here and you can reply.</p>
          </div>
        }
      />
    </div>
  );
}
