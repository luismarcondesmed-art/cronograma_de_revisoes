// sw.js — versão definitiva 2025 (iOS-proof)
const CACHE_NAME = 'resiflow-v10'; // Mantive v10 para garantir a atualização

const ESSENTIAL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

// URLs externas que exigem CORS (como React com crossorigin)
// Separamos para garantir que o cache armazene a resposta com cabeçalhos CORS corretos
const EXTERNAL_LIBS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // 1. Cache de arquivos locais (sempre seguro com addAll)
      await cache.addAll(ESSENTIAL_URLS);
      
      // 2. Cache de libs externas com modo 'cors' EXPLICITO
      // Isso corrige o bug do Safari onde scripts <script crossorigin> falham se o cache for opaco (no-cors)
      const externalFetches = EXTERNAL_LIBS.map(url => 
        fetch(url, { mode: 'cors' })
          .then(res => {
            if (res.ok) return cache.put(url, res);
            console.warn('Falha ao cachear lib externa:', url);
          })
          .catch(err => console.warn('Erro rede lib externa:', err))
      );
      
      await Promise.all(externalFetches);
    }).then(() => self.skipWaiting())
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

  // HTML / Navegação -> Network First
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Libs Externas -> Stale-While-Revalidate
  if (EXTERNAL_LIBS.some(lib => url.startsWith(lib))) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        // Se tem no cache, retorna e atualiza em background
        const networkFetch = fetch(e.request).then(res => {
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, res.clone()));
          return res;
        });
        return cached || networkFetch;
      })
    );
    return;
  }

  // Todo o resto -> Cache First
  e.respondWith(
    caches.match(e.request).then(res => 
      res || fetch(e.request).then(netRes => {
        if (netRes && netRes.status === 200 && (url.startsWith('http') || url.startsWith('https'))) {
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, netRes.clone()));
        }
        return netRes;
      })
    )
  );
});
