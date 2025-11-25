// sw.js — Versão otimizada para iOS + performance absurda
const CACHE_NAME = 'resiflow-v8'; // mude só esse número quando quiser forçar atualização global

// 1. Arquivos ESSENCIAIS que podem ser baixados rapidinho (total < 400 KB)
const ESSENTIAL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest'
];

// 2. Bibliotecas PESADAS que vamos deixar para Stale-While-Revalidate (não travam a instalação)
const HEAVY_LIBS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];

// INSTALL EVENT → Só cacheia o essencial (rápido!)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ESSENTIAL_URLS))
      .then(() => self.skipWaiting()) // Força ativação imediata
  );
});


// ACTIVATE EVENT → Limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    )).then(() => self.clients.claim())
  );
});


// FETCH EVENT → Estratégia inteligente por tipo de recurso
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 1. HTML → sempre pega da rede primeiro (garante atualização rápida)
  if (url.endsWith('.html') || url.includes('index.html') || url === location.origin + '/') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 2. Bibliotecas pesadas → Stale-While-Revalidate (melhor coisa do mundo no iOS)
  if (HEAVY_LIBS.some(lib => url.startsWith(lib))) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request)
          .then(response => {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
            return response;
          })
        )
    );
    return;
  }

  // 3. Tudo o mais (imagens, fontes, Firebase, etc.) → Cache First, fallback na rede
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request)
        .then(netResponse => {
          // Não cacheia respostas de erro ou coisas estranhas
          if (netResponse && netResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, netResponse.clone()));
          }
          return netResponse;
        })
        .catch(() => caches.match('./index.html')) // offline fallback
      )
  );
});
