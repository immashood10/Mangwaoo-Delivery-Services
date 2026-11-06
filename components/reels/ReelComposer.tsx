'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, Upload, Square } from 'lucide-react';
import { MAX_REEL_BYTES, MAX_REEL_SECONDS } from '@/lib/reel-config';
import { REEL_COPY } from '@/lib/reel-types';
export default function ReelComposer({ onPosted }: { onPosted: () => void }) {
  const [caption, setCaption] = useState(''); const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [recording, setRecording] = useState(false); const [seconds, setSeconds] = useState(0);
  const [query, setQuery] = useState(''); const [dishes, setDishes] = useState<{id:string;name:string;vendor:string}[]>([]); const [productId, setProductId] = useState('');
  const recorder = useRef<MediaRecorder | null>(null); const stream = useRef<MediaStream | null>(null); const timer = useRef<ReturnType<typeof setInterval> | null>(null); const camera = useRef<HTMLVideoElement>(null);
  const mounted = useRef(true);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (recorder.current) { recorder.current.onstop = null; recorder.current.ondataavailable = null; if (recorder.current.state === 'recording') recorder.current.stop(); } stream.current?.getTracks().forEach(t => t.stop()); if (timer.current) clearInterval(timer.current); }; }, []);
  useEffect(() => { const abort = new AbortController(); const timeout = setTimeout(() => { void fetch('/api/reels/dishes?q=' + encodeURIComponent(query), { signal: abort.signal }).then(r => r.json()).then(data => setDishes(data.dishes || [])).catch(() => {}); }, 300); return () => { clearTimeout(timeout); abort.abort(); }; }, [query]);
  async function requestNativeMediaPermission() {
    if (!navigator.userAgent.includes('MangwaooApp/')) return;
    const bridge = (window as Window & { ReactNativeWebView?: { postMessage: (message: string) => void } }).ReactNativeWebView;
    if (!bridge) return;
    const granted = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (allowed: boolean) => { if (settled) return; settled = true; window.removeEventListener('mangwaoo:media-permission', receive as EventListener); window.clearTimeout(timeout); resolve(allowed); };
      const receive = (event: CustomEvent<{ granted?: boolean }>) => finish(event.detail?.granted === true);
      const timeout = window.setTimeout(() => finish(false), 60_000);
      window.addEventListener('mangwaoo:media-permission', receive as EventListener, { once: true });
      bridge.postMessage(JSON.stringify({ type: 'mangwaoo:request-media-permission' }));
    });
    if (!granted) throw new Error('Camera and microphone permission is required. Allow both in Mangwaoo app settings, then try again.');
  }
  async function choose(next: File) {
    setError('');
    if (next.size > MAX_REEL_BYTES) { setError('This video is larger than 4 MB. Use Record here for a smaller food clip.'); return; }
    const url = URL.createObjectURL(next); const video = document.createElement('video'); video.preload = 'metadata';
    try { const duration = await new Promise<number>((resolve, reject) => { video.onloadedmetadata = () => video.videoWidth > 0 ? resolve(video.duration) : reject(new Error('Choose a video with a picture.')); video.onerror = () => reject(new Error('This video cannot be played. Use MP4 or WebM.')); video.src = url; }); if (Number.isFinite(duration) && duration > MAX_REEL_SECONDS + 1) throw new Error('Keep your reel to 1 minute or less.'); setFile(next); setPreview(URL.createObjectURL(next)); } catch(e) { setError((e as Error).message); } finally { URL.revokeObjectURL(url); video.removeAttribute('src'); video.load(); }
  }
  async function record() {
    setError(''); setBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Recording is unavailable here. Choose a video from your phone instead.');
      await requestNativeMediaPermission();
      const input = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 1280 } }, audio: true }); stream.current = input;
      if (!mounted.current) { input.getTracks().forEach(t => t.stop()); return; }
      const mimeType = ['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      // Keep a full minute below the server's 4 MB upload ceiling, including container overhead.
      const next = new MediaRecorder(input, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 400_000, audioBitsPerSecond: 48_000 }); recorder.current = next;
      const chunks: Blob[] = []; next.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      next.onstop = () => { input.getTracks().forEach(t => t.stop()); if (timer.current) clearInterval(timer.current); setRecording(false); const blob = new Blob(chunks, { type: next.mimeType || 'video/webm' }); void choose(new File([blob], 'food-reel.' + (blob.type.includes('mp4') ? 'mp4' : 'webm'), { type: blob.type })); };
      next.start(500); setRecording(true); setSeconds(0);
      timer.current = setInterval(() => setSeconds(value => { if (value + 1 >= MAX_REEL_SECONDS && next.state === 'recording') next.stop(); return value + 1; }), 1000);
      setTimeout(() => { if (camera.current) { camera.current.srcObject = input; void camera.current.play().catch(() => {}); } }, 0);
    } catch(e) { stream.current?.getTracks().forEach(t => t.stop()); if (mounted.current) setError((e as Error).message || 'Camera permission was not granted.'); } finally { if (mounted.current) setBusy(false); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!file || !caption.trim()) return; setBusy(true); setError('');
    const form = new FormData(); form.set('video', file); form.set('caption', caption.trim()); if (productId) form.set('productId', productId);
    try { const response = await fetch('/api/reels', { method: 'POST', body: form }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to submit reel.'); onPosted(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5"><p className="text-sm text-brand-gray">{REEL_COPY.maxVideo}. Reels stay private until an admin approves them.</p>
    {recording ? <div><video ref={camera} autoPlay playsInline muted className="max-h-72 w-full rounded-2xl bg-black"/><p className="mt-2 text-center text-sm text-danger">Recording · {seconds}s / {MAX_REEL_SECONDS}s</p></div> : preview ? <video src={preview} controls playsInline className="max-h-72 w-full rounded-2xl bg-black"/> : <div className="rounded-2xl border border-dashed border-accent/30 bg-brand-light p-10 text-center text-brand-gray">Show us what is cooking.</div>}
    <div className="flex gap-3"><label className={'inline-flex cursor-pointer items-center gap-2 rounded-xl border border-accent/20 px-4 py-3 text-sm text-accent ' + (recording ? 'pointer-events-none opacity-50' : '')}><Upload size={16}/>Choose video<input type="file" accept="video/mp4,video/webm" className="sr-only" disabled={recording || busy} onChange={e => { const selected = e.target.files?.[0]; if (selected) void choose(selected); }}/></label><button type="button" disabled={busy} onClick={() => recording ? recorder.current?.stop() : void record()} className="inline-flex items-center gap-2 rounded-xl bg-brand-red-primary px-4 py-3 text-sm text-white">{recording ? <Square size={16}/> : <Camera size={16}/>} {recording ? 'Stop' : 'Record here'}</button></div>
    <label className="block text-sm font-semibold text-ink">Caption<textarea required maxLength={500} rows={3} value={caption} onChange={e => setCaption(e.target.value)} placeholder="Tell us about this food…" className="mt-2 w-full rounded-xl border border-accent/20 bg-surface p-3 text-ink"/></label>
    <div><label className="block text-sm font-semibold text-ink">Link a dish (optional)<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a dish or restaurant" className="mt-2 w-full rounded-xl border border-accent/20 bg-surface p-3 font-normal text-ink"/></label><select aria-label="Dish for this reel" value={productId} onChange={e => setProductId(e.target.value)} className="mt-2 w-full rounded-xl border border-accent/20 bg-surface p-3 text-sm text-ink"><option value="">No product link · order through Chat</option>{dishes.map(dish => <option key={dish.id} value={dish.id}>{dish.name} · {dish.vendor}</option>)}</select></div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}<button disabled={busy || recording || !file || !caption.trim()} className="w-full rounded-xl bg-brand-red-primary p-4 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Uploading…' : 'Submit for admin approval'}</button>
  </form>;
}
