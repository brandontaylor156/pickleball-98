import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import osmHandler from './api/osm.js'
import townHandler from './api/town.js'
import a11yCss from './postcss-a11y.js'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// one version per build: the service worker's cache name
const BUILD_VERSION = String(Date.now())

// Lists every built file and public asset for the service worker (public/sw.js) to
// save for offline use. A new version string each build gives each deploy its own cache.
const swManifest = () => ({
  name: 'sw-manifest',
  apply: 'build',
  generateBundle(options, bundle) {
    const files = Object.keys(bundle).map((f) => '/' + f)
    const walk = (dir) =>
      readdirSync(dir).flatMap((name) => {
        const full = join(dir, name)
        return statSync(full).isDirectory() ? walk(full) : ['/' + relative('public', full).replace(/[\\/]+/g, '/')]
      })
    const skip = new Set(['/sw.js', '/sw-manifest.json'])
    // (Venue Finder's index, megabytes of shards, loads only when someone searches; Spark, the
    // 2.6 MB splat renderer, only for people who add a photoreal backdrop; the High skins (KTX2,
    // about 450 KB each, fetched per skin tone on High, with their transcoder's .wasm); the
    // photographed faces, about 0.7 MB each, fetched per face a match shows; and Explore's
    // prebuilt town tiles, megabytes of map, fetched round where you walk or drive: not precached)
    const onDemand = (f) => f.startsWith('/assets/pickleball/pl-face-') || f.startsWith('/venues/idx/') || f.startsWith('/roam/') || f.endsWith('.wasm') || f.endsWith('.ktx2') || /\/spark\.module-[^/]+\.js$/.test(f)
    const all = [...new Set([...files, ...walk('public')])].filter((f) => !skip.has(f) && !f.endsWith('.map') && !onDemand(f))
    this.emitFile({
      type: 'asset',
      fileName: 'sw-manifest.json',
      source: JSON.stringify({ version: BUILD_VERSION, files: all }),
    })
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    swManifest(),
    {
      // Serve the Vercel functions locally so `npm run dev` matches production
      name: 'dev-api',
      configureServer(server) {
        server.middlewares.use('/api/osm', osmHandler)
        server.middlewares.use('/api/town', townHandler)
      },
    },
  ],
  css: {
    // 98.css ships `@media (not(hover))`, which Lightning CSS rejects
    lightningcss: { errorRecovery: true },
    // Accessibility: text size, title bar height and less motion everywhere
    postcss: { plugins: [a11yCss()] },
  },
})
