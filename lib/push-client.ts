// Browser side of push notifications. The site's own code stores nothing: the browser itself remembers the permission
// and the subscription, and the server (database) remembers which accounts those belong to. A tiny service worker
// (public/push-sw.js) shows the notification; it caches nothing and intercepts no requests.

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on';

export function pushAvailable() {
  return typeof window !== 'undefined' && PUBLIC_KEY !== '' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function keyBytes(base64Url: string) {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), '=').replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);

  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration('/');

  return registration ? registration.pushManager.getSubscription() : null;
}

/** Whether this browser can get notifications, and whether it already does. */
export async function getPushState(): Promise<PushState> {
  if (!pushAvailable()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';

  try {
    return (await currentSubscription()) && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

async function tellServer(subscription: PushSubscription) {
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? 'Could not turn on notifications.');
  }
}

/** Asks for permission, subscribes this browser and tells the server. */
export async function enablePush(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!pushAvailable()) return { ok: false, error: 'This browser does not support notifications.' };

    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      return { ok: false, error: 'Notifications are blocked. Allow them in your browser settings (the lock icon next to the address).' };
    }

    const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));

    await tellServer(subscription);

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.message ? error.message : 'Could not turn on notifications.' };
  }
}

/** Makes sure the server knows this browser belongs to whoever is logged in now (a different person may have logged in here). */
export async function syncPush() {
  try {
    if (!pushAvailable() || Notification.permission !== 'granted') return;

    const subscription = await currentSubscription();

    if (subscription) await tellServer(subscription);
  } catch {
    // Not important: the next page load tries again.
  }
}

/** Turns notifications off for this browser: the server forgets it and the browser drops the subscription. */
export async function disablePush() {
  try {
    if (!pushAvailable()) return;

    const subscription = await currentSubscription();

    if (!subscription) return;

    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);

    await subscription.unsubscribe();
  } catch {
    // Nothing to undo.
  }
}
