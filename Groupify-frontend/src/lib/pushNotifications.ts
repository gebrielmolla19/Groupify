import { API_BASE_URL } from './config';
import { getToken } from './api';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr.buffer;
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/vapid-key`);
    const data = await res.json();
    return data.publicKey ?? null;
  } catch {
    return null;
  }
}

/**
 * Register the service worker.
 * Safe to call multiple times — returns the existing registration if already registered.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return registration;
  } catch {
    return null;
  }
}

/**
 * Request push notification permission and subscribe the browser.
 * Posts the subscription to the backend. Silently exits if permission is denied.
 */
export async function requestPermissionAndSubscribe(): Promise<void> {
  if (!('Notification' in window)) { console.warn('[PWA] Notification API not supported'); return; }
  if (!('PushManager' in window)) { console.warn('[PWA] PushManager not supported'); return; }

  const permission = await Notification.requestPermission();
  console.log('[PWA] Notification permission:', permission);
  if (permission !== 'granted') return;

  const vapidKey = await getVapidPublicKey();
  console.log('[PWA] VAPID key fetched:', vapidKey ? 'yes' : 'no');
  if (!vapidKey) return;

  const registration = await navigator.serviceWorker.ready;
  console.log('[PWA] SW ready:', registration.active?.state);

  let sub = await registration.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      console.log('[PWA] New push subscription created');
    } catch (err) {
      console.error('[PWA] pushManager.subscribe failed:', err);
      return;
    }
  } else {
    console.log('[PWA] Existing push subscription found');
  }

  const token = getToken();
  if (!token) { console.warn('[PWA] No auth token'); return; }

  const res = await fetch(`${API_BASE_URL}/notifications/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  console.log('[PWA] Subscribe response:', res.status);
}

/**
 * Unsubscribe from push notifications and remove from the backend.
 */
export async function unsubscribePush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();

  const token = getToken();
  if (!token) return;

  await fetch(`${API_BASE_URL}/notifications/subscribe`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ endpoint }),
  });
}
