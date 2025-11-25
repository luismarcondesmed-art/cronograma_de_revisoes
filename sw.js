// sw.js — PWA perfeito para iOS 18+ e todos os navegadores (2025)
const CACHE_NAME = 'resiflow-v9'; // ← só mudar aqui para forçar update global

// 1. Arquivos essenciais (instalação < 1s mesmo em 3G)
const ESSENTIAL_URLS = [
  '/',                      // IMPORTANTE: raiz SEM './' no iOS
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest/dist/umd/lucide.js' // caminho correto
];

// 2. Bibliotecas pesadas → Stale-While-Revalidate (não travam install no iOS)
const HEAVY_LIBS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://fonts.googleapis.com/css2',
  'https://fonts.gstatic.com/'
];

// ============= INSTALL — Rápido e infalível no iOS =============
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ESSENTIAL_URLS))
      .then(() => self.skipWaiting()) // Ativa imediatamente
  );
});

// ============= ACTIVATE — Limpeza agressiva + claim =============
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
    .then(() => self.clients.claim()) // Toma controle de todas as tabs imediatamente
  );
});

// ============= FETCH — Estratégia perfeita por tipo =============
self.addEventListener('fetch', event => {
  // Ignora requisições que não são GET (ex: POST do Firebase, chrome-extension://, etc.)
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  const request = event.request;

  // 1. Navegação (HTML) → Network First + fallback offline
  if (request.mode === 'navigate' || url.endsWith('.html') || url.includes(location.origin + '/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Se for sucesso, atualiza o cache do index.html
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // 2. Recursos pesados (React, Babel, fontes) → Stale-While-Revalidate
  if (HEAVY_LIBS.some(lib => url.startsWith(lib))) {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          const fetched = fetch(request).then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
            }
            return response;
          });

          // Retorna cache imediatamente, mas atualiza em segundo plano
          return cached || fetched;
        })
        .catch(() => caches.match(request)) // nunca quebra
    );
    return;
  }

  // 3. Tudo mais (imagens, API, Firebase, etc.) → Cache First + fallback rede
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;

        return fetch(request)
          .then(response => {
            // Só cacheia respostas válidas
            if (response && response.status === 200 && response.type === 'basic' || response.type === 'cors') {
              caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => {
            // Offline fallback apenas para navegação já tratado acima
            // Para assets, deixa falhar mesmo (melhor que 404 falso)
            return caches.match('/index.html');
          });
      })
  );
});

// ============= FORÇAR ATUALIZAÇÃO DO USUÁRIO =============
// Adicione isso no seu front-end (main.js ou index.html):
// navigator.serviceWorker?.register('/sw.js').then(reg => {
//   reg.addEventListener('updatefound', () => location.reload());
// });

// Ou use o truque do cache-buster no nome do arquivo:
// <link rel="manifest" href="/manifest.json?v=9">
