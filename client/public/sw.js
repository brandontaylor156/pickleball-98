// Pickleball 98's service worker: keeps a copy of the game so it opens with no connection
// (from the home screen too). Online play, My Park's other players, Real Games and the
// tournaments still need the internet; solo play and practice work offline.
//
// sw-manifest.json is written at build time (vite.config.js) and lists every built file
// plus the public assets (not the big on-demand ones: faces, skins, Explore's tiles, the
// Venue Finder index; those are saved the first time they're used). Each deploy has its own
// cache; the previous one is kept until the next start so a page that's still open can
// finish loading its lazy chunks.

const PREFIX = "pk98-"

const manifest = () => fetch("/sw-manifest.json", { cache: "no-store" }).then((r) => r.json())

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const { version, files } = await manifest()
      const cache = await caches.open(PREFIX + version)
      // one at a time-ish so a slow phone connection isn't swamped; a failure skips the file
      const queue = ["/", ...files]
      const worker = async () => {
        while (queue.length) {
          const url = queue.shift()
          try {
            const res = await fetch(url, { cache: "reload" })
            if (res.ok) await cache.put(url, res)
          } catch {
            // offline mid-install: it'll be fetched (and cached) on first use instead
          }
        }
      }
      await Promise.all([worker(), worker(), worker(), worker()])
      await self.skipWaiting()
    })()
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const { version } = await manifest().catch(() => ({ version: null }))
      const keep = PREFIX + version
      const names = (await caches.keys()).filter((n) => n.startsWith(PREFIX) && n !== keep)
      // keep the newest older cache for pages still running the previous version
      names.sort()
      for (const name of names.slice(0, -1)) await caches.delete(name)
      await self.clients.claim()
    })()
  )
})

const sameOrigin = (url) => url.origin === self.location.origin

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  // the game's own files only: never the game server or /api
  if (!sameOrigin(url) || url.pathname.startsWith("/api/") || url.pathname === "/sw-manifest.json") return

  // pages: try the network (to get updates), fall back to the saved game
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request)
          const cache = (await caches.keys()).filter((n) => n.startsWith(PREFIX)).sort().pop()
          if (res.ok && cache) (await caches.open(cache)).put("/", res.clone())
          return res
        } catch {
          return (await caches.match("/", { ignoreVary: true })) || Response.error()
        }
      })()
    )
    return
  }

  // files: saved copy first (built files never change: their names include a hash),
  // otherwise fetch it and save it for next time
  event.respondWith(
    (async () => {
      const hit = await caches.match(request, { ignoreVary: true })
      if (hit) return hit
      const res = await fetch(request)
      if (res.ok && res.type === "basic") {
        const cache = (await caches.keys()).filter((n) => n.startsWith(PREFIX)).sort().pop()
        if (cache) (await caches.open(cache)).put(request, res.clone())
      }
      return res
    })()
  )
})
