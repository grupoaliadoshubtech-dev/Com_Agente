// public/sw.js
// Service Worker do ComAgente PWA
// Cache de assets estáticos + notificações push

const CACHE_NAME = 'comagente-v1'
const STATIC_ASSETS = [
  '/workspace',
  '/login',
  '/dashboard',
]

// ── Install: cache de assets estáticos ──────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Ignora erros de cache em desenvolvimento
        console.log('[SW] Algumas páginas não puderam ser cacheadas')
      })
    })
  )
  self.skipWaiting()
})

// ── Activate: limpa caches antigos ──────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// ── Fetch: Network first, fallback para cache ───────────────
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Ignora requests que não são GET
  if (request.method !== 'GET') return

  // Ignora API calls e auth — sempre buscar do servidor
  if (request.url.includes('/api/')) return
  if (request.url.includes('/auth/')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clona a resposta para salvar no cache
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })
        }
        return response
      })
      .catch(() => {
        // Offline: tenta buscar do cache
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // Fallback para a página de workspace
          return caches.match('/workspace')
        })
      })
  )
})

// ── Push Notifications ──────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'ComAgente', body: 'Nova mensagem recebida', url: '/workspace' }

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() }
    }
  } catch {
    // Usa dados padrão
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/workspace' },
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
    tag: 'comagente-notification',
    renotify: true,
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// ── Clique na notificação ───────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const url = event.notification.data?.url || '/workspace'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Se já tem uma janela aberta, foca nela
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Senão, abre uma nova
      return self.clients.openWindow(url)
    })
  )
})
