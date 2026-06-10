const CACHE_NAME = 'imperio-pasteis-v1';

// Recursos estáticos básicos para cache imediato
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Instalação: adiciona arquivos estáticos ao cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativação: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Interceptador de Fetch
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. IGNORA chamadas para API do Supabase e rotas internas /api
  if (
    requestUrl.origin.includes('supabase.co') ||
    requestUrl.pathname.startsWith('/api/') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // 2. CACHE-FIRST para arquivos estáticos (Imagens, JS, CSS do Next.js)
  if (
    requestUrl.pathname.startsWith('/_next/static/') ||
    requestUrl.pathname.startsWith('/icons/') ||
    requestUrl.pathname.match(/\.(png|jpg|jpeg|svg|gif|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // 3. NETWORK-FIRST para navegação (HTML e rotas do App)
  // Se a rede falhar, retorna a versão em cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Guarda uma cópia atualizada no cache se for uma resposta válida
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Se a rede falhar (offline), busca no cache
        return caches.match(event.request);
      })
  );
});
