'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Headset, Send } from 'lucide-react';
import { MAX_SUPPORT_MESSAGE_LENGTH, SUPPORT_NAME, type SupportMessageView } from '@/lib/support-types';

const POLL_INTERVAL_MS = 5000;

/**
 * A seller's or rider's chat with Mangwaoo Support. It only appears once the admin has written to them, and it
 * keeps itself up to date (opening it marks the admin's messages as read).
 */
export default function SupportChat() {
  const [hasThread, setHasThread] = useState(false);
  const [messages, setMessages] = useState<SupportMessageView[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const lastCreatedAt = useRef<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      try {
        const since = lastCreatedAt.current;
        const response = await fetch(`/api/support${since ? `?since=${encodeURIComponent(since)}` : ''}`, { cache: 'no-store' });
        if (!response.ok || !isMounted) return;
        const data = (await response.json()) as { thread: { id: string } | null; messages: SupportMessageView[] };
        if (!isMounted) return;

        setHasThread(Boolean(data.thread));

        if (data.messages.length > 0) {
          lastCreatedAt.current = data.messages[data.messages.length - 1].createdAt;
          setMessages((previous) => {
            const known = new Set(previous.map((message) => message.id));
            return [...previous, ...data.messages.filter((message) => !known.has(message.id))];
          });
        }
      } catch {
        // Skip a failed poll; the next one retries.
      }
    };

    void poll();
    const intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  if (!hasThread) return null;

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setError('');

    try {
      const response = await fetch('/api/support', {
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
    } catch {
      setError('Could not reach the server.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-surface shadow-soft" aria-label={SUPPORT_NAME}>
      <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-3">
        <Headset className="h-5 w-5 text-warning" />
        <h2 className="text-base font-bold text-ink">{SUPPORT_NAME}</h2>
        <span className="text-xs text-brand-gray">Messages from the Mangwaoo team</span>
      </div>

      <div className="max-h-72 min-h-32 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.fromAdmin ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                message.fromAdmin ? 'border border-amber-200 bg-amber-50 text-ink' : 'bg-brand-red-primary text-white'
              }`}
            >
              {message.fromAdmin ? <p className="mb-0.5 text-[11px] font-semibold text-warning">{SUPPORT_NAME}</p> : null}
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              <p className={`mt-1 text-[10px] ${message.fromAdmin ? 'text-brand-gray' : 'text-white/70'}`}>
                {new Date(message.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="px-4 pb-1 text-xs text-danger">{error}</p> : null}

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-gray-100 p-3">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Reply to Mangwaoo Support…"
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
    </section>
  );
}
