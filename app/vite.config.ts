import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

// design3d/assets/ (catálogo, GLBs, texturas — frente de Gráficos) é servido em /assets/ no dev e copiado no build.
const MIME: Record<string, string> = { '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2', '.svg': 'image/svg+xml', '.hdr': 'application/octet-stream' }
const sharedAssets = (): Plugin => {
  const dir = resolve(__dirname, '../assets')
  return {
    name: 'design3d-shared-assets',
    configureServer(server) {
      server.middlewares.use('/assets', (req, res, next) => {
        const f = join(dir, decodeURIComponent((req.url ?? '/').split('?')[0]))
        if (f.startsWith(dir) && existsSync(f) && statSync(f).isFile()) {
          res.setHeader('Content-Type', MIME[extname(f)] ?? 'application/octet-stream')
          createReadStream(f).pipe(res)
        } else next()
      })
    },
    closeBundle() {
      if (existsSync(dir)) cpSync(dir, resolve(__dirname, 'dist/assets'), { recursive: true })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    sharedAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Design 3D — Interiores e Exteriores',
        short_name: 'Design 3D',
        description: 'Crie e edite ambientes internos e externos em 3D, por medidas reais, com IA.',
        lang: 'pt-BR',
        start_url: '.',
        scope: '.',
        theme_color: '#12151c',
        background_color: '#12151c',
        display: 'standalone',
        orientation: 'any',
        categories: ['productivity', 'design'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: { maximumFileSizeToCacheInBytes: 6 * 1024 * 1024 },
    }),
  ],
  server: { port: 5173, fs: { allow: ['..'] }, proxy: { '/api': 'http://127.0.0.1:3737' } },
  test: { environment: 'node' },
})
