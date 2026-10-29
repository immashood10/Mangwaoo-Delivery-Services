'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Flag, MapPin, Trash2 } from 'lucide-react';
import RiderChatThread from './RiderChatThread';
import RouteSummary from './RouteSummary';
import { CHAT_FILTERS, type ChatFilter } from '@/lib/admin-chat-filter';
import type { RiderChatStatus, RiderChatSummary } from '@/lib/rider-chat-types';

const POLL_INTERVAL_MS = 8000;

const STATUS_STYLES: Record<RiderChatStatus, { label: string; className: string }> = {
  OPEN: { label: 'Waiting for rider', className: 'bg-amber-50 text-warning' },
  ACTIVE: { label: 'With rider', className: 'bg-green-50 text-success' },
  CLOSED: { label: 'Closed', className: 'bg-gray-100 text-brand-gray' },
};

export default function AdminRiderChats({ initialFilter = 'all', todayStartIso }: { initialFilter?: ChatFilter; todayStartIso: string }) {
  const [chats, setChats] = useState<RiderChatSummary[]>([]);
  const [filter, setFilter] = useState<ChatFilter>(initialFilter);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      try {
        const response = await fetch('/api/admin/rider-chats');
        if (!response.ok) return;
        const data = await response.json();
        if (isMounted) setChats(data.chats ?? []);
      } catch {
        // Skip this poll.
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    poll();
    const intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const selectedChat = chats.find((chat) => chat.id === selectedId) ?? null;

  const visibleChats = chats.filter((chat) => {
    if (filter === 'waiting') return chat.status === 'OPEN';
    if (filter === 'with-rider') return chat.status === 'ACTIVE';
    if (filter === 'today') return chat.createdAt >= todayStartIso;

    return true;
  });

  const handleClose = async () => {
    if (!selectedId || isClosing) return;
    setIsClosing(true);

    try {
      const response = await fetch(`/api/rider-chats/${selectedId}/close`, { method: 'POST' });
      if (response.ok) {
        setChats((prev) => prev.map((chat) => (chat.id === selectedId ? { ...chat, status: 'CLOSED' } : chat)));
      }
    } finally {
      setIsClosing(false);
    }
  };

  // An order waiting for its area manager is handed to the riders instead (the first to reply takes it).
  const handleRelease = async () => {
    if (!selectedChat || isReleasing) return;

    setIsReleasing(true);
    setActionError('');

    try {
      const response = await fetch(`/api/admin/rider-chats/${selectedChat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release' }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setActionError(data?.error ?? 'Could not hand this order to the riders. Please try again.');
        return;
      }

      setChats((prev) => prev.map((chat) => (chat.id === selectedChat.id ? { ...chat, managed: false, areaName: null } : chat)));
    } catch {
      setActionError('Could not reach the server. Please try again.');
    } finally {
      setIsReleasing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedChat || isDeleting) return;

    const confirmed = window.confirm(
      `Delete the order chat with ${selectedChat.customerName}? All of its messages will be permanently removed. This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setActionError('');

    try {
      const response = await fetch(`/api/admin/rider-chats/${selectedChat.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setActionError(data?.error ?? 'Could not delete this chat. Please try again.');
        return;
      }

      setChats((prev) => prev.filter((chat) => chat.id !== selectedChat.id));
      setSelectedId(null);
    } catch {
      setActionError('Could not reach the server. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
      <div className={`space-y-2 ${selectedId ? 'hidden lg:block' : ''}`}>
        <div className="flex flex-wrap gap-1.5 pb-1" role="group" aria-label="Filter chats">
          {CHAT_FILTERS.map((candidate) => (
            <button
              key={candidate.key}
              type="button"
              aria-pressed={candidate.key === filter}
              onClick={() => setFilter(candidate.key)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                candidate.key === filter ? 'border-accent bg-red-50 text-accent' : 'border-gray-200 text-brand-gray hover:border-accent hover:text-accent'
              }`}
            >
              {candidate.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-brand-gray">Loading chats…</p>
        ) : visibleChats.length === 0 ? (
          <p className="rounded-xl bg-surface p-4 text-sm text-brand-gray shadow-soft">
            {chats.length === 0 ? 'No order chats yet.' : 'No chats match this filter.'}
          </p>
        ) : (
          visibleChats.map((chat) => {
            const status = STATUS_STYLES[chat.status];
            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => {
                  setSelectedId(chat.id);
                  setActionError('');
                }}
                className={`w-full rounded-xl border bg-surface p-3 text-left transition ${
                  chat.id === selectedId ? 'border-accent' : 'border-gray-200 hover:border-accent/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{chat.customerName}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                {chat.riderName ? <p className="text-xs text-brand-gray">Rider: {chat.riderName}</p> : null}
                {chat.managed ? <p className="text-xs text-brand-gray">Area manager: {chat.areaName}</p> : null}
                {chat.lastMessage ? <p className="mt-1 line-clamp-2 text-xs text-ink">{chat.lastMessage}</p> : null}
                {chat.pickupText ? (
                  <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-brand-gray">
                    <MapPin className="h-3 w-3 shrink-0 text-success" />
                    <span className="truncate">Pickup: {chat.pickupText}</span>
                  </p>
                ) : null}
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-brand-gray">
                  <Flag className="h-3 w-3 shrink-0 text-accent" />
                  <span className="truncate">{chat.pickupText ? 'Drop-off: ' : ''}{chat.addressText}</span>
                </p>
              </button>
            );
          })
        )}
      </div>

      <div
        className={`h-[36rem] flex-col overflow-hidden rounded-2xl bg-surface shadow-soft ${
          selectedId ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {selectedId && selectedChat ? (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
              <div className="flex min-w-0 items-start gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-full p-1 text-ink hover:bg-gray-100 lg:hidden"
                  aria-label="Back to list"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">
                    {selectedChat.customerName}
                    {selectedChat.riderName ? ` ↔ ${selectedChat.riderName}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selectedChat.status === 'OPEN' && selectedChat.managed && (
                  <button
                    type="button"
                    onClick={handleRelease}
                    disabled={isReleasing}
                    title={`Waiting for the ${selectedChat.areaName ?? 'area'} manager to pick a rider. Hand it to the riders instead: the first to reply takes it.`}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-60"
                  >
                    {isReleasing ? 'Sending…' : 'Send to riders'}
                  </button>
                )}
                {selectedChat.status !== 'CLOSED' && (
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isClosing}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-red-300 hover:text-danger disabled:opacity-60"
                  >
                    Close chat
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-red-50 disabled:opacity-60"
                  aria-label={`Delete chat with ${selectedChat.customerName}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
            {actionError ? <p className="bg-red-50 px-4 py-2 text-xs text-danger">{actionError}</p> : null}
            <RouteSummary
              chat={selectedChat}
              className="max-h-40 shrink-0 overflow-y-auto border-b border-gray-100 bg-gray-50 px-4 py-2.5"
            />
            <RiderChatThread
              key={selectedId}
              chatId={selectedId}
              currentRole="ADMIN"
              placeholder="Reply as Mangwaoo Support…"
              onMissing={() => {
                setChats((prev) => prev.filter((chat) => chat.id !== selectedId));
                setSelectedId(null);
              }}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-brand-gray">
            Select a chat to read and reply as Mangwaoo Support.
          </div>
        )}
      </div>
    </div>
  );
}
