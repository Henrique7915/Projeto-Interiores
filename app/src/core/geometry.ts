import type { Point2 as Vec2 } from './schema'

type WallLike = { start: Vec2; end: Vec2 }

export const round = (n: number, d = 3) => {
  const f = 10 ** d
  return Math.round(n * f) / f
}
export const dist = (a: Vec2, b: Vec2) => Math.hypot(b[0] - a[0], b[1] - a[1])
export const wallLength = (w: WallLike) => dist(w.start, w.end)
export const wallDir = (w: WallLike): Vec2 => {
  const l = wallLength(w) || 1
  return [(w.end[0] - w.start[0]) / l, (w.end[1] - w.start[1]) / l]
}
/** Normal do lado "left" (exterior em ambientes horários): normalize([dz, -dx]). */
export const wallNormalLeft = (w: WallLike): Vec2 => {
  const [dx, dz] = wallDir(w)
  return [dz, -dx]
}
/** Normal do lado "right" (interior em ambientes horários). */
export const wallNormalRight = (w: WallLike): Vec2 => {
  const [dx, dz] = wallDir(w)
  return [-dz, dx]
}
export const pointOnWall = (w: WallLike, offset: number): Vec2 => {
  const [dx, dz] = wallDir(w)
  return [w.start[0] + dx * offset, w.start[1] + dz * offset]
}
export const wallAngleDeg = (w: WallLike) =>
  (Math.atan2(w.end[1] - w.start[1], w.end[0] - w.start[0]) * 180) / Math.PI

export function bbox(points: Vec2[]) {
  let minX = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxZ = -Infinity
  for (const [x, z] of points) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  return { minX, minZ, maxX, maxZ, width: maxX - minX, depth: maxZ - minZ }
}

/** Área absoluta (m²) pela fórmula do cadarço. */
export function polygonArea(points: Vec2[]): number {
  let a = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, z1] = points[i]
    const [x2, z2] = points[(i + 1) % points.length]
    a += x1 * z2 - x2 * z1
  }
  return Math.abs(a) / 2
}
export function polygonPerimeter(points: Vec2[]): number {
  let p = 0
  for (let i = 0; i < points.length; i++) p += dist(points[i], points[(i + 1) % points.length])
  return p
}
/** Orientação: positivo = horário na vista de cima (X direita, Z baixo). */
export function signedArea(points: Vec2[]): number {
  let a = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, z1] = points[i]
    const [x2, z2] = points[(i + 1) % points.length]
    a += x1 * z2 - x2 * z1
  }
  return a / 2
}
export const ensureClockwise = (points: Vec2[]): Vec2[] => (signedArea(points) < 0 ? [...points].reverse() : points)

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export const rectPoints = (x: number, z: number, w: number, d: number): Vec2[] => [
  [x, z],
  [x + w, z],
  [x + w, z + d],
  [x, z + d],
]

export interface Footprint {
  position: [number, number, number]
  rotationDeg?: number
  /** largura (x local) e profundidade (z local) já resolvidas */
  width: number
  depth: number
}

/** Quatro cantos do retângulo do objeto. Rotação em torno de Y, anti-horária vista de cima (como o Three.js). */
export function footprintCorners(f: Footprint): Vec2[] {
  const r = ((f.rotationDeg ?? 0) * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  const hw = f.width / 2
  const hd = f.depth / 2
  const local: Vec2[] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ]
  return local.map(([lx, lz]) => [f.position[0] + lx * cos + lz * sin, f.position[2] - lx * sin + lz * cos] as Vec2)
}

/** SAT para dois polígonos convexos. Retorna profundidade de sobreposição (>0 se sobrepõem). */
export function overlapDepth(a: Vec2[], b: Vec2[]): number {
  let minOverlap = Infinity
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i]
      const p2 = poly[(i + 1) % poly.length]
      const ax: Vec2 = [-(p2[1] - p1[1]), p2[0] - p1[0]]
      const l = Math.hypot(ax[0], ax[1]) || 1
      const n: Vec2 = [ax[0] / l, ax[1] / l]
      const proj = (pts: Vec2[]) => {
        let mn = Infinity,
          mx = -Infinity
        for (const q of pts) {
          const v = q[0] * n[0] + q[1] * n[1]
          mn = Math.min(mn, v)
          mx = Math.max(mx, v)
        }
        return [mn, mx] as const
      }
      const [a0, a1] = proj(a)
      const [b0, b1] = proj(b)
      const o = Math.min(a1, b1) - Math.max(a0, b0)
      if (o <= 0) return 0
      minOverlap = Math.min(minOverlap, o)
    }
  }
  return minOverlap === Infinity ? 0 : minOverlap
}

export const snap = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v)

/** Distância ponto→segmento e parâmetro t (0..1). */
export function projectOnSegment(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len2 = dx * dx + dz * dz || 1
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2))
  const q: Vec2 = [a[0] + dx * t, a[1] + dz * t]
  return { t, point: q, distance: dist(p, q) }
}
