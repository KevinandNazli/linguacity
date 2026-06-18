const CACHE = 'ameristart-v1';
const ASSETS = [
  '/linguacity/urgent_help.html',
  '/linguacity/manifest.json'
];

// Install - cache core assets
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, cache fallback
self.addEventListener('fetch', function(e) {
  // Don't cache API calls
  if (e.request.url.includes('supabase.co') || 
      e.request.url.includes('anthropic.com') ||
      e.request.url.includes('elevenlabs.io')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(function(response) {
        // Cache successful responses
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      })
      .catch(function() {
        // Fallback to cache when offline
        return caches.match(e.request);
      })
  );
});
