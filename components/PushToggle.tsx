'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { disablePush, enablePush, getPushState, syncPush, type PushState } from '@/lib/push-client';

/**
 * "Get notifications on this phone/computer": a small row (bell menu, rider dashboard) that turns push notifications
 * on or off for this browser. It hides itself where the browser can't do push or the site has no push key.
 */
export default function PushToggle({ className = '' }: { className?: string }) {
  const [state, setState] = useState<PushState | 'loading'>('loading');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const current = await getPushState();

      if (current === 'on') await syncPush();
      if (isMounted) setState(current);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  if (state === 'loading' || state === 'unsupported') return null;

  const turnOn = async () => {
    setError('');
    setIsBusy(true);

    const result = await enablePush();

    setIsBusy(false);
    setState(await getPushState());
    if (!result.ok) setError(result.error);
  };

  const turnOff = async () => {
    setError('');
    setIsBusy(true);
    await disablePush();
    setIsBusy(false);
    setState(await getPushState());
  };

  return (
    <div className={className}>
      {state === 'on' ? (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-success">
            <BellRing className="h-3.5 w-3.5" />
            Notifications are on for this device
          </span>
          <button type="button" onClick={turnOff} disabled={isBusy} className="font-semibold text-brand-gray hover:text-danger disabled:opacity-60">
            Turn off
          </button>
        </div>
      ) : state === 'blocked' ? (
        <p className="flex items-start gap-1.5 text-xs text-brand-gray">
          <BellOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Notifications are blocked in your browser. Allow them in the site settings (lock icon next to the address) to get alerts.
        </p>
      ) : (
        <button
          type="button"
          onClick={turnOn}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline disabled:opacity-60"
        >
          <Bell className="h-3.5 w-3.5" />
          {isBusy ? 'Turning on…' : 'Get notifications on this device'}
        </button>
      )}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
