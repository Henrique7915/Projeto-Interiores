import * as THREE from 'three'
import polygonClipping from 'polygon-clipping'
import type { Point2 } from '../../../../schema/types'
import { pointInPolygon } from './walls'

/** área com sinal (positiva = anti-horário em x,z "visto de cima" matemático) */
export function signedArea(poly: Point2[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length]
    a += x1 * z2 - x2 * z1
  }
  return a / 2
}

export const centroid = (poly: Point2[]): Point2 => [
  poly.reduce((s, p) => s + p[0], 0) / poly.length,
  poly.reduce((s, p) => s + p[1], 0) / poly.length,
]

/**
 * Recua um polígono simples `d` metros para dentro (esquadria em cada vértice).
 * Devolve null se o recuo o desfaz (cômodo estreito demais).
 */
export function insetPolygon(poly: Point2[], d: number): Point2[] | null {
  const n = poly.length
  if (n < 3) return null
  const ccw = signedArea(poly) > 0
  const out: Point2[] = []
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i + n - 1) % n], p1 = poly[i], p2 = poly[(i + 1) % n]
    const e1: Point2 = [p1[0] - p0[0], p1[1] - p0[1]]
    const e2: Point2 = [p2[0] - p1[0], p2[1] - p1[1]]
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1
    // normal para dentro de cada aresta
    const s = ccw ? 1 : -1
    const n1: Point2 = [(-e1[1] / l1) * s, (e1[0] / l1) * s]
    const n2: Point2 = [(-e2[1] / l2) * s, (e2[0] / l2) * s]
    const bx = n1[0] + n2[0], bz = n1[1] + n2[1]
    const k = 1 + n1[0] * n2[0] + n1[1] * n2[1]
    if (k < 0.05) return null
    out.push([p1[0] + (bx / k) * d, p1[1] + (bz / k) * d])
  }
  if (Math.sign(signedArea(out)) !== Math.sign(signedArea(poly)) || Math.abs(signedArea(out)) < 0.05) return null
  if (out.some((p) => !pointInPolygon(p, poly))) return null
  return out
}

type Ring = [number, number][]

/** `shape` do three a partir de anéis [x,z]; segue a convenção do motor (y do shape = -z) */
export const toShape = (outer: Ring, holes: Ring[]) => {
  const s = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)))
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))))
  return s
}

/**
 * Formas do polígono menos os recortes (vãos de escada). Sem recorte que o toque, é só o polígono.
 * Usa recorte de polígonos para vãos que passam da borda do cômodo.
 */
export function shapesWithHoles(poly: Point2[], holes: Point2[][]): THREE.Shape[] {
  const hits = holes.filter((h) => h.some((p) => pointInPolygon(p, poly)) || poly.some((p) => pointInPolygon(p, h)) || segmentsCross(h, poly))
  if (!hits.length) return [toShape(poly, [])]
  const close = (r: Point2[]): Ring => [...r.map((p) => [p[0], p[1]] as [number, number]), [r[0][0], r[0][1]]]
  const res = polygonClipping.difference([close(poly)], ...hits.map((h) => [close(h)] as [Ring]))
  return res.map((mp) => {
    const [outer, ...inner] = mp
    return toShape(outer.slice(0, -1) as Ring, inner.map((r) => r.slice(0, -1) as Ring))
  })
}

function segmentsCross(a: Point2[], b: Point2[]) {
  const cross = (p: Point2, q: Point2, r: Point2) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  for (let i = 0; i < a.length; i++) {
    const p1 = a[i], p2 = a[(i + 1) % a.length]
    for (let j = 0; j < b.length; j++) {
      const q1 = b[j], q2 = b[(j + 1) % b.length]
      if (cross(p1, p2, q1) * cross(p1, p2, q2) < 0 && cross(q1, q2, p1) * cross(q1, q2, p2) < 0) return true
    }
  }
  return false
}

/** Piso (ShapeGeometry) plano no plano XZ, UV em metros, normal para cima. */
export function floorGeometry(shapes: THREE.Shape[]): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(shapes)
  g.rotateX(-Math.PI / 2)
  const pos = g.getAttribute('position')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i); uv[i * 2 + 1] = pos.getZ(i) }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

/** Bloco extrudido para baixo a partir de y=0 (a laje sob o piso). */
export function slabGeometry(shapes: THREE.Shape[], depth: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  g.translate(0, -depth - 0.002, 0)
  return g
}
