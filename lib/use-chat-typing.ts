'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type TypingPerson = { userId: string; senderRole: string; senderName: string };

/** DB-backed, expiring typing presence; no browser storage. */
export function useChatTyping(endpoint: string) {
  const [typingPeople, setTypingPeople] = useState<TypingPerson[]>([]);
  const lastSent = useRef(0);
  const stopTimer = useRef<number | undefined>(undefined);
  const heartbeat = useRef<number | undefined>(undefined);
  const send = useCallback((typing: boolean) => {
    void fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ typing }) }).catch(() => {});
  }, [endpoint]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current > 1800) { lastSent.current = now; send(true); }
    window.clearTimeout(stopTimer.current);
    if (heartbeat.current === undefined) heartbeat.current = window.setInterval(() => send(true), 2500);
    stopTimer.current = window.setTimeout(() => {
      window.clearInterval(heartbeat.current);
      heartbeat.current = undefined;
      send(false);
    }, 5000);
  }, [send]);

  const stopTyping = useCallback(() => {
    window.clearTimeout(stopTimer.current);
    window.clearInterval(heartbeat.current);
    heartbeat.current = undefined;
    send(false);
  }, [send]);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const response = await fetch(endpoint, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (mounted) setTypingPeople(data.typing ?? []);
      } catch { /* retry on the next tick */ }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 2200);
    return () => { mounted = false; window.clearInterval(interval); window.clearTimeout(stopTimer.current); window.clearInterval(heartbeat.current); send(false); };
  }, [endpoint, send]);

  return { typingPeople, notifyTyping, stopTyping };
}
