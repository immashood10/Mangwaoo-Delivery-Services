'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bike, CheckCircle2, Clock, Flag, MapPin, UserCheck } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import RiderChatThread from '@/components/RiderChatThread';
import RouteSummary from '@/components/RouteSummary';
import { RiderRatingLabel } from '@/components/StarRating';
import type { AssignableRider, ManagerChatRow } from '@/lib/area-managers-config';
import { formatDistance } from '@/lib/geo';
import { enableNotificationSound, playNotificationSound } from '@/lib/notification-sound';
import { formatPkr } from '@/lib/rider-wallet-config';

const POLL_MS = 5000;
const RIDERS_POLL_MS = 8000;

type Filter = 'waiting' | 'with-rider' | 'finished' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'waiting', label: 'Waiting for a rider' },
  { key: 'with-rider', label: 'With a rider' },
  { key: 'finished', label: 'Finished' },
  { key: 'all', label: 'All' },
];

const STATUS_STYLES: Record<ManagerChatRow['status'], { label: string; className: string }> = {
  OPEN: { label: 'Waiting for a rider', className: 'bg-amber-50 text-warning' },
  ACTIVE: { label: 'With a rider', className: 'bg-green-50 text-success' },
  CLOSED: { label: 'Finished', className: 'bg-gray-100 text-brand-gray' },
};

function matches(chat: ManagerChatRow, filter: Filter) {
  if (filter === 'waiting') return chat.status === 'OPEN';
  if (filter === 'with-rider') return chat.status === 'ACTIVE';
  if (filter === 'finished') return chat.status === 'CLOSED';

  return true;
}

