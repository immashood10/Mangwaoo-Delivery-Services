'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Bike, Headset, Search, Send, Store, Users } from 'lucide-react';
import ChatThread from '@/components/ChatThread';
import {
  MAX_SUPPORT_MESSAGE_LENGTH,
  SUPPORT_NAME,
  type AdminConversationSummary,
  type SupportMessageView,
  type SupportPerson,
  type SupportThreadSummary,
} from '@/lib/support-types';

type Tab = 'support' | 'chats';

const LIST_POLL_MS = 8000;
const THREAD_POLL_MS = 4000;

const INPUT_CLASS =
  'w-full rounded-xl border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-red-100';

function timeLabel(iso: string) {
  return new Date(iso).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function RoleChip({ role }: { role: 'SELLER' | 'RIDER' }) {
  const Icon = role === 'RIDER' ? Bike : Store;

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand-gray">
      <Icon className="h-3 w-3" />
      {role === 'RIDER' ? 'Rider' : 'Seller'}
    </span>
  );
}

/** The admin's side of one seller/rider thread: their messages, and a box to write back. */
function SupportThreadView({ thread, onBack, onActivity }: { thread: SupportThreadSummary; onBack: () => void; onActivity: () => void }) {
  const [messages, setMessages] = useState<SupportMessageView[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const lastCreatedAt = useRef<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);
  const threadId = thread.id;

  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      try {
        const since = lastCreatedAt.current;
        const response = await fetch(`/api/admin/support/${threadId}/messages${since ? `?since=${encodeURIComponent(since)}` : ''}`, { cache: 'no-store' });
        if (!response.ok || !isMounted) return;
        const data = (await response.json()) as { messages: SupportMessageView[] };
        if (!isMounted) return;

        if (data.messages.length > 0) {
          lastCreatedAt.current = data.messages[data.messages.length - 1].createdAt;
          setMessages((previous) => {
            const known = new Set(previous.map((message) => message.id));
            return [...previous, ...data.messages.filter((message) => !known.has(message.id))];
          });
          onActivity();
        }
      } catch {
        // Skip a failed poll; the next one retries.
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void poll();
    const intervalId = window.setInterval(poll, THREAD_POLL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [threadId, onActivity]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/support/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Could not send your message.');
        return;
      }

      const sent = data.message as SupportMessageView;
      lastCreatedAt.current = sent.createdAt;
      setMessages((previous) => (previous.some((message) => message.id === sent.id) ? previous : [...previous, sent]));
      setDraft('');
      onActivity();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setIsSending(false);
    }
  };

  const who = thread.businessName ? `${thread.businessName} (${thread.name})` : thread.name;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-gray-100 p-4">
        <button type="button" onClick={onBack} className="rounded-full p-1 text-ink hover:bg-gray-100 lg:hidden" aria-label="Back to list">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="min-w-0 flex-1 truncate font-bold text-ink">{who}</p>
        <RoleChip role={thread.role} />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-center text-sm text-brand-gray">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-brand-gray">No messages yet. Write the first one below.</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.fromAdmin ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${message.fromAdmin ? 'bg-brand-red-primary text-white' : 'bg-gray-100 text-ink'}`}>
                {!message.fromAdmin ? <p className="mb-0.5 text-[11px] font-semibold text-accent">{thread.businessName ?? thread.name}</p> : null}
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                <p className={`mt-1 text-[10px] ${message.fromAdmin ? 'text-white/70' : 'text-brand-gray'}`}>{timeLabel(message.createdAt)}</p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="px-4 text-xs text-danger">{error}</p> : null}

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-gray-100 p-3">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Message ${thread.name} as ${SUPPORT_NAME}…`}
          maxLength={MAX_SUPPORT_MESSAGE_LENGTH}
          className="min-w-0 flex-1 rounded-full border border-gray-300 bg-transparent px-4 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
        />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red-primary text-white transition-colors hover:bg-brand-red-secondary disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </>
  );
}

