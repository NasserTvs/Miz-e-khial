import { POST } from './rooms'

export default {
  async fetch(request: Request, env: { ASSETS: { fetch(request: Request): Promise<Response> } }) {
    const url = new URL(request.url)
    if (url.pathname === '/api/game') {
      return request.method === 'POST' ? POST(request) : new Response(null, { status: 405, headers: { Allow: 'POST' } })
    }
    if (url.pathname === '/') return Response.redirect(new URL('/game.html' + url.search, url).href, 302)
    return env.ASSETS.fetch(request)
  }
}
