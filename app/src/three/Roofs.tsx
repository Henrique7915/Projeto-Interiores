import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Point2 } from '../../../schema/types'
import type { RRoof, RSlabOpening, RObject, RWall } from './render/types'
import { getThreeMaterial } from './materials/three'
import { resolveMaterial } from './materials/library'
import { buildGableEnds, buildRoofGeometry } from './geometry/roof'
import { wallLength } from './geometry/walls'

const GABLE = resolveMaterial('paint/exterior-white')

/** Telhado (kind flat | shed | gable | hip). Não é clicável: quem edita o telhado é o painel, não o clique no 3D. */
export function Roof({ roof, lowQuality }: { roof: RRoof; lowQuality?: boolean }) {
  const geo = useMemo(() => buildRoofGeometry(roof), [roof])
  const ends = useMemo(() => buildGableEnds(roof), [roof])
  const mats = useMemo(
    () => [getThreeMaterial(roof.top, lowQuality), getThreeMaterial(roof.under, lowQuality), getThreeMaterial(roof.under, lowQuality)],
    [roof.top, roof.under, lowQuality],
  )
  return (
    <group position={[0, roof.elevation, 0]}>
      <mesh geometry={geo} material={mats} castShadow receiveShadow />
      {ends && <mesh geometry={ends} material={getThreeMaterial(GABLE, lowQuality)} castShadow receiveShadow />}
    </group>
  )
}

/* ------------------------- vão de laje + guarda-corpo ------------------------- */

const RAIL_H = 1.0
const dist = (p: Point2, q: Point2) => Math.hypot(p[0] - q[0], p[1] - q[1])

function distToSegment(p: Point2, a: Point2, b: Point2) {
  const dx = b[0] - a[0], dz = b[1] - a[1]
  const L2 = dx * dx + dz * dz
  const t = L2 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)) : 0
  return dist(p, [a[0] + t * dx, a[1] + t * dz])
}

/** Ponto onde a escada chega ao andar de cima (na planta), a partir do desenho de cada modelo. */
function stairTop(o: RObject): Point2 {
  const [w, , d] = o.size
  const local: Point2 = o.catalogId === 'stairs/l-shaped' ? [(o.mirror ? -1 : 1) * (w / 2 - 0.05), -d / 2 + Math.min(w, d) / 4] : [0, -d / 2]
  const c = Math.cos(o.rotationY), s = Math.sin(o.rotationY)
  return [o.position[0] + local[0] * c + local[1] * s, o.position[2] - local[0] * s + local[1] * c]
}

/** Arestas do vão que levam guarda-corpo: sem a que encosta numa parede e sem a da saída da escada. */
export function railingEdges(op: RSlabOpening, walls: RWall[], objects: RObject[]): [Point2, Point2][] {
  const poly = op.polygon
  const edges: [Point2, Point2][] = poly.map((p, i) => [p, poly[(i + 1) % poly.length]])
  const tops = objects
    .filter((o) => o.catalogId.startsWith('stairs/') && o.elevation < op.elevation - 0.1 && o.elevation > op.elevation - 8)
    .map(stairTop)
    .filter((t) => poly.some((p, i) => distToSegment(t, p, poly[(i + 1) % poly.length]) < 0.9))
  const exits = new Set<number>()
  for (const t of tops) {
    let best = -1, bd = Infinity
    edges.forEach(([a, b], i) => { const d = distToSegment(t, a, b); if (d < bd) { bd = d; best = i } })
    if (best >= 0) exits.add(best)
  }
  const sameLevel = walls.filter((w) => w.levelId === op.levelId && w.kind !== 'railing' && w.kind !== 'fence')
  return edges.filter(([a, b], i) => {
    if (exits.has(i)) return false
    const mid: Point2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    return !sameLevel.some((w) => {
      const reach = w.thickness / 2 + 0.1
      return wallLength(w) > 0.1 && distToSegment(a, w.a, w.b) < reach && distToSegment(b, w.a, w.b) < reach && distToSegment(mid, w.a, w.b) < reach
    })
  })
}

function railingGeometries(edges: [Point2, Point2][]) {
  const wood: THREE.BufferGeometry[] = []
  const metal: THREE.BufferGeometry[] = []
  const add = (list: THREE.BufferGeometry[], a: Point2, d: Point2, yaw: number, u: number, y: number, size: [number, number, number], off = 0) => {
    const g = new THREE.BoxGeometry(...size)
    const m = new THREE.Matrix4().makeRotationY(yaw)
    // posição = a + d*u + normal*off
    m.setPosition(a[0] + d[0] * u - d[1] * off, y, a[1] + d[1] * u + d[0] * off)
    g.applyMatrix4(m)
    list.push(g)
  }
  for (const [a, b] of edges) {
    const L = dist(a, b)
    if (L < 0.05) continue
    const d: Point2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]
    const yaw = -Math.atan2(b[1] - a[1], b[0] - a[0])
    const posts = Math.max(1, Math.ceil(L / 1.2))
    for (let i = 0; i <= posts; i++) add(metal, a, d, yaw, (L * i) / posts, RAIL_H / 2, [0.05, RAIL_H, 0.05])
    add(wood, a, d, yaw, L / 2, RAIL_H + 0.02, [L, 0.04, 0.08])
    add(metal, a, d, yaw, L / 2, 0.08, [L, 0.025, 0.03])
    const bal = Math.max(1, Math.floor(L / 0.13))
    for (let i = 1; i < bal; i++) add(metal, a, d, yaw, (L * i) / bal, RAIL_H / 2, [0.014, RAIL_H - 0.06, 0.014])
  }
  const join = (l: THREE.BufferGeometry[]) => {
    if (!l.length) return null
    // mergeGeometries exige os mesmos atributos: remove o que a caixa traz a mais (todos iguais), então basta juntar
    return mergeGeometries(l, false)
  }
  return { wood: join(wood), metal: join(metal) }
}

export function SlabRailing({ opening, walls, objects, lowQuality }: { opening: RSlabOpening; walls: RWall[]; objects: RObject[]; lowQuality?: boolean }) {
  const geos = useMemo(() => railingGeometries(railingEdges(opening, walls, objects)), [opening, walls, objects])
  const woodMat = useMemo(() => getThreeMaterial(resolveMaterial('wood/natural-oak'), lowQuality), [lowQuality])
  const metalMat = useMemo(() => getThreeMaterial(resolveMaterial('metal/black-matte'), lowQuality), [lowQuality])
  if (!opening.railing) return null
  return (
    <group position={[0, opening.elevation, 0]}>
      {geos.wood && <mesh geometry={geos.wood} material={woodMat} castShadow receiveShadow />}
      {geos.metal && <mesh geometry={geos.metal} material={metalMat} castShadow receiveShadow />}
    </group>
  )
}
