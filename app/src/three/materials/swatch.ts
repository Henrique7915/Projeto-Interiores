import type { Material, MaterialRef } from '../../../../schema/types'
import { resolveMaterial } from './library'
import { getTexture } from './procedural'
import { TEXTURE_SETS } from './textureSets'

const cache = new Map<string, string>()

/**
 * Amostra quadrada do material (data URL PNG), para moodboard e seletores.
 * Usa a mesma textura do 3D, então o que a pessoa vê no painel é o que aparece na parede.
 */
export function materialSwatch(ref: MaterialRef, sceneMaterials?: Record<MaterialRef, Material>, size = 96): string {
  const spec = resolveMaterial(ref, sceneMaterials)
  const key = JSON.stringify(spec) + size
  const hit = cache.get(key)
  if (hit) return hit

  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = spec.color
  ctx.fillRect(0, 0, size, size)

  const def = spec.texture ? TEXTURE_SETS[spec.texture.set] : undefined
  if (def && spec.texture) {
    // mostra ~0,5 m do material
    const tile = spec.texture.tileSize ?? [1, 1]
    const pair = getTexture({ kind: def.kind, color: spec.color, color2: def.color2, tile, rotationDeg: spec.texture.rotationDeg, seed: [...spec.texture.set].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) }, 256)
    const src = pair.map.image as HTMLCanvasElement
    const frac = Math.min(1, 0.5 / tile[0])
    const sw = src.width * frac
    ctx.drawImage(src, 0, 0, sw, sw, 0, 0, size, size)
  }
  if (spec.category === 'glass' || (spec.opacity ?? 1) < 1) {
    ctx.globalAlpha = 0.25
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, size, size)
  }
  // brilho suave de cima para baixo
  const g = ctx.createLinearGradient(0, 0, 0, size)
  g.addColorStop(0, 'rgba(255,255,255,0.18)')
  g.addColorStop(1, 'rgba(0,0,0,0.12)')
  ctx.globalAlpha = 1
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  const url = cv.toDataURL('image/png')
  cache.set(key, url)
  return url
}
