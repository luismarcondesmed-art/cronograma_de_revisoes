// sw.js — versão definitiva 2025 (iOS-proof)
const CACHE_NAME = 'resiflow-v10'; // Atualizado para v10 para forçar atualização nos clientes

const ESSENTIAL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest'
];

const HEAVY_LIBS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  // Adicionado Firebase para garantir funcionamento offline imediato
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll([...ESSENTIAL_URLS, ...HEAVY_LIBS]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // HTML / navegação → sempre rede primeiro (Network First)
  if (e.request.mode === 'navigate' || url.endsWith('.html') || url === location.origin + '/') {
    e.respondWith(
      fetch(e.request)
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Bibliotecas pesadas e Firebase → Stale-While-Revalidate
  if (HEAVY_LIBS.some(lib => url.startsWith(lib))) {
    e.respondWith(
      caches.match(e.request)
        .then(cached => {
          const networkFetch = fetch(e.request).then(res => {
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, res.clone()));
            return res;
          });
          return cached || networkFetch;
        })
    );
    return;
  }

  // Tudo mais → Cache First + fallback offline
  e.respondWith(
    caches.match(e.request)
      .then(res => res || fetch(e.request)
        .then(netRes => {
          if (netRes && netRes.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, netRes.clone()));
          }
          return netRes;
        })
        .catch(() => caches.match(e.request)) 
      )
  );
});
