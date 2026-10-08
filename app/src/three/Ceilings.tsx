import { useMemo } from 'react'
import * as THREE from 'three'
import type { Point2 } from '../../../schema/types'
import type { RRoom } from './render/types'
import { getThreeMaterial } from './materials/three'
import { floorGeometry, insetPolygon, shapesWithHoles } from './geometry/polygon'
import { useLampLevel } from './lighting/Lighting'

const SANCA = 0.4 // largura da faixa que fica no pé-direito cheio

/** Material só visível por baixo: o forro some quando a câmera olha de cima. */
function underside(base: THREE.MeshPhysicalMaterial): THREE.MeshPhysicalMaterial {
  const m = base.clone() as THREE.MeshPhysicalMaterial
  m.side = THREE.BackSide
  // o forro é virado para baixo e não recebe a luz do céu: um pouco de brilho próprio imita a luz que volta do piso
  m.emissive = base.color.clone()
  m.emissiveIntensity = 0.5
  return m
}

/**
 * Forro do cômodo: liso (`visible`) ou rebaixado com sanca (`dropHeight`): uma faixa de 35 cm no pé-direito
 * cheio com fita de luz indireta, e o miolo rebaixado. `holes` são os vãos de escada do andar de cima.
 */
export function Ceiling({ room, holes, lowQuality }: { room: RRoom; holes: Point2[][]; lowQuality?: boolean }) {
  const c = room.ceiling!
  const lamp = useLampLevel((s) => s.lamp)
  const y = room.elevation + c.height
  const base = getThreeMaterial(c.material, lowQuality)
  const mat = useMemo(() => underside(base), [base])
  const riserMat = useMemo(() => { const m = underside(base); m.side = THREE.DoubleSide; return m }, [base])
  // a faixa alta da sanca recebe a luz indireta da fita: acende à noite
  const ringMat = useMemo(() => { const m = underside(base); m.emissive = new THREE.Color('#ffd9a0'); return m }, [base])
  ringMat.emissiveIntensity = 0.12 + lamp * 0.9
  const led = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff4dc', emissive: '#ffcf8a', side: THREE.BackSide, roughness: 0.6 }), [])
  led.emissiveIntensity = 0.2 + lamp * 2.5

  const parts = useMemo(() => {
    const drop = c.drop
    const inner = drop > 0.02 ? insetPolygon(room.polygon, SANCA) : null
    if (!inner) return { flat: floorGeometry(shapesWithHoles(room.polygon, holes)), drop: 0 }
    const ledOuter = insetPolygon(room.polygon, SANCA - 0.08)
    const ring = floorGeometry(shapesWithHoles(room.polygon, [inner, ...holes]))
    const panel = floorGeometry(shapesWithHoles(inner, holes))
    const strip = ledOuter ? floorGeometry(shapesWithHoles(ledOuter, [inner])) : null
    // parede interna da sanca (do miolo rebaixado até o forro cheio), virada para dentro do cômodo
    const verts: number[] = []
    const ccw = ((): number => { let a = 0; for (let i = 0; i < inner.length; i++) { const p = inner[i], q = inner[(i + 1) % inner.length]; a += p[0] * q[1] - q[0] * p[1] } return a })() > 0
    for (let i = 0; i < inner.length; i++) {
      const a = inner[i], b = inner[(i + 1) % inner.length]
      const [p, q] = ccw ? [a, b] : [b, a]
      verts.push(p[0], -drop, p[1], q[0], -drop, q[1], q[0], 0, q[1], p[0], -drop, p[1], q[0], 0, q[1], p[0], 0, p[1])
    }
    const riser = new THREE.BufferGeometry()
    riser.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    riser.computeVertexNormals()
    return { flat: null, ring, panel, strip, riser, drop }
  }, [room.polygon, c.drop, holes])

  return (
    <group position={[0, y, 0]}>
      {parts.flat && <mesh geometry={parts.flat} material={mat} />}
      {parts.ring && parts.panel && parts.riser && (
        <>
          <mesh geometry={parts.ring} material={ringMat} />
          <mesh geometry={parts.panel} material={mat} position={[0, -parts.drop, 0]} />
          {parts.strip && <mesh geometry={parts.strip} material={led} position={[0, -0.004, 0]} />}
          <mesh geometry={parts.riser} material={riserMat} />
        </>
      )}
    </group>
  )
}
