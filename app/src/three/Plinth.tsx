import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { simpleMat } from './furniture/parts'

/** Base de "maquete" sob a construção, como no exemplo: placa escura com borda arredondada. */
export function Plinth({ box }: { box: THREE.Box3 }) {
  const { geo, pos } = useMemo(() => {
    const m = 1.1
    const w = box.max.x - box.min.x + m * 2
    const d = box.max.z - box.min.z + m * 2
    const h = 0.5
    const g = new RoundedBoxGeometry(w, h, d, 4, 0.08)
    return { geo: g, pos: [(box.min.x + box.max.x) / 2, -0.19 - h / 2, (box.min.z + box.max.z) / 2] as [number, number, number] }
  }, [box])
  const mat = simpleMat('plinth', { color: '#1b1e25', roughness: 0.42, metalness: 0.25 })
  return <mesh geometry={geo} material={mat} position={pos} receiveShadow />
}
