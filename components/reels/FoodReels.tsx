'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Share2, ShoppingBag, Plus, X, Volume2, VolumeX, Check, Trash2, Video } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useDeliveryAddress } from '@/lib/delivery-address-context';
import { REEL_COPY, type FoodReel } from '@/lib/reel-types';
import ReelComposer from './ReelComposer';

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, init); const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Please try again.'), { listing: data.listing });
  return data;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} onCancel={onClose} onClose={onClose} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl border border-accent/15 bg-surface p-5 text-ink backdrop:bg-black/70"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-brand-light"><X size={20}/></button></div>{children}</dialog>;
}
function Clip({ reel, paused, children }: { reel: FoodReel; paused: boolean; children: ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null); const [muted, setMuted] = useState(true);
  useEffect(() => {
    const video = ref.current; if (!video) return;
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting && !paused) void video.play().catch(() => {}); else video.pause(); }, { threshold: 0.65 });
    observer.observe(video); if (paused) video.pause(); return () => { observer.disconnect(); video.pause(); };
  }, [paused]);
  return <article className="relative mx-auto h-[min(78dvh,760px)] w-full max-w-md snap-start overflow-hidden rounded-3xl bg-black shadow-xl"><video ref={ref} src={reel.videoUrl} className="h-full w-full object-contain" muted={muted} loop playsInline preload="metadata" onClick={() => { const v = ref.current; if (v?.paused) void v.play().catch(() => {}); else v?.pause(); }} aria-label={reel.caption}/><div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 to-transparent"/><button aria-label={muted ? 'Unmute reel' : 'Mute reel'} className="absolute left-4 top-4 rounded-full bg-black/50 p-3 text-white" onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={19}/> : <Volume2 size={19}/>}</button><div className="absolute bottom-5 left-5 right-24 text-white"><p className="mb-2 text-sm font-bold">@{reel.authorName}</p><p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6">{reel.caption}</p>{reel.product && <Link className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-white/20 bg-white/10 p-2 text-xs" href={'/gulplaza/' + reel.product.id}><ShoppingBag size={14}/><span className="truncate">{reel.product.name} · {reel.product.vendor}</span></Link>}</div>{children}</article>;
}
export default function FoodReels({ mode = 'feed', initialId }: { mode?: 'feed' | 'mine' | 'admin'; initialId?: string }) {
  const { user, openSignIn } = useAuth(); const { address, requestAddressPicker } = useDeliveryAddress();
  const [reels, setReels] = useState<FoodReel[]>([]); const [cursor, setCursor] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [upload, setUpload] = useState(false); const [commentsFor, setCommentsFor] = useState<FoodReel | null>(null); const [comments, setComments] = useState<{id:string; body:string; authorName:string}[]>([]); const [comment, setComment] = useState(''); const [status, setStatus] = useState('PENDING');
  const [shippingListing, setShippingListing] = useState('');
  const load = useCallback((next?: string) => {
    const path = mode === 'admin' ? '/api/admin/reels?status=' + status : '/api/reels?' + (mode === 'mine' ? 'mine=1&' : '') + (initialId ? 'id=' + encodeURIComponent(initialId) + '&' : '') + (next ? 'cursor=' + encodeURIComponent(next) : '');
    return request(path).then(data => { setError(''); setReels(previous => next ? [...previous, ...data.reels] : data.reels); setCursor(data.nextCursor || null); }).catch((e: unknown) => { setError(e instanceof Error ? e.message : 'Unable to load reels.'); }).finally(() => setLoading(false));
  }, [mode, status, initialId]);
  useEffect(() => { void load(); }, [load]);
  function requireLogin() { if (!user) { openSignIn(); return false; } return true; }
  async function like(reel: FoodReel) {
    if (!requireLogin()) return; setBusy(reel.id); setError('');
    try { const result = await request('/api/reels/' + reel.id + '/like', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ liked: !reel.liked }) }); setReels(rows => rows.map(r => r.id === reel.id ? { ...r, ...result } : r)); } catch(e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  async function showComments(reel: FoodReel) { setCommentsFor(reel); setComments([]); setComment(''); try { const data = await request('/api/reels/' + reel.id + '/comments'); setComments(data.comments); } catch(e) { setError((e as Error).message); } }
  async function sendComment() {
    if (!commentsFor || !comment.trim() || !requireLogin()) return; setBusy('comment');
    try { const result = await request('/api/reels/' + commentsFor.id + '/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: comment }) }); setComments(rows => [result.comment, ...rows]); setComment(''); setReels(rows => rows.map(r => r.id === commentsFor.id ? { ...r, comments: r.comments + 1 } : r)); } catch(e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  async function share(reel: FoodReel) {
    const url = window.location.origin + '/reels?reel=' + reel.id;
    try { if (navigator.share) await navigator.share({ title: 'Food on Mangwaoo', text: reel.caption, url }); else { await navigator.clipboard.writeText(url); setNotice('Reel link copied.'); } } catch(e) { if ((e as Error).name !== 'AbortError') setError('Could not share. Open this reel at ' + url); }
  }
  async function order(reel: FoodReel) {
    if (!requireLogin()) return;
    if (user?.role !== 'CUSTOMER') { setError('Please use a customer account to order.'); return; }
    if (!address) { requestAddressPicker(); setNotice('Choose your delivery address, then tap Order Now again.'); return; }
    setBusy(reel.id); setError(''); setShippingListing('');
    try { await request('/api/reels/' + reel.id + '/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat: address.lat, lng: address.lng, addressText: address.label }) }); window.dispatchEvent(new Event('mangwaoo:open-order-chat')); setNotice('Your order is with the area team. Continue in Chat.'); } catch(e) { setError((e as Error).message); const listing = (e as Error & { listing?: string }).listing; if (listing?.startsWith('/gulplaza/')) setShippingListing(listing); } finally { setBusy(''); }
  }
  async function moderate(reel: FoodReel, next: string) {
    const reason = next === 'DECLINED' ? window.prompt('Reason for declining this reel (optional):') : '';
    if (reason === null) return; setBusy(reel.id);
    try { await request('/api/admin/reels/' + reel.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next, reason }) }); await load(); } catch(e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  async function remove(reel: FoodReel) { if (!window.confirm('Delete this reel and its video, likes and comments?')) return; try { await request('/api/reels/' + reel.id, { method: 'DELETE' }); setReels(rows => rows.filter(r => r.id !== reel.id)); } catch(e) { setError((e as Error).message); } }
  return <section className="mx-auto max-w-6xl px-4 py-10"><div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-accent">Mangwaoo food reels</p><h1 className="text-3xl font-extrabold text-ink">{mode === 'admin' ? 'Review food reels' : mode === 'mine' ? 'My food reels' : REEL_COPY.title}</h1><p className="mt-2 text-sm text-brand-gray">{REEL_COPY.description}</p></div><div className="flex gap-3">{mode !== 'admin' && <><Link href={mode === 'mine' ? '/reels' : '/reels?mine=1'} className="rounded-full border border-accent/20 px-4 py-3 text-sm font-semibold text-accent">{mode === 'mine' ? 'Watch reels' : 'My reels'}</Link><button onClick={() => { if (requireLogin()) setUpload(true); }} className="inline-flex items-center gap-2 rounded-full bg-brand-red-primary px-4 py-3 text-sm font-semibold text-white"><Plus size={17}/>Create reel</button></>}</div></div>
    {mode === 'admin' && <div className="mb-5 flex gap-2">{['PENDING','APPROVED','DECLINED'].map(value => <button key={value} className={'rounded-full border px-4 py-2 text-sm ' + (status === value ? 'bg-brand-red-primary text-white' : 'border-accent/20 text-ink')} onClick={() => { setLoading(true); setStatus(value); }}>{value === 'PENDING' ? 'Awaiting review' : value === 'APPROVED' ? 'Published' : 'Declined'}</button>)}</div>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-brand-light p-3 text-sm text-danger">{error}</p>}{shippingListing && <Link href={shippingListing} className="mb-4 inline-block rounded-xl bg-brand-red-primary px-4 py-3 text-sm font-bold text-white">Continue with vendor delivery</Link>}{notice && <p role="status" className="mb-4 rounded-xl bg-brand-light p-3 text-sm text-success">{notice}</p>}
    {!reels.length && !loading && <div className="rounded-3xl border border-accent/10 bg-brand-light p-10 text-center"><Video className="mx-auto mb-4 text-accent" size={40}/><h2 className="text-xl font-bold text-ink">{REEL_COPY.empty}</h2><p className="mt-3 text-brand-gray">{REEL_COPY.emptyDetail}</p></div>}
    <div className={mode === 'feed' ? 'max-h-[min(82dvh,800px)] snap-y snap-mandatory space-y-5 overflow-y-auto rounded-3xl' : 'grid gap-6 md:grid-cols-2'}>{reels.map(reel => <div key={reel.id}><Clip reel={reel} paused={upload || !!commentsFor}>{reel.status === 'APPROVED' && mode !== 'admin' && <div className="absolute bottom-8 right-3 flex w-16 flex-col items-center gap-5 text-white"><button disabled={busy === reel.id} onClick={() => void like(reel)} aria-label={reel.liked ? 'Unlike reel' : 'Like reel'} className="flex flex-col items-center gap-1"><Heart size={28} fill={reel.liked ? 'currentColor' : 'none'} className={reel.liked ? 'text-rose-400' : ''}/><span className="text-xs">{reel.likes}</span></button><button onClick={() => void showComments(reel)} aria-label="Comments" className="flex flex-col items-center gap-1"><MessageCircle size={28}/><span className="text-xs">{reel.comments}</span></button><button onClick={() => void share(reel)} aria-label="Share reel" className="flex flex-col items-center gap-1"><Share2 size={27}/><span className="text-[10px]">Share</span></button><button disabled={busy === reel.id} onClick={() => void order(reel)} className="flex flex-col items-center gap-1 rounded-2xl bg-brand-red-primary p-2" aria-label="Order Now"><ShoppingBag size={25}/><span className="text-[10px] font-bold leading-4">Order<br/>Now</span></button></div>}{reel.status !== 'APPROVED' && <span className="absolute right-4 top-5 rounded-full bg-black/60 px-3 py-2 text-xs font-bold text-white">{reel.status === 'PENDING' ? 'Awaiting approval' : 'Declined'}</span>}</Clip>{mode !== 'feed' && <div className="mx-auto mt-3 flex max-w-md flex-wrap gap-2">{mode === 'admin' && reel.status === 'PENDING' && <button disabled={busy === reel.id} className="inline-flex items-center gap-2 rounded-xl bg-brand-red-primary px-4 py-2 text-sm text-white" onClick={() => void moderate(reel, 'APPROVED')}><Check size={16}/>Approve</button>}{mode === 'admin' && reel.status !== 'DECLINED' && <button disabled={busy === reel.id} className="rounded-xl border border-accent/30 px-4 py-2 text-sm text-danger" onClick={() => void moderate(reel, 'DECLINED')}>Decline</button>}{(reel.owned || mode === 'admin') && <button onClick={() => void remove(reel)} className="inline-flex items-center gap-2 rounded-xl border border-accent/20 px-4 py-2 text-sm text-danger"><Trash2 size={15}/>Delete</button>}{reel.declineReason && <p className="w-full text-sm text-danger">{reel.declineReason}</p>}</div>}</div>)}</div>
    {loading && <p role="status" className="py-6 text-center text-sm text-brand-gray">Loading reels…</p>}{cursor && !loading && <button onClick={() => { setLoading(true); void load(cursor); }} className="mx-auto mt-6 block rounded-full border border-accent/20 px-6 py-3 text-sm text-accent">More reels</button>}
    {upload && <Modal title={REEL_COPY.upload} onClose={() => setUpload(false)}><ReelComposer onPosted={() => { setUpload(false); setNotice(REEL_COPY.pending); if (mode === 'mine') void load(); }}/></Modal>}
    {commentsFor && <Modal title="Comments" onClose={() => setCommentsFor(null)}><div className="mb-4 max-h-72 space-y-4 overflow-y-auto">{comments.length ? comments.map(c => <div key={c.id}><p className="text-sm font-bold text-ink">{c.authorName}</p><p className="whitespace-pre-wrap text-sm text-brand-gray">{c.body}</p></div>) : <p className="text-sm text-brand-gray">Be the first to comment.</p>}</div><form onSubmit={e => { e.preventDefault(); void sendComment(); }} className="flex gap-2"><input aria-label="Your comment" value={comment} onChange={e => setComment(e.target.value)} maxLength={500} placeholder="Write a comment" className="min-w-0 flex-1 rounded-xl border border-accent/20 bg-surface p-3 text-ink"/><button disabled={busy === 'comment' || !comment.trim()} className="rounded-xl bg-brand-red-primary px-4 text-sm text-white">Post</button></form></Modal>}
  </section>;
}
