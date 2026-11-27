const base = new URL('./', self.location.href)
const cacheName = 'khial-local-v1:' + base.pathname
const gameURL = new URL('game.html', base).href
const files = [
  'game.html', 'offline.js?v=1', 'modes.js?v=7', 'table.js?v=6', 'table.css?v=5',
  'nearby.mjs?v=6', 'local-rules.mjs?v=6', 'qr-reader.js', 'qr-writer.js',
  'fonts/Regular.ttf', 'fonts/Bold.ttf', 'cards/names.json', 'paintings/names.json?v=6'
]
for (let id = 0; id < 104; id++) {
  files.push('paintings/' + id + '.webp', 'paintings/thumb/' + id + '.webp')
}
const urls = new Set(files.map(file => new URL(file, base).href))

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName)
  // Keep each batch small enough for a phone to finish or retry on a slow connection.
  for (let i = 0; i < files.length; i += 8) {
    await Promise.all(files.slice(i, i + 8).map(async file => {
      const url = new URL(file, base).href
      if (await cache.match(url)) return
      const response = await fetch(url, {cache: 'reload'})
      if (!response.ok || (file !== 'game.html' && response.headers.get('content-type')?.includes('text/html'))) {
        throw new Error('Incomplete offline pack')
      }
      await cache.put(url, response)
    }))
  }
  await self.skipWaiting()
})()))
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', event => {
  const {request} = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  const isGame = request.mode === 'navigate' && url.origin === base.origin &&
    ['game.html','game',''].some(path => url.pathname === new URL(path, base).pathname)
  if (isGame) {
    event.respondWith((async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2500)
      try {
        const response = await fetch(request, {signal:controller.signal})
        if (response.ok) return response
      } catch {} finally { clearTimeout(timer) }
      return (await (await caches.open(cacheName)).match(gameURL)) || Response.error()
    })())
  } else if (urls.has(url.href)) {
    event.respondWith((async () => (await (await caches.open(cacheName)).match(request)) || fetch(request))())
  }
})
