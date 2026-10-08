import * as THREE from 'three'
import type { Point2 } from '../../../../schema/types'
import type { RTerrain } from '../render/types'
import { pointInPolygon } from './walls'

/** Quanto o relevo se estende além do retângulo dos pontos, sempre voltando a 0 na borda. */
export const TERRAIN_MARGIN = 8
/** Distância (m) da área nivelada até o relevo atingir a altura cheia. */
const RAMP = 2

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function distToSegment(px: number, pz: number, a: Point2, b: Point2) {
  const dx = b[0] - a[0], dz = b[1] - a[1]
  const L2 = dx * dx + dz * dz
  const t = L2 ? Math.min(1, Math.max(0, ((px - a[0]) * dx + (pz - a[1]) * dz) / L2)) : 0
  return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz))
}

function distToPolygon(x: number, z: number, poly: Point2[]) {
  if (pointInPolygon([x, z], poly)) return 0
  let d = Infinity
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSegment(x, z, poly[i], poly[(i + 1) % poly.length]))
  return d
}

/** Altura do terreno em (x, z): ponderação pelo inverso da distância, nivelada sob a casa e as zonas, e zerada nas bordas. */
export function terrainHeight(t: RTerrain, x: number, z: number): number {
  const [x0, z0, x1, z1] = t.rect
  const out = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1))
  const fade = 1 - smooth(0, TERRAIN_MARGIN, out)
  if (fade <= 0 || !t.points.length) return 0

  // quanto maior o `smoothing`, mais as colinas se espalham (expoente menor)
  const p = 4 - 2.8 * Math.min(1, Math.max(0, t.smoothing))
  let num = 0, den = 0
  for (const [px, pz, h] of t.points) {
    const d2 = (px - x) ** 2 + (pz - z) ** 2
    if (d2 < 1e-6) { num = h; den = 1; break }
    const w = Math.pow(d2, -p / 2)
    num += w * h
    den += w
  }
  let mask = 1
  for (const poly of t.flat) {
    mask = Math.min(mask, smooth(0, RAMP, distToPolygon(x, z, poly)))
    if (mask === 0) return 0
  }
  return (num / den) * mask * fade
}

function lines(a: number, b: number, step: number, extra: number[]) {
  const set = new Set<number>()
  const n = Math.max(1, Math.round((b - a) / step))
  for (let i = 0; i <= n; i++) set.add(Math.round((a + ((b - a) * i) / n) * 1000) / 1000)
  for (const e of extra) if (e > a && e < b) set.add(Math.round(e * 1000) / 1000)
  const arr = [...set].sort((p, q) => p - q)
  // tira linhas coladas demais (< 5 cm) para não gerar triângulos finos
  return arr.filter((v, i) => i === 0 || i === arr.length - 1 || (v - arr[i - 1] > 0.05 && arr[arr.length - 1] - v > 0.05))
}

/** Malha do relevo; `holes` (piscinas) ficam vazados para o motor desenhar a água. UV em metros. */
export function buildTerrainGeometry(t: RTerrain, holes: Point2[][] = []): THREE.BufferGeometry {
  const [x0, z0, x1, z1] = t.rect
  const X0 = x0 - TERRAIN_MARGIN, X1 = x1 + TERRAIN_MARGIN, Z0 = z0 - TERRAIN_MARGIN, Z1 = z1 + TERRAIN_MARGIN
  const step = Math.max(0.5, Math.max(X1 - X0, Z1 - Z0) / 80)
  const xs = lines(X0, X1, step, holes.flatMap((h) => h.map((p) => p[0])))
  const zs = lines(Z0, Z1, step, holes.flatMap((h) => h.map((p) => p[1])))
  const W = xs.length
  const pos = new Float32Array(W * zs.length * 3)
  const uv = new Float32Array(W * zs.length * 2)
  zs.forEach((z, j) => xs.forEach((x, i) => {
    const k = j * W + i
    pos.set([x, terrainHeight(t, x, z), z], k * 3)
    uv.set([x, z], k * 2)
  }))
  const idx: number[] = []
  for (let j = 0; j < zs.length - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2
      if (holes.some((h) => pointInPolygon([cx, cz], h))) continue
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
