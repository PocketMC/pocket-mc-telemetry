/**
 * PocketMC Telemetry : Progressive Web App Service Worker
 * Native Android App-Grade Offline & Instant Cold-Launch Caching
 */

const CACHE_NAME = 'pmc-telemetry-v43';

// Core critical shell assets to cache on install
const CRITICAL_SHELL = [
  './',
  'index.html',
  'manifest.json',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable.png',
  'apple-touch-icon.png'
];

// Optional non-blocking assets to cache
const SECONDARY_ASSETS = [
  'flavors/paper.svg',
  'flavors/fabric.png',
  'flavors/fabric.svg',
  'flavors/neoforge.png',
  'flavors/neoforge.svg',
  'flavors/forge.png',
  'flavors/spigot.svg',
  'flavors/purpur.svg',
  'flavors/bedrock.png',
  'flavors/vanilla.png',
  'https://cdn.jsdelivr.net/npm/jsvectormap@1.7.0/dist/jsvectormap.min.css',
  'https://cdn.jsdelivr.net/npm/jsvectormap@1.7.0/dist/jsvectormap.min.js',
  'https://cdn.jsdelivr.net/npm/jsvectormap@1.7.0/dist/maps/world.js'
];

// 1. Install Event: Cache critical shell immediately and activate without delay
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache critical shell (must succeed)
      try {
        await cache.addAll(CRITICAL_SHELL);
      } catch (err) {
        console.warn('[SW] Non-fatal issue caching some critical shell assets:', err);
      }

      // Cache secondary assets in background (resilient to individual failures)
      for (const url of SECONDARY_ASSETS) {
        cache.add(url).catch(() => {
          // ignore individual asset failures
        });
      }
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up legacy caches and immediately take control of open clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('pmc-telemetry-') && key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Fast timeout fetch
function fetchWithTimeout(request, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Network timeout'));
    }, timeoutMs);

    fetch(request)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// 3. Fetch Event
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip non-http(s) schemes (e.g. chrome-extension)
  if (!url.protocol.startsWith('http')) return;

  // ── Strategy A: Navigation requests (App Launch & Deep Link Routing) ──
  // Native app feel: Network-first with fast 1200ms fallback to cached index.html shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(req, 1200)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('index.html', clone));
          }
          return networkRes;
        })
        .catch(async () => {
          // Return cached index.html so cold launch paints instantly without network
          const cached = await caches.match(req);
          if (cached) return cached;

          const shell = await caches.match('index.html');
          if (shell) return shell;

          const rootShell = await caches.match('./');
          if (rootShell) return rootShell;

          return new Response('<h1>PocketMC Telemetry</h1><p>Application shell loading...</p>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  // ── Strategy B: Telemetry API Data (Network-first with offline cache fallback) ──
  if (url.pathname.includes('/api/telemetry') || url.pathname.includes('telemetry/stats')) {
    event.respondWith(
      fetchWithTimeout(req, 4000)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'offline' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // ── Strategy C: Hashed Assets (/assets/*) & Static Files (Cache-First) ──
  // Immutable hashed Vite bundles never change; return from cache in 0ms!
  const isHashedAsset = url.pathname.includes('/assets/');
  const isImageOrFont = /\.(png|jpg|jpeg|svg|webp|woff|woff2|ttf|css|js)$/i.test(url.pathname);

  if (isHashedAsset || isImageOrFont || url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          // Stale-while-revalidate for CDN assets; purely cache-first for hashed assets
          if (!isHashedAsset) {
            fetch(req).then((fresh) => {
              if (fresh && fresh.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(req, fresh));
              }
            }).catch(() => {});
          }
          return cached;
        }

        return fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        });
      })
    );
    return;
  }

  // ── Strategy D: Default network with cache fallback ──
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkRes;
      })
      .catch(() => caches.match(req))
  );
});
