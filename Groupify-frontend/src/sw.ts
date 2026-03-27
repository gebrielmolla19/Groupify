/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── Skip waiting when prompted by the app ─────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Push notification handler ──────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data: Record<string, string> = {};
  try { data = event.data?.json() ?? {}; } catch { data = { body: event.data?.text() ?? '' }; }
  const title: string = data.title ?? 'Groupify';
  const options: NotificationOptions = {
    body: data.body ?? '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    data: { url: data.url ?? '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click handler ─────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl: string = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ('focus' in client) return client.focus();
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
