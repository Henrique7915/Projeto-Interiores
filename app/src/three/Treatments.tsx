import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ThreeEvent } from '@react-three/fiber'
import type { ROpening, RTreatment, ScenePick } from './render/types'
import { getThreeMaterial } from './materials/three'
import { MATS } from './furniture/parts'

const cache = new Map<string, THREE.Material>()

/** Tecido de cortina/persiana: dos dois lados, e o voil é translúcido. Uma instância por (material, tipo, qualidade). */
function fabric(t: RTreatment, low: boolean): THREE.Material {
  const key = `${t.material.id}:${t.kind}:${low}`
  let m = cache.get(key)
  if (!m) {
    const base = getThreeMaterial(t.material, low).clone()
    base.side = THREE.DoubleSide
    if (t.kind === 'sheer') {
      base.transparent = true
      base.opacity = Math.min(base.opacity, 0.5)
      base.depthWrite = false
      base.userData.noShadow = true
    }
    cache.set(key, base)
    m = base
  }
  return m
}

/** Faixa de tecido plissada: a ondulação em z cria as dobras. */
function pleated(width: number, height: number, amp: number, wave = 0.11) {
  const segs = Math.max(8, Math.ceil(width / 0.02))
  const g = new THREE.PlaneGeometry(width, height, segs, 1)
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) pos.setZ(i, amp * Math.sin((pos.getX(i) / wave) * Math.PI * 2))
  g.computeVertexNormals()
  return g
}

interface Props {
  o: ROpening
  t: RTreatment
  thickness: number
  wallHeight: number
  /** lado da parede (+1 = direita, -1 = esquerda) onde a peça fica */
  side: 1 | -1
  lowQuality?: boolean
  onPick?: (p: ScenePick) => void
}

/** Cortina, voil, persiana ou rolô de uma abertura (`treatment` do schema v0.2). */
export function Treatment({ o, t, thickness, wallHeight, side, lowQuality, onPick }: Props) {
  const mat = fabric(t, !!lowQuality)
  const open = Math.min(1, Math.max(0, t.open))
  const { width: w, height: h, sill } = o
  const topY = Math.min(sill + h + 0.14, wallHeight - 0.04)
  const z = side * (thickness / 2 + 0.08)

  const geo = useMemo(() => {
    if (t.kind === 'curtain' || t.kind === 'sheer') {
      const span = w + 0.5
      const pw = THREE.MathUtils.lerp(span / 2 + 0.04, 0.3, open)
      const hh = topY - 0.03
      const amp = THREE.MathUtils.lerp(0.012, 0.045, open)
      const left = pleated(pw, hh, amp)
      left.translate(-span / 2 + pw / 2, 0.02 + hh / 2, 0)
      const right = pleated(pw, hh, amp)
      right.translate(span / 2 - pw / 2, 0.02 + hh / 2, 0)
      return mergeGeometries([left, right], false)
    }
    const cover = Math.max(0.03, (topY - (sill - 0.05)) * (1 - open))
    if (t.kind === 'roller') {
      const g = new THREE.PlaneGeometry(w + 0.06, cover)
      g.translate(0, topY - cover / 2, 0)
      return g
    }
    // persiana: ripas horizontais que recolhem para cima
    const n = Math.max(1, Math.round(cover / 0.045))
    const slats: THREE.BufferGeometry[] = []
    for (let i = 0; i < n; i++) {
      const s = new THREE.BoxGeometry(w + 0.04, 0.036, 0.01)
      s.rotateX(0.35)
      s.translate(0, topY - 0.02 - (i * (cover - 0.04)) / Math.max(1, n - 1), 0)
      slats.push(s)
    }
    return mergeGeometries(slats, false)
  }, [t.kind, w, h, sill, topY, open])

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return
    e.stopPropagation()
    onPick?.({ type: 'opening', id: o.id })
  }

  const drape = t.kind === 'curtain' || t.kind === 'sheer'
  return (
    <group position={[o.offset, 0, z]} onClick={click}>
      <mesh geometry={geo} material={mat} castShadow={t.kind !== 'sheer'} receiveShadow />
      {drape && (
        // varão
        <mesh material={MATS.brass()} position={[0, topY, 0.0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, w + 0.6, 10]} />
        </mesh>
      )}
      {!drape && (
        // caixa do rolô / cabeceira da persiana
        <mesh material={getThreeMaterial(t.material, lowQuality)} position={[0, topY + 0.02, -side * 0.01]} castShadow>
          <boxGeometry args={[w + 0.1, 0.07, 0.07]} />
        </mesh>
      )}
    </group>
  )
}
