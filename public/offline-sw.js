const base = new URL('./', self.location.href)
const cacheName = 'khial-local-v3:' + base.pathname
const gameURL = new URL('game.html?v=9', base).href
const files = [
  'game.html?v=9', 'offline.js?v=3', 'modes.js?v=9', 'table.js?v=6', 'table.css?v=5',
  'nearby.mjs?v=9', 'local-rules.mjs?v=6', 'qr-reader.js', 'qr-writer.js',
  'fonts/Regular.ttf', 'fonts/Bold.ttf', 'cards/names.json', 'paintings/names.json?v=6'
]
for (let id = 0; id < 104; id++) {
  files.push('paintings/' + id + '.webp', 'paintings/thumb/' + id + '.webp')
}
const urls = new Set(files.map(file => new URL(file, base).href))

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName)
  // Keep each batch small enough for a phone to finish or retry on a slow connection.
  for (let i = 0; i < files.length; i += 4) {
    await Promise.all(files.slice(i, i + 4).map(async file => {
      const url = new URL(file, base).href
      if (await cache.match(url)) return
      for (let attempt = 0; ; attempt++) {
        try {
          const response = await fetch(url, {cache: attempt ? 'reload' : 'default'})
          if (!response.ok || (!file.startsWith('game.html') && response.headers.get('content-type')?.includes('text/html'))) {
            throw new Error(String(response.status))
          }
          // Store redirected HTML as a normal navigation response as well.
          await cache.put(url, response.redirected
            ? new Response(await response.blob(), {headers: response.headers}) : response)
          break
        } catch (error) {
          if (attempt === 2) {
            const pages = await self.clients.matchAll({includeUncontrolled:true})
            for (const page of pages) page.postMessage({offlineFailed:file})
            throw error
          }
          await new Promise(resolve => setTimeout(resolve, 750 * (attempt + 1)))
        }
      }
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
