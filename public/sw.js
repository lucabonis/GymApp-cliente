const CACHE_NAME = 'gymapp-v2';

// ─── INSTALL: skipWaiting immediato, nessun precache che può fallire ───────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.add('/manifest.json').catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE: rimuove cache vecchie ──────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── FETCH ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Ignora tutto ciò che non è GET
  if (request.method !== 'GET') return;

  // Ignora schemi non http
  if (!url.protocol.startsWith('http')) return;

  const isSupabase = url.hostname.includes('supabase.co');
  const isNextStatic = url.pathname.startsWith('/_next/static/');
  const isNextImage = url.pathname.startsWith('/_next/image');
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin && !isSupabase) return;

  if (isNextStatic) {
    // Asset statici Next.js: cache-first (hash nel nome, non cambiano mai)
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  if (isSupabase) {
    // Dati Supabase: network-first, fallback cache
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (isSameOrigin && !isNextImage) {
    // Pagine app: stale-while-revalidate
    // Mostra subito la cache (se disponibile), aggiorna in background
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const networkFetch = fetch(request)
            .then(res => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
  }
});

// ─── BACKGROUND SYNC ───────────────────────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'gymapp-sync') {
    e.waitUntil(processPendingQueue());
  }
});

async function processPendingQueue() {
  let db;
  try { db = await openDB(); } catch { return; }

  const actions = await getAllPending(db);
  for (const action of actions) {
    try {
      const res = await fetch(action.url, {
        method: action.method || 'POST',
        headers: action.headers || { 'Content-Type': 'application/json' },
        body: action.body,
      });
      if (res.ok) {
        await deletePending(db, action.id);
        const clients = await self.clients.matchAll();
        clients.forEach(c => c.postMessage({ type: 'SYNC_COMPLETE', action: action.tag }));
      }
    } catch {
      // Lascia in coda, riprova al prossimo sync
    }
  }
}

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

// ─── INDEXEDDB helpers ─────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('gymapp-offline', 1);
    req.onupgradeneeded = ev => {
      ev.target.result.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = ev => resolve(ev.target.result);
    req.onerror = ev => reject(ev.target.error);
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const req = db.transaction('pending', 'readonly').objectStore('pending').getAll();
    req.onsuccess = ev => resolve(ev.target.result || []);
    req.onerror = ev => reject(ev.target.error);
  });
}

function deletePending(db, id) {
  return new Promise((resolve, reject) => {
    const req = db.transaction('pending', 'readwrite').objectStore('pending').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = ev => reject(ev.target.error);
  });
}
