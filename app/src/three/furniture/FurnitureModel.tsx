import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import type { RObject } from '../render/types'
import { resolveMaterial } from '../materials/library'
import { getThreeMaterial } from '../materials/three'
import { BUILDERS } from './builders'
import { GlbBoundary, GlbMesh, glbUrl } from './GlbModel'

const lightColor = (kelvin: number, explicit?: string) => {
  if (explicit) return explicit
  // aproximação de temperatura de cor (Tanner Helland)
  const t = kelvin / 100
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Desenha o móvel de um RObject: escolhe o desenhista pelo catálogo e monta o material de cada slot. */
export function FurnitureModel({ obj, glow, lowQuality }: { obj: RObject; glow: number; lowQuality?: boolean }) {
  const isGlb = obj.model.startsWith('models/')
  // models/<nome>.glb → desenhista procedural <nome> (usado enquanto o GLB carrega ou se falhar)
  const name = isGlb ? obj.model.slice('models/'.length).replace(/\.glb$/i, '') : obj.model.startsWith('procedural/') ? obj.model.slice('procedural/'.length) : 'box'
  const Build = BUILDERS[name] ?? BUILDERS.box
  const fallback = useMemo(() => resolveMaterial('wood/natural-oak'), [])
  const m = (slot: string): THREE.Material => {
    const spec = obj.materials[slot] ?? (name === 'box' ? Object.values(obj.materials)[0] : undefined) ?? fallback
    return getThreeMaterial(spec, lowQuality)
  }
  const slots = useMemo(() => new Set(Object.keys(obj.materials)), [obj.materials])
  const light = obj.light
  const procedural = (
    <Build
      s={obj.size}
      m={m}
      glow={light?.on === false ? 0 : glow}
      lightColor={lightColor(light?.temperatureK ?? 2700, light?.color)}
      lumens={light?.lumens ?? 400}
      hasLight={!!light && light.on !== false}
      clearance={obj.clearance}
    />
  )
  if (!isGlb) return procedural
  return (
    <GlbBoundary fallback={procedural}>
      <Suspense fallback={procedural}>
        <GlbMesh url={glbUrl(obj.model)} size={obj.size} slots={slots} material={m} />
      </Suspense>
    </GlbBoundary>
  )
}
