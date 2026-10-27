// Mangwaoo push notifications. This worker does exactly two things: show a notification when the server pushes one, and
// open the right page when it is tapped. It caches nothing, intercepts no requests and stores nothing.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = typeof data.title === 'string' && data.title ? data.title : 'Mangwaoo';
  const tag = typeof data.tag === 'string' && data.tag ? data.tag : undefined;
  const options = {
    body: typeof data.body === 'string' ? data.body : '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag,
    // With the site closed the phone or computer plays its own notification sound (a web page cannot choose it) and a
    // phone buzzes. A notification with the same tag normally replaces the old one quietly; `renotify` makes it sound again.
    silent: false,
    vibrate: [200, 100, 200],
    renotify: tag !== undefined,
    data: { url: typeof data.url === 'string' ? data.url : '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Only a page of this site can be opened.
  const target = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : '/', self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin + '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then((focused) => (focused && 'navigate' in focused ? focused.navigate(url) : undefined));
        }
      }

      return self.clients.openWindow(url);
    })
  );
});
