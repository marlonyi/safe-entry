/**
 * Service Worker para SafeEntry PWA
 * Habilita funcionamiento offline y cache de recursos
 */

const CACHE_NAME = 'safeentry-v1';
const OFFLINE_URL = '/offline.html';

// Recursos a cachear inmediatamente
const PRECACHE_ASSETS = [
    '/',
    '/login',
    '/Vista.html',
    '/Style.css',
    '/styles.css',
    '/script.js',
    '/manifest.json',
    '/offline.html',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
];

// Instalar - precachear recursos esenciales
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cacheando recursos...');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => {
                console.log('[SW] Recursos cacheados exitosamente');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Error cacheando:', error);
            })
    );
});

// Activar - limpiar caches antiguos
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando Service Worker...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Eliminando cache antiguo:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[SW] Service Worker activado');
            return self.clients.claim();
        })
    );
});

// Fetch - estrategia Network First con fallback a cache
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Solo manejar requests GET
    if (request.method !== 'GET') return;

    // Ignorar requests de API (siempre ir a la red)
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Para navegación, usar Network First
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cachear la respuesta
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Offline - intentar desde cache
                    return caches.match(request)
                        .then((cachedResponse) => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Mostrar página offline
                            return caches.match(OFFLINE_URL);
                        });
                })
        );
        return;
    }

    // Para otros recursos, usar Cache First
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Actualizar cache en background
                    fetch(request).then((response) => {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, response);
                        });
                    }).catch(() => { });
                    return cachedResponse;
                }

                // No está en cache, ir a la red
                return fetch(request)
                    .then((response) => {
                        // Cachear para futuro
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                        return response;
                    })
                    .catch(() => {
                        // Para imágenes, devolver placeholder
                        if (request.destination === 'image') {
                            return new Response(
                                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#e2e8f0" width="200" height="200"/><text fill="#94a3b8" x="50%" y="50%" text-anchor="middle">Offline</text></svg>',
                                { headers: { 'Content-Type': 'image/svg+xml' } }
                            );
                        }
                    });
            })
    );
});

// Manejar mensajes del cliente
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});

// Sincronización en background (para cuando vuelve la conexión)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        console.log('[SW] Sincronizando datos...');
        // Aquí se puede implementar sincronización de datos offline
    }
});

console.log('[SW] Service Worker cargado');
