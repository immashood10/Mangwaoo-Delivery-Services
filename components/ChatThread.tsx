'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { SUPPORT_NAME } from '@/lib/support-types';

type Message = {
  id: string;
  senderRole: 'CUSTOMER' | 'SELLER' | 'ADMIN';
  body: string;
  createdAt: string;
};

const POLL_INTERVAL_MS = 4000;

export default function ChatThread({
  conversationId,
  currentRole,
  names,
  placeholder = 'Type a message…',
}: {
  conversationId: string;
  currentRole: 'CUSTOMER' | 'SELLER' | 'ADMIN';
  /** Who is who, shown above each bubble (the admin watching a customer-seller chat needs it). */
  names?: { CUSTOMER: string; SELLER: string };
  placeholder?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const messagesRef = useRef<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    let isMounted = true;

    const fetchMessages = async (since?: string) => {
      try {
        const url = `/api/conversations/${conversationId}/messages${since ? `?since=${encodeURIComponent(since)}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();
        const incoming: Message[] = data.messages ?? [];
        if (!isMounted || incoming.length === 0) return;

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const merged = [...prev, ...incoming.filter((m) => !existingIds.has(m.id))];
          return merged;
        });
      } catch {
        // Silently skip a failed poll — it'll retry on the next interval.
      }
    };

    (async () => {
      await fetchMessages();
      if (isMounted) setIsLoading(false);
    })();

    const intervalId = window.setInterval(() => {
      const last = messagesRef.current[messagesRef.current.length - 1];
      fetchMessages(last?.createdAt);
    }, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setError('');

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? 'Could not send your message.');
        return;
      }

      setMessages((prev) => [...prev, data.message]);
      setDraft('');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-center text-sm text-brand-gray">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-brand-gray">{currentRole === 'ADMIN' ? 'No messages in this chat yet.' : 'No messages yet. Say hello!'}</p>
        ) : (
          messages.map((message) => {
            const isOwn = message.senderRole === currentRole;
            const isSupport = message.senderRole === 'ADMIN';
            const label = message.senderRole === 'ADMIN' ? SUPPORT_NAME : (names?.[message.senderRole] ?? null);
            return (
              <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    isOwn
                      ? 'bg-brand-red-primary text-white'
                      : isSupport
                        ? 'border border-amber-200 bg-amber-50 text-ink'
                        : 'bg-gray-100 text-ink'
                  }`}
                >
                  {label && !(isOwn && isSupport) ? (
                    <p className={`mb-0.5 text-[11px] font-semibold ${isOwn ? 'text-white/80' : isSupport ? 'text-warning' : 'text-accent'}`}>{label}</p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p className={`mt-1 text-[10px] ${isOwn ? 'text-white/70' : 'text-brand-gray'}`}>
                    {new Date(message.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="px-4 text-xs text-danger">{error}</p> : null}

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-gray-100 p-3">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          maxLength={2000}
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
        />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red-primary text-white hover:bg-brand-red-secondary transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
