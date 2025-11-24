// Nome do Cache (mude a versão se atualizar o app para forçar atualização nos clientes)
const CACHE_NAME = 'resiflow-v2-cache';

// Lista de arquivos e bibliotecas para cachear IMEDIATAMENTE
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  // Bibliotecas Pesadas (React, Babel, Tailwind)
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js', // O vilão de 3MB que será domado
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  // Fontes
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];

// Instalação: Baixa tudo que é crítico
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cacheando arquivos estáticos');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Limpando cache antigo', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Interceptação: Serve do cache primeiro, depois tenta rede (Cache First Strategy)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se achou no cache, retorna instantaneamente
        if (response) {
          return response;
        }
        
        // Se não, busca na rede
        return fetch(event.request).then(
          function(response) {
            // Verifica se a resposta é válida
            if(!response || response.status !== 200 || response.type !== 'basic' && !event.request.url.startsWith('http')) {
              return response;
            }

            // Clona a resposta para salvar no cache para a próxima vez
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                // Apenas cacheia requisições GET http/https
                if(event.request.url.startsWith('http')) {
                    cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        );
      })
  );
});
