'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneCall, PhoneOff } from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';

type CallRecord = {
  id: string;
  callerName: string;
  receiverName: string;
  status: 'RINGING' | 'ACTIVE' | 'DECLINED' | 'ENDED';
  recordingStatus: 'PENDING' | 'STARTING' | 'RECORDING' | 'PROCESSING' | 'READY' | 'FAILED';
  isCaller?: boolean;
};

export default function InAppCall({ kind, targetId }: { kind: 'CONVERSATION' | 'RIDER_CHAT'; targetId: string }) {
  const [call, setCall] = useState<CallRecord | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioHost = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const mounted = useRef(true);
  const callRef = useRef<CallRecord | null>(null);
  const callId = call?.id;
  const callStatus = call?.status;
  useEffect(() => { callRef.current = call; }, [call]);

  const refresh = useCallback(async () => {
    try {
      const activeCall = callRef.current;
      const url = activeCall ? `/api/calls/${activeCall.id}` : `/api/calls?kind=${kind}&targetId=${encodeURIComponent(targetId)}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) { const data = await response.json().catch(() => null); if (response.status >= 500 && mounted.current) setError(data?.error ?? 'Call service is unavailable.'); return; }
      const data = await response.json();
      const next = data.call as CallRecord | null;
      if (mounted.current) setCall(next && ['RINGING', 'ACTIVE'].includes(next.status) ? next : null);
    } catch { /* Skip a failed poll. */ }
  }, [kind, targetId]);

  useEffect(() => { mounted.current = true; void refresh(); const timer = window.setInterval(() => void refresh(), 2200); return () => { mounted.current = false; window.clearInterval(timer); }; }, [refresh, callId]);

  const act = async (action: 'accept' | 'decline' | 'end') => {
    if (!call) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/calls/${call.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, consent: action === 'accept' }) });
      const data = await response.json();
      if (!response.ok) { setError(data?.error ?? 'Could not update the call.'); return; }
      if (action === 'end' || action === 'decline') setCall(null);
      else await refresh();
    } catch { setError('Could not reach the call service.'); }
    finally { setBusy(false); }
  };

  const startCall = async () => {
    const agreed = window.confirm('This Mangwaoo audio call will be recorded. The super admin can listen to recordings for safety. The other person will also be told before joining. Continue?');
    if (!agreed) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/calls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, targetId, consent: true }) });
      const data = await response.json();
      if (!response.ok) { setError(data?.error ?? 'Could not start a call.'); return; }
      setCall(data.call);
    } catch { setError('Could not reach the call service.'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!callId || callStatus !== 'ACTIVE') return;
    let alive = true;
    const audioElementHost = audioHost.current;
    const room = new Room({ adaptiveStream: true, dynacast: false });
    roomRef.current = room;
    const attach = (track: import('livekit-client').RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio || !audioElementHost) return;
      const element = track.attach();
      element.autoplay = true;
      audioElementHost.appendChild(element);
    };
    room.on(RoomEvent.TrackSubscribed, (track) => attach(track));
    room.on(RoomEvent.ParticipantDisconnected, () => {
      if (!alive) return;
      setError('The other person left the call.');
      void fetch(`/api/calls/${callId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'end' }) });
      setCall(null);
    });
    void (async () => {
      try {
        const response = await fetch(`/api/calls/${callId}/token`, { method: 'POST' });
        const credentials = await response.json();
        if (!response.ok) throw new Error(credentials?.error ?? 'Could not join the call.');
        if (!alive) return;
        await room.connect(credentials.serverUrl, credentials.token);
      } catch (reason) { if (alive) setError(reason instanceof Error ? reason.message : 'Could not connect the call.'); }
    })();
    return () => {
      alive = false;
      room.removeAllListeners();
      room.disconnect();
      roomRef.current = null;
      audioElementHost?.replaceChildren();
    };
  }, [callId, callStatus]);

  useEffect(() => {
    if (callStatus !== 'ACTIVE' || call?.recordingStatus !== 'RECORDING' || !roomRef.current) return;
    void roomRef.current.localParticipant.setMicrophoneEnabled(true).catch(() => setError('Please allow microphone access to speak in the call.'));
  }, [call?.id, call?.recordingStatus, callStatus]);

  const toggleMute = async () => {
    const room = roomRef.current;
    if (!room) return;
    try { await room.localParticipant.setMicrophoneEnabled(muted); setMuted(!muted); }
    catch { setError('Could not change microphone settings.'); }
  };

  return <div className="border-t border-gray-100 px-3 py-2">
    {!call ? <button type="button" onClick={() => void startCall()} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-50"><Phone className="h-3.5 w-3.5" /> Call</button> : call.status === 'RINGING' && !call.isCaller ? (
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-light p-3 text-sm">
        <PhoneCall className="h-4 w-4 text-accent" />
        <span className="min-w-0 flex-1"><strong>{call.callerName}</strong> is calling. Calls are recorded and super admin can listen.</span>
        <button type="button" onClick={() => void act('accept')} disabled={busy} className="rounded-lg bg-brand-red-primary px-3 py-1.5 text-xs font-semibold text-white">Accept &amp; consent</button>
        <button type="button" onClick={() => void act('decline')} disabled={busy} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-ink">Decline</button>
      </div>
    ) : call.status === 'RINGING' ? (
      <div className="flex items-center gap-2 text-xs text-brand-gray"><PhoneCall className="h-4 w-4 animate-pulse text-accent" /> Calling {call.receiverName}… <button type="button" onClick={() => void act('end')} disabled={busy} className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-ink">Cancel</button></div>
    ) : (
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-light p-3">
        <span className="text-xs font-semibold text-ink">{call.recordingStatus === 'RECORDING' ? 'Recording call with' : 'Starting recording before call with'} {call.isCaller ? call.receiverName : call.callerName}</span>
        {call.recordingStatus === 'RECORDING' ? <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" aria-label="Recording" /> : null}
        <div ref={audioHost} className="hidden" />
        <button type="button" onClick={() => void toggleMute()} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} className="ml-auto rounded-full border border-gray-200 p-2 text-ink">{muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
        <button type="button" onClick={() => void act('end')} disabled={busy} aria-label="End call" className="rounded-full bg-danger p-2 text-white"><PhoneOff className="h-4 w-4" /></button>
      </div>
    )}
    {error ? <p role="alert" className="mt-1 text-xs text-danger">{error}</p> : null}
  </div>;
}
