'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { SERVICE_AREAS } from '@/lib/data';
import { MAX_SUPPORT_MESSAGE_LENGTH } from '@/lib/support-types';

type Message = { id: string; body: string; fromManager: boolean; createdAt: string };
type Thread = { id: string; managerName: string; areaId: number | null; messages: Message[] };

export default function ManagerMessages() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/rider/manager-messages', { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (!active) return;
        if (response.ok) { setThreads(data.threads ?? []); setError(''); }
        else setError(data?.error ?? 'Could not load area manager messages.');
      } catch { if (active) setError('Could not reach the server.'); }
    };
    void load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const send = async (event: FormEvent, thread: Thread) => {
    event.preventDefault();
    const body = (drafts[thread.id] ?? '').trim();
    if (!body) return;
    try {
      const response = await fetch('/api/rider/manager-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId: thread.id, body }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? 'Could not send the message.'); return; }
      setThreads((current) => current.map((item) => item.id === thread.id ? { ...item, messages: [...item.messages, data.message] } : item));
      setDrafts((current) => ({ ...current, [thread.id]: '' })); setError('');
    } catch { setError('Could not reach the server.'); }
  };

  return <section className="mb-6 space-y-3" aria-label="Area manager messages">
    <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><MessageCircle className="h-5 w-5 text-accent" /> Area manager messages</h2>
    {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-sm text-danger">{error}</p> : null}
    {threads.length === 0 ? <p className="rounded-2xl bg-surface p-5 text-sm text-brand-gray shadow-soft">No messages from your area manager yet.</p> : threads.map((thread) => {
      const area = SERVICE_AREAS.find((item) => item.id === thread.areaId)?.name;
      return <article key={thread.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-surface shadow-soft">
        <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-bold text-ink">{thread.managerName}{area ? ` · ${area}` : ''}</h3>
        <div className="max-h-64 min-h-20 space-y-2 overflow-y-auto p-4">
          {thread.messages.map((message) => <div key={message.id} className={`flex ${message.fromManager ? 'justify-start' : 'justify-end'}`}><p className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${message.fromManager ? 'bg-amber-50 text-ink' : 'bg-brand-red-primary text-white'}`}>{message.body}<span className={`mt-1 block text-[10px] ${message.fromManager ? 'text-brand-gray' : 'text-white/70'}`}>{new Date(message.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></p></div>)}
        </div>
        <form onSubmit={(event) => void send(event, thread)} className="flex gap-2 border-t border-gray-100 p-3">
          <input value={drafts[thread.id] ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [thread.id]: event.target.value }))} maxLength={MAX_SUPPORT_MESSAGE_LENGTH} placeholder="Reply to your area manager…" className="min-w-0 flex-1 rounded-full border border-gray-300 bg-transparent px-4 py-2 text-sm text-ink outline-none focus:border-accent" />
          <button type="submit" disabled={!(drafts[thread.id] ?? '').trim()} aria-label="Send message" className="rounded-full bg-brand-red-primary p-2 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
        </form>
      </article>;
    })}
  </section>;
}