/** Messages with sellers and riders: the threads so far, a search to start a new one, and the open thread. */
function SupportTab({ initialUserId }: { initialUserId?: string }) {
  const [threads, setThreads] = useState<SupportThreadSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState<SupportPerson[]>([]);
  const [notice, setNotice] = useState('');
  const openedInitial = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/support', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { threads: SupportThreadSummary[] };
      setThreads(data.threads);
    } catch {
      // Skip this poll.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const firstId = window.setTimeout(refresh, 0);
    const intervalId = window.setInterval(refresh, LIST_POLL_MS);
    return () => {
      window.clearTimeout(firstId);
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  const openPerson = async (userId: string) => {
    setNotice('');

    try {
      const response = await fetch('/api/admin/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setNotice(data?.error ?? 'Could not open this conversation.');
        return;
      }

      const thread = data.thread as SupportThreadSummary;
      setThreads((previous) => [thread, ...previous.filter((candidate) => candidate.id !== thread.id)]);
      setSelectedId(thread.id);
      setSearch('');
      setPeople([]);
    } catch {
      setNotice('Could not reach the server.');
    }
  };

  // "Message" on a seller/rider card in Admin > Users lands here with the person already chosen.
  useEffect(() => {
    if (!initialUserId || openedInitial.current) return;
    openedInitial.current = true;
    void openPerson(initialUserId);
  }, [initialUserId]);

  // Search sellers and riders to start a new conversation.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) return;

    let isCurrent = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/support/people?q=${encodeURIComponent(term)}`, { cache: 'no-store' });
        if (!response.ok || !isCurrent) return;
        const data = (await response.json()) as { people: SupportPerson[] };
        if (isCurrent) setPeople(data.people);
      } catch {
        // Typing again retries.
      }
    }, 300);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [search]);

  const selected = threads.find((thread) => thread.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
      <div className={`space-y-3 ${selected ? 'hidden lg:block' : ''}`}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a seller or rider to message…"
            aria-label="Find a seller or rider to message"
            className={`${INPUT_CLASS} pl-10`}
          />
        </div>

        {search.trim().length >= 2 ? (
          <ul className="overflow-hidden rounded-xl border border-gray-200 bg-surface" aria-label="Search results">
            {people.length === 0 ? (
              <li className="p-3 text-sm text-brand-gray">No seller or rider found.</li>
            ) : (
              people.map((person) => (
                <li key={person.userId} className="border-b border-gray-100 last:border-0">
                  <button type="button" onClick={() => openPerson(person.userId)} className="block w-full p-3 text-left hover:bg-brand-light">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{person.businessName ?? person.name}</span>
                      <RoleChip role={person.role} />
                    </span>
                    <span className="block truncate text-xs text-brand-gray">
                      {person.businessName ? `${person.name} · ` : ''}
                      {person.email}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}

        {notice ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-danger">{notice}</p> : null}

        {isLoading ? (
          <p className="text-sm text-brand-gray">Loading conversations…</p>
        ) : threads.length === 0 ? (
          <p className="rounded-xl bg-surface p-4 text-sm text-brand-gray shadow-soft">
            No conversations yet. Search for a seller or rider above, or press “Message” on their card in Users.
          </p>
        ) : (
          threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => setSelectedId(thread.id)}
              className={`w-full rounded-xl border bg-surface p-3 text-left transition ${thread.id === selectedId ? 'border-accent' : 'border-gray-200 hover:border-accent/50'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-ink">{thread.businessName ?? thread.name}</p>
                <span className="flex shrink-0 items-center gap-1.5">
                  {thread.unreadCount > 0 ? (
                    <span className="rounded-full bg-brand-red-primary px-2 py-0.5 text-[10px] font-bold text-white" aria-label={`${thread.unreadCount} unread`}>
                      {thread.unreadCount}
                    </span>
                  ) : null}
                  <RoleChip role={thread.role} />
                </span>
              </div>
              {thread.businessName ? <p className="truncate text-xs text-brand-gray">{thread.name}</p> : null}
              <p className="mt-1 line-clamp-2 text-xs text-ink">
                {thread.lastMessage ? `${thread.lastFromAdmin ? 'You: ' : ''}${thread.lastMessage}` : 'No messages yet'}
              </p>
            </button>
          ))
        )}
      </div>

      <div className={`h-[36rem] flex-col overflow-hidden rounded-2xl bg-surface shadow-soft ${selected ? 'flex' : 'hidden lg:flex'}`}>
        {selected ? (
          <SupportThreadView key={selected.id} thread={selected} onBack={() => setSelectedId(null)} onActivity={refresh} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-brand-gray">
            <Headset className="h-8 w-8" />
            Choose a conversation, or find a seller or rider to write to.
          </div>
        )}
      </div>
    </div>
  );
}

