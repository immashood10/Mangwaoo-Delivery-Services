import webpush from 'web-push';
import { getRestriction } from '@/lib/bans';
import { prisma } from '@/lib/prisma';

// Push notifications (Web Push, free): a message appears on the phone/computer even when the site is closed. The browser
// gives the site an address of its push service (Google, Mozilla, Apple, Microsoft); the server sends an encrypted message
// there, signed with the site's own VAPID key. No Firebase account or secret key is involved, and nothing is kept in the
// browser by this site's own code (the browser itself remembers the permission and the subscription).

const MAX_TITLE = 80;
const MAX_BODY = 140;
const MAX_SUBSCRIPTIONS_PER_USER = 10;
const TTL_SECONDS = 60 * 60;

/** Push services are run by the browser makers; anything else is refused, so a "subscription" can't point the server at an internal address. */
const PUSH_HOST_SUFFIXES = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];

export function isAllowedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);

    // Tests may point at a local stand-in for a push service; never in production.
    if (process.env.NODE_ENV !== 'production' && process.env.PUSH_ALLOW_ANY_ENDPOINT === '1') {
      return url.protocol === 'https:' || url.protocol === 'http:';
    }

    return (
      url.protocol === 'https:' &&
      endpoint.length <= 1000 &&
      PUSH_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`))
    );
  } catch {
    return false;
  }
}

export function pushConfigured() {
  return Boolean(process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

let vapidReady = false;

function prepare() {
  if (!pushConfigured()) return false;

  if (!vapidReady) {
    // The subject is a web address, not a person's email: push services see it.
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://mangwaoo.vercel.app', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    vapidReady = true;
  }

  return true;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** A same-site path only, so a notification can never open another website. */
function safeUrl(url: string | null | undefined) {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}

export type PushMessage = { title: string; body: string; url?: string | null; tag?: string };

/** Sends a push to every device of these accounts. Best effort: it never throws, and dead devices are forgotten. */
export async function sendPushToUsers(userIds: string[], message: PushMessage) {
  try {
    if (userIds.length === 0 || !prepare()) return;

    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });

    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: clip(message.title, MAX_TITLE),
      body: clip(message.body, MAX_BODY),
      url: safeUrl(message.url),
      ...(message.tag ? { tag: message.tag } : {}),
    });

    const gone: string[] = [];
    const sent: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        // A banned or deleted account gets nothing, even if its phone still has the subscription.
        if (await getRestriction(subscription.userId)) return;

        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
            { TTL: TTL_SECONDS, urgency: 'normal' }
          );
          sent.push(subscription.id);
        } catch (error) {
          const status = (error as { statusCode?: number } | null)?.statusCode;

          // 404 / 410: the push service says this device unsubscribed or the subscription expired.
          if (status === 404 || status === 410) gone.push(subscription.id);
        }
      })
    );

    if (gone.length > 0) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
    if (sent.length > 0) await prisma.pushSubscription.updateMany({ where: { id: { in: sent } }, data: { lastSentAt: new Date() } });
  } catch (error) {
    console.error('Could not send push notifications:', error);
  }
}

/** Remembers a device for an account (the same device moves to whoever subscribed last). */
export async function saveSubscription(userId: string, subscription: { endpoint: string; p256dh: string; auth: string }) {
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: { userId, ...subscription },
    update: { userId, p256dh: subscription.p256dh, auth: subscription.auth },
  });

  // Keep only the newest few devices per account.
  const all = await prisma.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true } });

  if (all.length > MAX_SUBSCRIPTIONS_PER_USER) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: all.slice(MAX_SUBSCRIPTIONS_PER_USER).map((row) => row.id) } } });
  }
}