/** "just now", "6 min", "1 h 5 min": how long an order has been waiting. */
function waitingFor(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min`;

  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** The riders to pick from for one order, nearest first, and the buttons to give it to one of them (or to change the rider). */
function AssignPanel({
  chat,
  onAssigned,
}: {
  chat: ManagerChatRow;
  onAssigned: (chatId: string, rider: { id: string; name: string }) => void;
}) {
  const hasRider = chat.status === 'ACTIVE';
  // A waiting order shows the riders at once; one that has a rider shows them when the manager wants to change it.
  const [changing, setChanging] = useState(false);
  const picking = !hasRider || changing;
  const [riders, setRiders] = useState<AssignableRider[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AssignableRider | null>(null);

  useEffect(() => {
    if (!picking) return;

    let active = true;

    const load = async () => {
      try {
        const response = await fetch(`/api/asm/riders?chatId=${encodeURIComponent(chat.id)}`, { cache: 'no-store' });
        const data = await response.json().catch(() => null);

        if (!active) return;

        if (!response.ok) {
          setError(data?.error ?? 'Could not load the riders.');
          return;
        }

        setRiders(data.riders ?? []);
        setError('');
      } catch {
        if (active) setError('Could not reach the server.');
      } finally {
        if (active) setLoaded(true);
      }
    };

    void load();
    const timer = window.setInterval(load, RIDERS_POLL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [picking, chat.id]);

  /** Gives the order to `rider`. Answers with a problem to show, or null when it worked. */
  const assign = async (rider: AssignableRider): Promise<string | null> => {
    try {
      const response = await fetch(`/api/asm/chats/${chat.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderId: rider.id }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) return data?.error ?? 'Could not give the order to that rider. Please try again.';

      setChanging(false);
      onAssigned(chat.id, { id: rider.id, name: rider.name });

      return null;
    } catch {
      return 'Could not reach the server. Please try again.';
    }
  };

  const handlePick = async (rider: AssignableRider) => {
    // Moving an order that a rider already has is asked first; a waiting order goes straight to the rider.
    if (hasRider) {
      setConfirmTarget(rider);
      return;
    }

    setBusyId(rider.id);
    setError('');

    const problem = await assign(rider);

    setBusyId(null);
    if (problem) setError(problem);
  };

  if (chat.status === 'CLOSED') return null;

  return (
    <div className="border-b border-gray-100 bg-gray-50 px-4 py-3" data-testid="assign-panel">
      {hasRider && !picking ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <UserCheck className="h-4 w-4 text-success" aria-hidden="true" />
            With {chat.riderName ?? 'a rider'}
          </p>
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
          >
            Change rider
          </button>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink">{hasRider ? 'Give this order to another rider' : 'Pick a rider for this order'}</p>
            {hasRider ? (
              <button type="button" onClick={() => setChanging(false)} className="text-xs font-semibold text-accent hover:underline">
                Keep {chat.riderName ?? 'the rider'}
              </button>
            ) : null}
          </div>

          {error ? (
            <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          ) : null}

          {!loaded ? (
            <p className="text-xs text-brand-gray">Loading riders…</p>
          ) : riders.length === 0 ? (
            <p className="text-xs text-brand-gray">No approved riders yet.</p>
          ) : (
            <>
              {!riders.some((rider) => rider.canAssign) ? (
                <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-warning">No rider is online and able to take an order right now.</p>
              ) : null}
              <ul className="max-h-60 space-y-2 overflow-y-auto pr-1">
                {riders.map((rider) => (
                  <li
                    key={rider.id}
                    data-rider-id={rider.id}
                    className={`flex items-center gap-3 rounded-xl border bg-surface p-3 ${rider.canAssign ? 'border-gray-200' : 'border-gray-100 opacity-70'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-ink">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${rider.online ? 'bg-green-500' : 'bg-gray-300'}`} aria-hidden="true" />
                        <span className="truncate">{rider.name}</span>
                        {rider.vehicleType ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-brand-gray">{rider.vehicleType}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-brand-gray">
                        <span>{rider.online ? 'Online' : 'Offline'}</span>
                        {rider.distanceKm !== null ? <span>{formatDistance(rider.distanceKm)} from pickup</span> : null}
                        <span>{rider.activeOrders === 0 ? 'No order now' : `${rider.activeOrders} ${rider.activeOrders === 1 ? 'order' : 'orders'} now`}</span>
                        <RiderRatingLabel rating={rider.rating} className="!font-normal" />
                      </p>
                      {rider.hold ? (
                        <p className="mt-0.5 text-xs font-semibold text-danger">
                          {rider.reason}
                          {rider.hold === 'PAYMENT' ? ` (${rider.unpaidOrders} unpaid ${rider.unpaidOrders === 1 ? 'order' : 'orders'})` : ''}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={!rider.canAssign || busyId !== null}
                      onClick={() => void handlePick(rider)}
                      title={rider.canAssign ? undefined : (rider.reason ?? undefined)}
                      className="shrink-0 rounded-full bg-brand-red-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-red-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyId === rider.id ? 'Assigning…' : 'Assign'}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {confirmTarget ? (
        <ConfirmDialog
          title="Change the rider?"
          message={`Give this order to ${confirmTarget.name} instead of ${chat.riderName ?? 'the current rider'}?`}
          note="The first rider is told that the order was moved."
          confirmLabel="Change rider"
          onConfirm={async () => {
            const problem = await assign(confirmTarget);

            if (!problem) setConfirmTarget(null);

            return problem;
          }}
          onCancel={() => setConfirmTarget(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * The Area Sales Manager's screen: the order chats of their area (waiting ones first), the conversation with the customer, and
 * the riders to give an order to. Messages typed here reach the customer (and the rider, once there is one) as "<name> ·
 * Mangwaoo". Checkout orders are not here: the first rider to reply takes those.
 */
export default function AsmOrders() {
  const [chats, setChats] = useState<ManagerChatRow[]>([]);
  const [areaName, setAreaName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<Filter>('waiting');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const selectedIdRef = useRef<string | null>(null);
  // What the previous poll saw, to chime for what has just arrived (null until the first poll has answered).
  const knownWaitingIds = useRef<Set<string> | null>(null);
  const knownStamps = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    enableNotificationSound();
  }, []);

  const announceArrivals = useCallback((next: ManagerChatRow[]) => {
    const waiting = knownWaitingIds.current;
    const stamps = knownStamps.current;

    if (waiting && stamps) {
      const newOrder = next.some((chat) => chat.status === 'OPEN' && !waiting.has(chat.id));
      const newCustomerMessage = next.some((chat) => {
        const before = stamps.get(chat.id);

        return before !== undefined && before !== chat.updatedAt && chat.lastMessageFrom === 'CUSTOMER' && chat.status !== 'CLOSED';
      });

      if (newOrder || newCustomerMessage) playNotificationSound();
    }

    knownWaitingIds.current = new Set(next.filter((chat) => chat.status === 'OPEN').map((chat) => chat.id));
    knownStamps.current = new Map(next.map((chat) => [chat.id, chat.updatedAt]));
  }, []);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const response = await fetch('/api/asm/chats', { cache: 'no-store' });
        const data = await response.json().catch(() => null);

        if (!active) return;

        if (!response.ok) {
          setLoadError(data?.error ?? 'Could not load the orders.');
          return;
        }

        const next = (data.chats ?? []) as ManagerChatRow[];

        announceArrivals(next);
        setChats(next);
        setAreaName(data.area?.name ?? '');
        setLoadError('');

        // The order being looked at is gone (the customer cancelled it): say so instead of leaving an empty panel.
        const current = selectedIdRef.current;

        if (current && !next.some((chat) => chat.id === current)) {
          setSelectedId(null);
          setNotice('That order was cancelled.');
        }
      } catch {
        // The next poll tries again.
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void poll();
    const timer = window.setInterval(poll, POLL_MS);
    document.addEventListener('visibilitychange', poll);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [announceArrivals]);

  const counts = useMemo(
    () => ({
      waiting: chats.filter((chat) => chat.status === 'OPEN').length,
      'with-rider': chats.filter((chat) => chat.status === 'ACTIVE').length,
      finished: chats.filter((chat) => chat.status === 'CLOSED').length,
      all: chats.length,
    }),
    [chats]
  );

  const visibleChats = useMemo(() => {
    const list = chats.filter((chat) => matches(chat, filter));

    // The order that has waited longest comes first; the others by their latest activity.
    return list.sort((a, b) => {
      if (a.status === 'OPEN' && b.status === 'OPEN') return a.createdAt.localeCompare(b.createdAt);
      if (a.status === 'OPEN') return -1;
      if (b.status === 'OPEN') return 1;

      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [chats, filter]);

  const selectedChat = chats.find((chat) => chat.id === selectedId) ?? null;

  const handleAssigned = (chatId: string, rider: { id: string; name: string }) => {
    setChats((current) => current.map((chat) => (chat.id === chatId ? { ...chat, status: 'ACTIVE', riderId: rider.id, riderName: rider.name } : chat)));
    setNotice(`The order was given to ${rider.name}. They and the customer were told.`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Orders{areaName ? ` · ${areaName}` : ''}</h1>
        <p className="mt-1 text-sm text-brand-gray">
          Orders customers of your area send with the Chat button. Pick a rider for each one; the rider and the customer are told.
        </p>
      </div>

      {notice ? (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-xs font-semibold underline">
            OK
          </button>
        </p>
      ) : null}

      {loadError ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
          {loadError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <div className={`space-y-2 ${selectedId ? 'hidden lg:block' : ''}`}>
          <div className="flex flex-wrap gap-1.5 pb-1" role="group" aria-label="Filter orders">
            {FILTERS.map((candidate) => (
              <button
                key={candidate.key}
                type="button"
                aria-pressed={candidate.key === filter}
                onClick={() => setFilter(candidate.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  candidate.key === filter ? 'border-accent bg-red-50 text-accent' : 'border-gray-200 text-brand-gray hover:border-accent hover:text-accent'
                }`}
              >
                {candidate.label} ({counts[candidate.key]})
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className="text-sm text-brand-gray">Loading orders…</p>
          ) : visibleChats.length === 0 ? (
            <p className="rounded-xl bg-surface p-4 text-sm text-brand-gray shadow-soft">
              {chats.length === 0 ? 'No orders yet. When a customer of your area sends an order, it shows up here.' : 'No orders in this list.'}
            </p>
          ) : (
            visibleChats.map((chat) => {
              const status = STATUS_STYLES[chat.status];

              return (
                <button
                  key={chat.id}
                  type="button"
                  data-chat-id={chat.id}
                  onClick={() => {
                    setSelectedId(chat.id);
                    setNotice('');
                  }}
                  className={`w-full rounded-xl border bg-surface p-3 text-left transition ${
                    chat.id === selectedId ? 'border-accent' : 'border-gray-200 hover:border-accent/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{chat.customerName}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                  </div>
                  {chat.status === 'OPEN' ? (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-warning">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      Waiting {waitingFor(chat.createdAt)}
                    </p>
                  ) : null}
                  {chat.riderName ? (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-brand-gray">
                      <Bike className="h-3 w-3" aria-hidden="true" />
                      {chat.riderName}
                    </p>
                  ) : null}
                  {chat.lastMessage ? <p className="mt-1 line-clamp-2 text-xs text-ink">{chat.lastMessage}</p> : null}
                  {chat.pickupText ? (
                    <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-brand-gray">
                      <MapPin className="h-3 w-3 shrink-0 text-success" />
                      <span className="truncate">Pickup: {chat.pickupText}</span>
                    </p>
                  ) : null}
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-brand-gray">
                    <Flag className="h-3 w-3 shrink-0 text-accent" />
                    <span className="truncate">
                      {chat.pickupText ? 'Drop-off: ' : ''}
                      {chat.addressText}
                    </span>
                  </p>
                </button>
              );
            })
          )}
        </div>

        <div className={`min-h-[32rem] flex-col overflow-hidden rounded-2xl bg-surface shadow-soft ${selectedId ? 'flex' : 'hidden lg:flex'}`}>
          {selectedId && selectedChat ? (
            <>
              <div className="flex items-start gap-2 border-b border-gray-100 p-4">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-full p-1 text-ink hover:bg-gray-100 lg:hidden"
                  aria-label="Back to the list"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">
                    {selectedChat.customerName}
                    {selectedChat.riderName ? ` ↔ ${selectedChat.riderName}` : ''}
                  </p>
                  {selectedChat.deliveryCharge > 0 ? (
                    <p className="text-xs text-brand-gray">Delivery charge {formatPkr(selectedChat.deliveryCharge)}</p>
                  ) : null}
                </div>
              </div>
              <RouteSummary chat={selectedChat} className="max-h-40 shrink-0 overflow-y-auto border-b border-gray-100 px-4 py-2.5" />
              <AssignPanel key={selectedChat.id} chat={selectedChat} onAssigned={handleAssigned} />
              <div className="h-[24rem] min-h-0">
                <RiderChatThread
                  key={selectedChat.id}
                  chatId={selectedChat.id}
                  currentRole="ADMIN"
                  placeholder="Message the customer…"
                  onMissing={() => {
                    setSelectedId(null);
                    setNotice('That order was cancelled.');
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-brand-gray">
              Select an order to read it, talk to the customer and pick a rider.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
