import { useMemo } from 'react'
import * as THREE from 'three'
import type { Point2 } from '../../../schema/types'
import type { ScenePick, RSite, RZone } from './render/types'
import { getThreeMaterial } from './materials/three'
import { Wall } from './Architecture'

interface Props {
  site: RSite
  lowQuality?: boolean
  onPick?: (p: ScenePick) => void
}

const shapeOf = (poly: Point2[]) => new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)))

/** UV em metros (u = x, v = z) para geometrias planas no plano XZ */
function metersUVxz(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i); uv[i * 2 + 1] = pos.getZ(i) }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

function flat(poly: Point2[], holes: Point2[][] = []) {
  const shape = shapeOf(poly)
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))))
  const g = new THREE.ShapeGeometry(shape)
  g.rotateX(-Math.PI / 2)
  return metersUVxz(g)
}

const isPool = (z: RZone) => z.kind === 'pool' || z.kind === 'water'

function Ground({ site, lowQuality, onPick }: Props) {
  const geo = useMemo(() => {
    const pts = site.boundary ?? site.zones.flatMap((z) => z.polygon)
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1])
    const m = 70
    const [x0, x1, z0, z1] = [Math.min(...xs) - m, Math.max(...xs) + m, Math.min(...zs) - m, Math.max(...zs) + m]
    return flat([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], site.zones.filter(isPool).map((z) => z.polygon))
  }, [site])
  return (
    <mesh geometry={geo} position={[0, -0.004, 0]} material={getThreeMaterial(site.ground, lowQuality)} receiveShadow onClick={(e) => { if (e.delta > 4) return; e.stopPropagation(); onPick?.({ type: 'zone', id: '__ground' }) }} />
  )
}

function Zone({ zone, lowQuality, onPick }: { zone: RZone } & Omit<Props, 'site'>) {
  const mat = getThreeMaterial(zone.material, lowQuality)
  const edge = getThreeMaterial(zone.edgeMaterial ?? zone.material, lowQuality)
  const click = (e: { delta: number; stopPropagation: () => void }) => {
    if (e.delta > 4) return
    e.stopPropagation()
    onPick?.({ type: 'zone', id: zone.id })
  }
  const geo = useMemo(() => {
    if (isPool(zone)) return null
    if (zone.elevation >= 0.03) {
      const g = new THREE.ExtrudeGeometry(shapeOf(zone.polygon), { depth: zone.elevation, bevelEnabled: false })
      g.rotateX(-Math.PI / 2)
      return g
    }
    return flat(zone.polygon)
  }, [zone])

  if (!isPool(zone)) {
    if (!geo) return null
    const raised = zone.elevation >= 0.03
    return <mesh geometry={geo} material={raised ? [mat, edge] : mat} position={[0, raised ? 0 : 0.003, 0]} receiveShadow castShadow={raised} onClick={click} />
  }
  return <Pool zone={zone} lowQuality={lowQuality} onClick={click} />
}

function Pool({ zone, lowQuality, onClick }: { zone: RZone; lowQuality?: boolean; onClick: (e: { delta: number; stopPropagation: () => void }) => void }) {
  const depth = zone.depth || 1.2
  const tile = getThreeMaterial(zone.edgeMaterial ? zone.material : zone.material, lowQuality)
  const edgeMat = getThreeMaterial(zone.edgeMaterial ?? zone.material, lowQuality)
  const tileMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#d9eef2', roughness: 0.3, side: THREE.DoubleSide })
    return m
  }, [])
  const poly = zone.polygon
  const floor = useMemo(() => flat(poly), [poly])
  const walls = useMemo(() => {
    const verts: number[] = []
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length]
      verts.push(ax, 0, az, bx, 0, bz, bx, -depth, bz, ax, 0, az, bx, -depth, bz, ax, -depth, az)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    g.computeVertexNormals()
    return g
  }, [poly, depth])
  const coping = useMemo(() => {
    const outer: Point2[] = poly.map(([x, z]) => [x, z])
    const cx = outer.reduce((s, p) => s + p[0], 0) / outer.length, cz = outer.reduce((s, p) => s + p[1], 0) / outer.length
    const grow = (p: Point2, k: number): Point2 => { const dx = p[0] - cx, dz = p[1] - cz, L = Math.hypot(dx, dz) || 1; return [p[0] + (dx / L) * k, p[1] + (dz / L) * k] }
    const g = flat(outer.map((p) => grow(p, 0.35)), [poly])
    return g
  }, [poly])
  return (
    <group onClick={onClick as never}>
      <mesh geometry={walls} material={tileMat} receiveShadow />
      <mesh geometry={floor} position={[0, -depth, 0]} material={tileMat} receiveShadow />
      <mesh geometry={floor} position={[0, -0.12, 0]} material={tile} />
      <mesh geometry={coping} position={[0, 0.012, 0]} material={edgeMat} receiveShadow />
    </group>
  )
}

export function Site({ site, lowQuality, onPick }: Props) {
  return (
    <group>
      <Ground site={site} lowQuality={lowQuality} onPick={onPick} />
      {site.zones.map((z) => <Zone key={z.id} zone={z} lowQuality={lowQuality} onPick={onPick} />)}
      {site.walls.map((w) => <Wall key={w.id} wall={w} all={site.walls} mode="full" perimeter lowQuality={lowQuality} onPick={onPick} />)}
    </group>
  )
}
