import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import sceneSchema from '../../../schema/scene.schema.json'
import type { Scene } from './schema'

/** Validação de schema no navegador/Node (ajv). As regras de consistência extra ficam em analyze.ts. */
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validator = ajv.compile(sceneSchema)

export function validateSchema(scene: unknown): { valid: boolean; errors: string[] } {
  if (validator(scene)) return { valid: true, errors: [] }
  return {
    valid: false,
    errors: (validator.errors ?? []).slice(0, 12).map((e) => {
      const extra = e.params?.additionalProperty ?? (e.params?.allowedValues as string[] | undefined)?.join(', ')
      return `${e.instancePath || '/'}: ${e.message}${extra ? ` (${extra})` : ''}`
    }),
  }
}

export function assertScene(json: unknown): Scene {
  const r = validateSchema(json)
  if (!r.valid) throw new Error('Cena inválida:\n' + r.errors.join('\n'))
  return json as Scene
}
