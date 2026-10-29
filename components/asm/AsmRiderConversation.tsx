'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { MAX_SUPPORT_MESSAGE_LENGTH } from '@/lib/support-types';

type Message = { id: string; body: string; fromManager: boolean; createdAt: string };

export default function AsmRiderConversation({ riderId, riderName }: { riderId: string; riderName: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/asm/rider-messages?riderId=${encodeURIComponent(riderId)}`, { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (!active) return;
        if (!response.ok) { setError(data?.error ?? 'Could not load messages.'); return; }
        setMessages(data.messages ?? []);
        setError('');
      } catch { if (active) setError('Could not reach the server.'); }
    };
    void load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [open, riderId]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true); setError('');
    try {
      const response = await fetch('/api/asm/rider-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ riderId, body: draft }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? 'Could not send the message.'); return; }
      setMessages((current) => [...current, data.message]); setDraft('');
    } catch { setError('Could not reach the server.'); }
    finally { setSending(false); }
  };

  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent">
        <MessageCircle className="h-3.5 w-3.5" /> {open ? 'Close chat' : `Message ${riderName}`}
      </button>
      {open ? <div className="mt-3 rounded-xl border border-gray-200 bg-brand-light p-3">
        <div className="max-h-52 min-h-16 space-y-2 overflow-y-auto">
          {messages.length === 0 ? <p className="text-xs text-brand-gray">Start a private conversation with {riderName}.</p> : null}
          {messages.map((message) => <div key={message.id} className={`flex ${message.fromManager ? 'justify-end' : 'justify-start'}`}>
            <p className={`max-w-[90%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-xs ${message.fromManager ? 'bg-brand-red-primary text-white' : 'border border-gray-200 bg-surface text-ink'}`}>
              {message.body}<span className={`mt-1 block text-[9px] ${message.fromManager ? 'text-white/70' : 'text-brand-gray'}`}>{new Date(message.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}</span>
            </p>
          </div>)}
        </div>
        {error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}
        <form onSubmit={send} className="mt-2 flex gap-2">
          <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={MAX_SUPPORT_MESSAGE_LENGTH} placeholder="Write a message…" className="min-w-0 flex-1 rounded-full border border-gray-300 bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent" />
          <button disabled={sending || !draft.trim()} aria-label="Send message" className="rounded-full bg-brand-red-primary p-2 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
        </form>
      </div> : null}
    </div>
  );
}
