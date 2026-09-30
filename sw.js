// Offline shell for the site. Network first so a deploy shows up, cache as the fallback.
// HTML is never served from cache: a stale page next to fresh assets breaks the sign-in flow.
const CACHE = 'postcode-site-v2';
const SHELL = [
  './', './index.html', './signup.html', './profile.html', './config.js', './auth.js', './app.js',
  './meadow.js', './manifest.webmanifest',
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
  if (request.mode === 'navigate') return;   // always the live page
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
