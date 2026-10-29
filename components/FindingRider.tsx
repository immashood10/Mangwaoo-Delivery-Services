'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bike, CheckCircle2, ChevronRight, Navigation, PackageSearch } from 'lucide-react';
import RiderChatThread from './RiderChatThread';
import RiderRatingForm from './RiderRatingForm';
import RouteSummary from './RouteSummary';
import StarRating, { RiderRatingLabel } from './StarRating';
import { trackingPath } from '@/lib/order-number';
import { TRACK_STATUS_LABEL, type TrackStatus } from '@/lib/order-tracking-config';
import type { RiderChatSummary } from '@/lib/rider-chat-types';

/** Radar-style "looking for a rider" animation. */
function Radar() {
  return (
    <div className="relative mx-auto flex h-44 w-44 items-center justify-center" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-red-primary/15" />
      <span className="absolute inline-flex h-32 w-32 animate-ping rounded-full bg-brand-red-primary/20 [animation-delay:400ms]" />
      <span className="absolute h-24 w-24 rounded-full bg-brand-red-primary/10" />
      <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-red-primary to-brand-red-secondary text-white shadow-lg">
        <Bike className="h-9 w-9" />
      </span>
    </div>
  );
}

/** An order of this customer that is still going, with where to follow it live. */
export type LiveOrderLink = { ref: string; status: TrackStatus; storeName: string };

export default function FindingRider({ initialChat, liveOrders = [] }: { initialChat: RiderChatSummary; liveOrders?: LiveOrderLink[] }) {
  const [chat, setChat] = useState(initialChat);
  const [isRemoved, setIsRemoved] = useState(false);

  if (isRemoved) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <PackageSearch className="mx-auto mb-4 h-12 w-12 text-brand-gray" />
        <h1 className="mb-2 text-xl font-bold text-ink">This order chat is no longer available</h1>
        <p className="mb-6 text-brand-gray">It was cancelled or removed by Mangwaoo Support. You can place a new order any time.</p>
        <Link href="/gulplaza" className="inline-flex rounded-xl bg-brand-red-primary px-6 py-3 text-sm font-semibold text-white hover:bg-brand-red-secondary">
          Browse Food
        </Link>
      </div>
    );
  }

  const isSearching = chat.status === 'OPEN';
  const isClosed = chat.status === 'CLOSED';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 md:py-12">
      <div className="mb-6 text-center">
        {isSearching ? (
          <>
            <Radar />
            <h1 className="mt-4 text-2xl font-bold text-ink">Finding your rider…</h1>
            <p className="mt-1 text-brand-gray">
              {chat.managed
                ? `Your order is with our ${chat.areaName ?? 'area'} team, who are picking a rider for you.`
                : chat.nearbyRiderCount
                  ? `${chat.nearbyRiderCount} ${chat.nearbyRiderCount === 1 ? 'rider is' : 'riders are'} nearby and can see your order.`
                  : 'We’re looking for a rider near you. Our team will reply shortly if nobody is online.'}
            </p>
            <p className="mt-1 text-sm text-brand-gray">
              {chat.managed
                ? 'Keep this page open — your rider will appear here as soon as one is assigned.'
                : 'Keep this page open — the first rider to accept will appear here.'}
            </p>
          </>
        ) : isClosed ? (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
            <h1 className="mt-3 text-2xl font-bold text-ink">Order complete</h1>
            <p className="mt-1 text-brand-gray">Thank you for ordering with Mangwaoo!</p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-success">
              <Bike className="h-10 w-10" />
            </div>
            <h1 className="mt-3 text-2xl font-bold text-ink">{chat.riderName ?? 'Your rider'} is on the way</h1>
            {chat.riderRating !== undefined ? (
              <div className="mt-1 flex justify-center">
                <RiderRatingLabel rating={chat.riderRating} />
              </div>
            ) : null}
            <p className="mt-1 text-brand-gray">Your rider accepted the order. Chat below for updates.</p>
          </>
        )}
      </div>

      {/* After the delivery: rate the rider (once), or what was given. */}
      {isClosed && chat.riderName ? (
        chat.canRate ? (
          <div className="mb-6">
            <RiderRatingForm chatId={chat.id} riderName={chat.riderName} />
          </div>
        ) : chat.myStars ? (
          <p className="mb-6 flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-surface p-4 text-sm font-semibold text-ink shadow-soft">
            You rated {chat.riderName}
            <StarRating value={chat.myStars} className="h-5 w-5" />
          </p>
        ) : null
      ) : null}

      {/* Where each order of theirs that is still going can be followed live. */}
      {liveOrders.length > 0 ? (
        <section className="mb-6 space-y-2" aria-label="Track your order">
          {liveOrders.map((order) => (
            <Link
              key={order.ref}
              href={trackingPath(order.ref)}
              className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-soft transition hover:ring-2 hover:ring-brand-red-primary/30"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
                <Navigation className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">Track order {order.ref}</span>
                <span className="block truncate text-xs text-brand-gray">
                  {order.storeName} · {TRACK_STATUS_LABEL[order.status]}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-brand-gray" aria-hidden="true" />
            </Link>
          ))}
        </section>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-surface shadow-soft">
        <RouteSummary chat={chat} className="border-b border-gray-100 bg-gray-50 px-4 py-3" />
        <div className="h-[28rem]">
          <RiderChatThread
            key={chat.id}
            chatId={chat.id}
            currentRole="CUSTOMER"
            onChatUpdate={setChat}
            onMissing={() => setIsRemoved(true)}
            placeholder={chat.status === 'ACTIVE' ? 'Message your rider…' : 'Type a message…'}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        <Link href="/gulplaza" className="font-semibold text-accent hover:underline">
          Order more food
        </Link>
        <span className="text-gray-300">·</span>
        <Link href="/account" className="font-semibold text-accent hover:underline">
          My orders
        </Link>
      </div>
    </div>
  );
}
