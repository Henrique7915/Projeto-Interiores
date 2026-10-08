import * as THREE from 'three'
import type { MaterialSpec } from './library'
import { TEXTURE_SETS } from './textureSets'
import { getTexture } from './procedural'

const cache = new Map<string, THREE.MeshPhysicalMaterial>()
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)

/** Compartilha uma instância por (material resolvido + qualidade). Não altere o material retornado. */
export function getThreeMaterial(spec: MaterialSpec, lowQuality = false): THREE.MeshPhysicalMaterial {
  const key = JSON.stringify(spec) + (lowQuality ? ':lq' : '')
  const hit = cache.get(key)
  if (hit) return hit

  const cat = spec.category
  const textured = !!spec.texture && !!TEXTURE_SETS[spec.texture.set]
  const m = new THREE.MeshPhysicalMaterial({
    color: textured ? '#ffffff' : spec.color,
    roughness: spec.roughness ?? 0.7,
    metalness: spec.metalness ?? (cat === 'metal' ? 0.85 : 0),
  })
  m.name = spec.id

  if (cat === 'fabric' || cat === 'leather') {
    m.sheen = cat === 'fabric' ? 0.6 : 0.2
    m.sheenRoughness = 0.5
    m.sheenColor = new THREE.Color(spec.color).lerp(new THREE.Color('#ffffff'), 0.35)
  }
  if (cat === 'glass' || cat === 'water' || (spec.opacity ?? 1) < 1) {
    m.transparent = true
    m.opacity = spec.opacity ?? (cat === 'glass' ? 0.2 : 0.8)
    m.depthWrite = cat === 'water'
    m.userData.noShadow = cat === 'glass'
  }
  if (cat === 'glass') m.color.set(spec.color)
  if (spec.emissive) {
    m.emissive = new THREE.Color(spec.emissive)
    m.emissiveIntensity = spec.emissiveIntensity ?? 0
  }

  if (textured && spec.texture) {
    const def = TEXTURE_SETS[spec.texture.set]
    const pair = getTexture(
      {
        kind: def.kind,
        color: spec.color,
        color2: def.color2,
        tile: spec.texture.tileSize ?? [1, 1],
        rotationDeg: spec.texture.rotationDeg,
        seed: hash(spec.texture.set),
      },
      lowQuality ? 256 : 512,
    )
    m.map = pair.map
    m.bumpMap = pair.bump
    m.bumpScale = cat === 'paint' ? 0.4 : cat === 'fabric' ? 1.4 : 0.8
  }
  cache.set(key, m)
  return m
}
