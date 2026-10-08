#!/usr/bin/env node
// Gera assets/catalog.json a partir de materials.mjs, items.mjs e moods.mjs e valida contra schema/catalog.schema.json.
// Uso: node assets/catalog/build.mjs   (rode de qualquer pasta)
import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { materials } from './materials.mjs'
import { items } from './items.mjs'
import { moods } from './moods.mjs'
import { validateCatalog } from '../validar.mjs'

const here = dirname(fileURLToPath(import.meta.url))
// miniatura gerada por assets/scripts/thumbnails.mjs, se existir
for (const it of items) {
  const thumb = `thumbnails/${it.id.replace(/\//g, '-')}.png`
  if (existsSync(join(here, '..', thumb))) it.thumbnail = thumb
}
const catalog = { $schema: '../schema/catalog.schema.json', format: 'design3d.catalog', version: '0.1.0', items, materials, moods }
const res = validateCatalog(catalog)
if (!res.valid) { console.error(res.errors.join('\n')); process.exit(1) }
writeFileSync(join(here, '..', 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n')
console.log(`catalog.json: ${items.length} itens, ${Object.keys(materials).length} materiais, ${moods.length} climas`)
