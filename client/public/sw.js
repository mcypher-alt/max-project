self.addEventListener('install', () => {
  console.log('[Service Worker] Установлен');
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('[Service Worker] Активирован');
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});