'use client';

import { useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/** router.refresh() inside a transition, so `isRefreshing` stays true until the fresh data has arrived. */
export function useServerRefresh() {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  return { isRefreshing, refresh };
}
