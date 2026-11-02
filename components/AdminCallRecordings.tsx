'use client';

import { useEffect, useState } from 'react';
import { Headphones, Play } from 'lucide-react';

type CallItem = { id: string; kind: string; callerName: string; receiverName: string; status: string; recordingStatus: string; startedAt: string | null; endedAt: string | null; createdAt: string };

export default function AdminCallRecordings() {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let mounted = true;
    void fetch('/api/admin/call-recordings', { cache: 'no-store' }).then((response) => response.json()).then((data) => { if (mounted) { setCalls(data.calls ?? []); setNextCursor(data.nextCursor ?? null); } }).catch(() => { if (mounted) setError('Could not load call recordings.'); });
    return () => { mounted = false; };
  }, []);

  const play = async (id: string) => {
    setBusyId(id); setError('');
    try {
      const response = await fetch(`/api/admin/call-recordings/${id}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? 'Recording is not ready.'); return; }
      setUrls((current) => ({ ...current, [id]: data.url }));
      setCalls((current) => current.map((call) => call.id === id ? { ...call, recordingStatus: 'READY' } : call));
    } catch { setError('Could not open the recording.'); }
    finally { setBusyId(null); }
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true); setError('');
    try {
      const response = await fetch(`/api/admin/call-recordings?cursor=${encodeURIComponent(nextCursor)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) { setError(data?.error ?? 'Could not load older calls.'); return; }
      setCalls((current) => [...current, ...(data.calls ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch { setError('Could not load older calls.'); }
    finally { setLoadingMore(false); }
  };

  return <div className="space-y-4">
    <p className="rounded-xl bg-brand-light p-4 text-sm text-brand-gray">Calls are recorded only after both participants agree. Recordings are private and only the super admin can play them.</p>
    {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    {!calls.length ? <div className="rounded-2xl bg-surface p-8 text-center text-sm text-brand-gray">No calls have been recorded yet.</div> : calls.map((call) => <article key={call.id} className="rounded-2xl bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="font-semibold text-ink">{call.callerName} ↔ {call.receiverName}</p><p className="mt-1 text-xs text-brand-gray">{call.kind === 'CONVERSATION' ? 'Buyer · seller' : 'Customer · rider'} · {new Date(call.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}</p><p className="mt-1 text-xs text-brand-gray">{call.recordingStatus === 'READY' ? 'Recording ready' : call.recordingStatus === 'PROCESSING' ? 'Recording processing' : call.recordingStatus === 'FAILED' ? 'Recording failed' : call.status === 'DECLINED' ? 'Declined · no recording' : call.status === 'RINGING' ? 'Not answered · no recording' : 'Recording unavailable'}</p></div>
        {['READY', 'PROCESSING'].includes(call.recordingStatus) ? <button type="button" onClick={() => void play(call.id)} disabled={busyId === call.id} className="inline-flex items-center gap-2 rounded-xl bg-brand-red-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{call.recordingStatus === 'READY' ? <Play className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}{busyId === call.id ? 'Loading…' : 'Listen'}</button> : null}
      </div>
      {urls[call.id] ? <audio className="mt-4 w-full" controls src={urls[call.id]}>Your browser cannot play this recording.</audio> : null}
    </article>)}
    {nextCursor ? <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="w-full rounded-xl border border-gray-200 bg-surface px-4 py-3 text-sm font-semibold text-ink disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load older calls'}</button> : null}
  </div>;
}
