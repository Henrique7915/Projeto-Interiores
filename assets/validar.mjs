#!/usr/bin/env node
// Valida assets/catalog.json: JSON Schema + consistência (materiais e slots existem, ids únicos).
// Uso: node assets/validar.mjs [catalog.json]
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const schemaDir = join(here, '..', 'schema')
const req = createRequire(join(schemaDir, 'package.json'))
const Ajv2020 = req('ajv/dist/2020.js')
const addFormats = req('ajv-formats')
const read = (p) => JSON.parse(readFileSync(p, 'utf8'))

const ajv = new (Ajv2020.default ?? Ajv2020)({ allErrors: true, strict: false })
;(addFormats.default ?? addFormats)(ajv)
// catalog.schema.json referencia "scene.schema.json#/..." de forma relativa ao seu $id; registramos o schema da cena
// também nesse endereço (ver schema/PEDIDOS.md: pedido para o catálogo apontar direto para o $id da cena).
const sceneSchema = read(join(schemaDir, 'scene.schema.json'))
ajv.addSchema(sceneSchema)
ajv.addSchema({ ...sceneSchema, $id: 'https://design3d.local/schema/catalog/scene.schema.json' })
ajv.addSchema(read(join(schemaDir, 'catalog.schema.json')), 'catalog.schema.json')
const check = ajv.getSchema('catalog.schema.json')

export function validateCatalog(catalog) {
  const errors = []
  if (!check(catalog)) {
    for (const e of check.errors) errors.push(`schema ${e.instancePath || '/'}: ${e.message} ${JSON.stringify(e.params)}`)
    return { valid: false, errors }
  }
  const mats = new Set(Object.keys(catalog.materials ?? {}))
  const seen = new Set()
  for (const it of catalog.items) {
    if (seen.has(it.id)) errors.push(`item '${it.id}' repetido`)
    seen.add(it.id)
    for (const [slot, def] of Object.entries(it.materialSlots ?? {})) {
      if (!mats.has(def.default)) errors.push(`${it.id}: slot '${slot}' usa material inexistente '${def.default}'`)
      else {
        const cat = catalog.materials[def.default].category
        if (def.allowed && !def.allowed.includes(cat)) errors.push(`${it.id}: slot '${slot}': o padrão '${def.default}' (${cat}) não está em allowed`)
      }
    }
    if (it.model.startsWith('models/') && !existsSync(join(here, it.model))) errors.push(`${it.id}: arquivo ${it.model} não existe`)
  }
  for (const [id, m] of Object.entries(catalog.materials ?? {})) {
    if (m.base && !mats.has(m.base)) errors.push(`material '${id}': base '${m.base}' inexistente`)
  }
  for (const mood of catalog.moods ?? []) for (const p of mood.palette ?? []) if (!mats.has(p)) errors.push(`clima '${mood.id}': material '${p}' inexistente`)
  return { valid: errors.length === 0, errors }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ?? join(here, 'catalog.json')
  const r = validateCatalog(read(file))
  if (!r.valid) { console.error(r.errors.join('\n')); process.exit(1) }
  console.log(`${file}: ok`)
}
