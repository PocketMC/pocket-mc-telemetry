/**
 * Pocket MC Telemetry — Service Worker
 * Provides offline support and PWA installability.
 */
const CACHE = 'pmc-telemetry-v26';

// Assets to cache on install
const PRECACHE = [
  '/',
  'index.html',
  'heatmap.html',
  'icon.svg',
  'src/style.css',
  'src/heatmap.css',
  'src/app.js',
  'src/heatmap.js',
  'src/countries.js',
  'manifest.json',
  'https://cdn.jsdelivr.net/npm/jsvectormap@1.7.0/dist/jsvectormap.min.css',
  'https://cdn.jsdelivr.net/npm/jsvectormap@1.7.0/dist/jsvectormap.min.js',
  'https://cdn.jsdelivr.net/npm/jsvectormap@1.7.0/dist/maps/world.js'
];

// Install — pre-cache key assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch with a timeout fallback
function fetchWithTimeout(request, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Network request timed out'));
    }, timeoutMs);

    fetch(request).then(
      (response) => {
        clearTimeout(timeout);
        resolve(response);
      },
      (err) => {
        clearTimeout(timeout);
        reject(err);
      }
    );
  });
}

// Fetch — network-first (with timeout), fallback to cache
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // For API requests — network only, no caching
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetchWithTimeout(event.request, 3000)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || new Response('Offline', { status: 503 })))
  );
});