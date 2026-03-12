const CACHE_NAME = 'gymapp-v3';

// Asset sicuri da cachare subito — solo file statici certi
const ASSETS = [
  '/manifest.json',
];

// ─── INSTALL ───────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Promise.allSettled: se un asset fallisce non blocca l'installazione
    await Promise.allSettled(ASSETS.map(url => cache.add(url).catch(() => {})));
    self.skipWaiting();
  })());
});

// ─── ACTIVATE: rimuove cache vecchie ──────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null));
    self.clients.claim();
  })());
});

// ─── FETCH ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Ignora tutto ciò che non è GET
  if (req.method !== 'GET') return;

  // Ignora schemi non http
  if (!url.protocol.startsWith('http')) return;

  // Supabase: sempre solo rete, mai cachare dati autenticati
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(req).catch(() => Response.error()));
    return;
  }

  // Navigazioni (cambio pagina): network-first, fallback cache
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match(req) || await cache.match('/') || Response.error();
      }
    })());
    return;
  }

  // Asset statici Next.js (/_next/static/): cache-first, hanno hash nel nome
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  // Tutto il resto: cache-first poi rete
  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch {
      return Response.error();
    }
  })());
});

// ─── PUSH NOTIFICATIONS ────────────────────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); } catch { return; }
  e.waitUntil(
    self.registration.showNotification(data.title || 'GymApp', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.url || '/home',
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data || '/home'));
});
