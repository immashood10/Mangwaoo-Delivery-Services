'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Re-renders the current server component page every `intervalMs` so its numbers stay live. */
export default function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const intervalId = window.setInterval(() => router.refresh(), intervalMs);
    return () => window.clearInterval(intervalId);
  }, [router, intervalMs]);

  return null;
}
