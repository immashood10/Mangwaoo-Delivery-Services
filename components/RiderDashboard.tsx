'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bike, Clock, MapPin, Power } from 'lucide-react';
import RiderChatThread from './RiderChatThread';
import SupportChat from './SupportChat';
import PushToggle from './PushToggle';
import type { RiderChatSummary } from '@/lib/rider-chat-types';

type RiderProfile = { name: string; isApproved: boolean; isAvailable: boolean; vehicleType: string | null };

function ChatCard({ chat, active, onClick, request = false }: { chat: RiderChatSummary; active: boolean; onClick: () => void; request?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full rounded-xl border p-3 text-left ${active ? 'border-accent bg-brand-light' : 'border-gray-200 bg-surface hover:border-accent'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-ink">{chat.customerName}</span>
        {request && chat.distanceKm !== undefined ? <span className="text-xs text-brand-gray">{chat.distanceKm.toFixed(1)} km</span> : null}
      </div>
      {chat.lastMessage ? <p className="mt-1 line-clamp-2 text-xs text-brand-gray">{chat.lastMessage}</p> : null}
      <p className="mt-1 flex items-center gap-1 truncate text-xs text-brand-gray"><MapPin className="h-3 w-3 shrink-0" />{chat.addressText}</p>
    </button>
  );
}

export default function RiderDashboard({ rider }: { rider: RiderProfile }) {
  const [isOnline, setIsOnline] = useState(rider.isAvailable);
  const [hasLocation, setHasLocation] = useState(false);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState<RiderChatSummary[]>([]);
  const [chats, setChats] = useState<RiderChatSummary[]>([]);
  const [selectedChat, setSelectedChat] = useState<RiderChatSummary | null>(null);
  const coords = useRef<{ lat: number; lng: number } | null>(null);

  const sendPresence = useCallback(async (available: boolean) => {
    try {
      await fetch('/api/rider/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: available, ...(coords.current ?? {}) }),
      });
    } catch {
      setError('Could not update your availability. Please try again.');
    }
  }, []);

  useEffect(() => {
    if (!isOnline || !rider.isApproved) return;
    if (!navigator.geolocation) {
      setError('Location is not supported in this browser.');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        coords.current = { lat: position.coords.latitude, lng: position.coords.longitude };
        setHasLocation(true);
        setError('');
        void sendPresence(true);
      },
      () => setError('Please allow location access so customers can be matched to you.'),
      { enableHighAccuracy: true, maximumAge: 15000 },
    );
    const timer = window.setInterval(() => void sendPresence(true), 20000);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(timer);
    };
  }, [isOnline, rider.isApproved, sendPresence]);

  useEffect(() => {
    if (!rider.isApproved) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch('/api/rider/chats');
        if (!response.ok) return;
        const data = await response.json();
        if (active) {
          setRequests(data.requests ?? []);
          setChats(data.chats ?? []);
        }
      } catch { /* retry on the next poll */ }
    };
    void poll();
    const timer = window.setInterval(poll, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [rider.isApproved]);

  if (!rider.isApproved) {
    return <div className="space-y-6"><SupportChat /><div className="rounded-2xl bg-surface p-8 text-center shadow-soft"><Clock className="mx-auto mb-3 h-10 w-10 text-warning" /><h2 className="text-xl font-bold text-ink">Your account is pending approval</h2><p className="mt-2 text-sm text-brand-gray">Our team will review your rider account shortly. Once approved, you can go online and receive nearby order requests.</p></div></div>;
  }

  const toggleOnline = async () => {
    const next = !isOnline;
    setIsOnline(next);
    if (!next) {
      coords.current = null;
      setHasLocation(false);
    }
    await sendPresence(next);
  };

  return (
    <div className="space-y-6">
      <SupportChat />
      <PushToggle className="rounded-2xl bg-surface p-4 shadow-soft" />
      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-brand-gray">Status{rider.vehicleType ? ` · ${rider.vehicleType}` : ''}</p>
          <p className={`mt-1 text-lg font-bold ${isOnline ? 'text-success' : 'text-brand-gray'}`}>{isOnline ? hasLocation ? 'Online · receiving requests' : 'Online · getting your location…' : 'Offline'}</p>
          {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
          {isOnline && !error ? <p className="mt-1 text-xs text-brand-gray">Keep this page open to receive order requests.</p> : null}
        </div>
        <button onClick={toggleOnline} className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ${isOnline ? 'border border-gray-300 text-ink' : 'bg-success text-white'}`}><Power className="h-4 w-4" />{isOnline ? 'Go offline' : 'Go online'}</button>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <aside className={`space-y-6 ${selectedChat ? 'hidden lg:block' : ''}`}>
          <section className="space-y-2"><h2 className="text-sm font-bold uppercase tracking-wide text-ink">New requests ({requests.length})</h2>{requests.length ? requests.map((chat) => <ChatCard key={chat.id} chat={chat} active={selectedChat?.id === chat.id} request onClick={() => setSelectedChat(chat)} />) : <p className="rounded-xl bg-surface p-4 text-sm text-brand-gray">No nearby requests right now.</p>}</section>
          <section className="space-y-2"><h2 className="text-sm font-bold uppercase tracking-wide text-ink">Your chats ({chats.length})</h2>{chats.length ? chats.map((chat) => <ChatCard key={chat.id} chat={chat} active={selectedChat?.id === chat.id} onClick={() => setSelectedChat(chat)} />) : <p className="rounded-xl bg-surface p-4 text-sm text-brand-gray">Accepted orders will appear here.</p>}</section>
        </aside>
        <section className={`${selectedChat ? '' : 'hidden lg:block'} min-h-[28rem] rounded-2xl bg-surface p-4 shadow-soft`}>
          {selectedChat ? <><button onClick={() => setSelectedChat(null)} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-accent lg:hidden"><ArrowLeft className="h-4 w-4" />Back to requests</button><RiderChatThread key={selectedChat.id} chatId={selectedChat.id} currentRole="RIDER" placeholder="Message the customer…" /></> : <div className="flex h-full min-h-[24rem] flex-col items-center justify-center text-center text-brand-gray"><Bike className="mb-3 h-10 w-10" /><p>Select a request or chat to view the order details.</p></div>}
        </section>
      </div>
    </div>
  );
}
