// sw.js — versão definitiva 2025 (iOS-proof)
// BUMP VERSION: v11 (Alterar isto força a atualização imediata em todos os dispositivos)
const CACHE_NAME = 'resiflow-v11'; 

const ESSENTIAL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

// URLs externas que exigem CORS (como React com crossorigin)
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
      // 1. Cache de arquivos locais
      await cache.addAll(ESSENTIAL_URLS);
      
      // 2. Cache de libs externas com tratamento de erros individual
      // Se uma falhar, não quebra a instalação inteira
      const externalFetches = EXTERNAL_LIBS.map(url => 
        fetch(url, { mode: 'cors' })
          .then(res => {
            if (res.ok) return cache.put(url, res);
            console.warn('Falha ao cachear lib externa (ignorado):', url);
          })
          .catch(err => console.warn('Erro rede lib externa (ignorado):', err))
      );
      
      await Promise.all(externalFetches);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => {
      // Força o novo SW a assumir o controlo imediatamente
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // HTML / Navegação -> Network First (COM FORÇA DE RELOAD)
  // Isto garante que nunca servimos um index.html antigo/quebrado
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request, { cache: 'reload' })
        .then(res => {
           // Opcional: Atualizar a cache com a nova versão bem-sucedida
           const resClone = res.clone();
           caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
           return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Libs Externas -> Stale-While-Revalidate
  if (EXTERNAL_LIBS.some(lib => url.startsWith(lib))) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request, { mode: 'cors' }).then(res => {
          if(res.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, res.clone()));
          }
          return res;
        }).catch(() => null); // Falha silenciosa em background

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
