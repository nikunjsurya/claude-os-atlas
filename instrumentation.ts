// Boot-time warm-up: the deck's first paint used to pay for everything at
// once (dev route compiles, the ~1.5s atlas walk, 23 git repo scans, n8n
// fetch, screenshot freshness checks). register() runs once per server
// boot; shortly after the server starts listening we request every deck
// surface ourselves so the caches are hot before a browser ever arrives.
// Self-HTTP (not direct calls) on purpose: route bundles do not reliably
// share lib module instances, but a real request warms the real cache.

export function register(): void {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PUBLIC_ATLAS_MODE === 'public') return

  const port = process.env.PORT ?? '3000'
  const base = `http://127.0.0.1:${port}`
  const surfaces = [
    '/',
    '/api/atlas',
    '/api/pulse/projects',
    '/api/pulse/sites',
    '/api/pulse/n8n',
    '/api/queue',
  ]

  // register() must complete before the server accepts requests, so the
  // warm-up is scheduled, never awaited.
  setTimeout(() => {
    for (const surface of surfaces) {
      fetch(base + surface).catch(() => {
        // Wrong port or slow boot: the first visitor pays, same as before.
      })
    }
  }, 1500)
}
