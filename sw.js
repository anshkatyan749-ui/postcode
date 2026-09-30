// Offline shell for the site. Network first so a deploy shows up, cache as the fallback.
const CACHE = 'postcode-site-v1';
const SHELL = [
  './', './index.html', './config.js', './app.js', './manifest.webmanifest',
  './assets/vendor/gsap.min.js', './assets/vendor/ScrollTrigger.min.js',
  './assets/img/shot-preview.png', './assets/img/shot-plan.png',
  './assets/img/shot-skills.png', './assets/img/shot-chat.png', './favicon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
  );
});
