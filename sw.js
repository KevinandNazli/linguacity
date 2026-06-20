const CACHE = 'ameristart-v3';

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// Network only, with cache-busting - always get the freshest file, never serve stale HTML/JS
self.addEventListener('fetch', function(e) {
  if (e.request.url.includes('supabase.co') ||
      e.request.url.includes('anthropic.com')) {
    return;
  }
  e.respondWith(fetch(e.request, { cache: 'no-store' }));
});

