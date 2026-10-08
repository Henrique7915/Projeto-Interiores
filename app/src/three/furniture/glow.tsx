import { useContext, useMemo } from 'react'
import * as THREE from 'three'
import type { Vec3 } from './parts'
import { LightBudget } from '../lighting/Lighting'

/** Brilho e luz real das luminárias, compartilhados pelos desenhistas de móveis. */

const lightIntensity = (lumens: number) => Math.min(4, 0.9 + lumens / 400)

export function Glow({ pos, glow, lightColor, lumens, hasLight, distance = 5 }: { pos: Vec3; glow: number; lightColor: string; lumens: number; hasLight: boolean; distance?: number }) {
  const allowed = useContext(LightBudget)
  if (!allowed || !hasLight || glow < 0.05) return null
  return <pointLight position={pos} intensity={glow * lightIntensity(lumens)} distance={distance} decay={2} color={lightColor} />
}

const glowCache = new Map<string, THREE.Material>()
/** Cópia do material com brilho (emissive) proporcional a `glow`, compartilhada por degraus de 1/8 */
export function useGlowMaterial(base: THREE.Material, glow: number, color: string): THREE.Material {
  return useMemo(() => {
    const q = Math.round(glow * 8)
    const key = base.uuid + ':' + q + ':' + color
    let g = glowCache.get(key)
    if (!g) {
      const c = base.clone() as THREE.MeshPhysicalMaterial
      c.emissive = new THREE.Color(color)
      c.emissiveIntensity = (q / 8) * 1.6
      g = c
      glowCache.set(key, g)
    }
    return g
  }, [base, glow, color])
}
