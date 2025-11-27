// sw.js — PWA Otimizado para ReviewFlow
const CACHE_NAME = 'resiflow-v10'; // Atualizado para v10

// 1. Arquivos essenciais (Interface básica)
const ESSENTIAL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest'
];

// 2. Bibliotecas pesadas e Scripts Externos (React, Firebase, Utils)
// Estratégia: Stale-While-Revalidate (Usa cache se tiver, atualiza em 2º plano)
const HEAVY_LIBS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js',
  // Scripts do Firebase (para o App Shell carregar rápido)
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js',
  // Fontes
  'https://fonts.googleapis.com/css2',
  'https://fonts.gstatic.com/'
];

// ============= INSTALL =============
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ESSENTIAL_URLS))
      .then(() => self.skipWaiting())
  );
});

// ============= ACTIVATE =============
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
    .then(() => self.clients.claim())
  );
});

// ============= FETCH =============
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  const request = event.request;

  // 1. Navegação (HTML) → Network First + Fallback Cache
  if (request.mode === 'navigate' || url.endsWith('.html') || url.includes(location.origin + '/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html')) // Fallback robusto
    );
    return;
  }

  // 2. Recursos Pesados (Libs externas) → Stale-While-Revalidate
  // Verifica se a URL começa com algum dos prefixos das libs pesadas
  if (HEAVY_LIBS.some(lib => url.startsWith(lib) || url.includes('unpkg.com') || url.includes('gstatic.com'))) {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          const fetched = fetch(request).then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
            }
            return response;
          }).catch(err => {
             // Se falhar o fetch e não tiver cache, apenas retorna erro silencioso para não quebrar
             return null; 
          });

          return cached || fetched;
        })
    );
    return;
  }

  // 3. Padrão Cache First para outros assets estáticos
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
            if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
                caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
            }
            return response;
        });
      })
  );
});
