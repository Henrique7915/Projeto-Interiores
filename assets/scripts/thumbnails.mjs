#!/usr/bin/env node
// Gera as miniaturas do catálogo (assets/thumbnails/*.png) renderizando cada item com o motor 3D.
// Pré-requisitos: o app rodando em modo dev (npm run dev) com <PreviewPage/> montada em `?preview=<catalogId>`,
// e `playwright-core` + um Chromium (ex.: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers).
// Uso: node assets/scripts/thumbnails.mjs [--url http://localhost:5173] [--chrome /caminho/chrome] [--only sofa/modern-l,rug/round]
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []))
const here = dirname(fileURLToPath(import.meta.url))
const catalog = JSON.parse(readFileSync(join(here, '..', 'catalog.json'), 'utf8'))
const out = join(here, '..', 'thumbnails')
mkdirSync(out, { recursive: true })

const require = createRequire(import.meta.url)
const { chromium } = require(args.pw ?? 'playwright-core')
const browser = await chromium.launch({
  executablePath: args.chrome,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 })
const base = args.url ?? 'http://localhost:5173'
for (const it of catalog.items) {
  if (args.only && !args.only.split(',').includes(it.id)) continue
  const lit = it.category === 'lighting' ? '&lit=1' : ''
  await page.goto(`${base}/?preview=${encodeURIComponent(it.id)}&size=512${lit}`)
  await page.waitForSelector('#preview-frame canvas')
  await page.waitForTimeout(2500)
  const file = join(out, it.id.replace(/\//g, '-') + '.png')
  await page.locator('#preview-frame').screenshot({ path: file, omitBackground: true })
  console.log(it.id, '->', file)
}
await browser.close()