/** Every customer-seller chat; the admin can read it and write in it (both sides see "Mangwaoo Support"). */
function ChatsTab() {
  const [conversations, setConversations] = useState<AdminConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let isCurrent = true;

    const load = async () => {
      try {
        const term = search.trim();
        const response = await fetch(`/api/admin/conversations${term ? `?q=${encodeURIComponent(term)}` : ''}`, { cache: 'no-store' });
        if (!response.ok || !isCurrent) return;
        const data = (await response.json()) as { conversations: AdminConversationSummary[] };
        if (isCurrent) setConversations(data.conversations);
      } catch {
        // Skip this poll.
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    const timeoutId = window.setTimeout(load, search ? 300 : 0);
    const intervalId = window.setInterval(load, LIST_POLL_MS);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [search]);

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
      <div className={`space-y-3 ${selected ? 'hidden lg:block' : ''}`}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by customer, store or product…"
            aria-label="Search customer and seller chats"
            className={`${INPUT_CLASS} pl-10`}
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-brand-gray">Loading chats…</p>
        ) : conversations.length === 0 ? (
          <p className="rounded-xl bg-surface p-4 text-sm text-brand-gray shadow-soft">
            {search.trim() ? 'No chats match your search.' : 'No customer has written to a seller yet.'}
          </p>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => setSelectedId(conversation.id)}
              className={`w-full rounded-xl border bg-surface p-3 text-left transition ${conversation.id === selectedId ? 'border-accent' : 'border-gray-200 hover:border-accent/50'}`}
            >
              <p className="truncate text-sm font-semibold text-ink">
                {conversation.customerName} ↔ {conversation.sellerName}
              </p>
              {conversation.productName ? <p className="truncate text-xs text-accent">About: {conversation.productName}</p> : null}
              <p className="mt-1 line-clamp-2 text-xs text-ink">
                {conversation.lastSenderRole === 'ADMIN' ? 'You: ' : ''}
                {conversation.lastMessage}
              </p>
              <p className="mt-0.5 text-[11px] text-brand-gray">{timeLabel(conversation.updatedAt)}</p>
            </button>
          ))
        )}
      </div>

      <div className={`h-[36rem] flex-col overflow-hidden rounded-2xl bg-surface shadow-soft ${selected ? 'flex' : 'hidden lg:flex'}`}>
        {selected ? (
          <>
            <div className="flex items-center gap-2 border-b border-gray-100 p-4">
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-full p-1 text-ink hover:bg-gray-100 lg:hidden" aria-label="Back to list">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">
                  {selected.customerName} ↔ {selected.sellerName}
                </p>
                <p className="text-xs text-brand-gray">Anything you write here is shown to both of them as “{SUPPORT_NAME}”.</p>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <ChatThread
                key={selected.id}
                conversationId={selected.id}
                currentRole="ADMIN"
                names={{ CUSTOMER: selected.customerName, SELLER: selected.sellerName }}
                placeholder={`Write in this chat as ${SUPPORT_NAME}…`}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-brand-gray">
            <Users className="h-8 w-8" />
            Choose a chat to read it and step in.
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminMessages({ initialTab = 'support', initialUserId }: { initialTab?: Tab; initialUserId?: string }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'support', label: 'Sellers & riders' },
    { key: 'chats', label: 'Customer ↔ seller chats' },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Message type">
        {tabs.map((candidate) => (
          <button
            key={candidate.key}
            type="button"
            role="tab"
            aria-selected={candidate.key === tab}
            onClick={() => setTab(candidate.key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              candidate.key === tab ? 'border-accent bg-red-50 text-accent' : 'border-gray-200 text-brand-gray hover:border-accent hover:text-accent'
            }`}
          >
            {candidate.label}
          </button>
        ))}
      </div>

      {tab === 'support' ? <SupportTab initialUserId={initialUserId} /> : <ChatsTab />}
    </div>
  );
}
