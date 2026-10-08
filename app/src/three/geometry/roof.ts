import * as THREE from 'three'
import type { Point2 } from '../../../../schema/types'
import type { RRoof } from '../render/types'
import { centroid } from './polygon'

/**
 * Telhado do schema v0.2 como malha fechada com três grupos de material:
 *   0 = face de cima (telha), 1 = face de baixo (forro do beiral), 2 = espelho/rufo (bordas) e oitões.
 *
 * O telhado cobre o retângulo orientado pela direção da cumeeira que envolve o polígono, mais o beiral:
 * para plantas retangulares (o caso comum) isso é exato; em L ele cobre o retângulo que a envolve.
 * ridgeDeg: 0 = cumeeira ao longo de +X, 90 = ao longo de -Z. Em "shed" é a direção da descida.
 * A altura `elevation` é a do beiral (embaixo do telhado); a espessura cresce para cima.
 */
export interface RoofFrame {
  /** origem do retângulo e vetores unitários (u ao longo da cumeeira, v atravessando) no plano XZ */
  c: Point2
  u: Point2
  v: Point2
  u0: number
  u1: number
  v0: number
  v1: number
}

export function roofFrame(r: Pick<RRoof, 'polygon' | 'ridgeDeg' | 'overhang'>): RoofFrame {
  const a = (r.ridgeDeg * Math.PI) / 180
  const u: Point2 = [Math.cos(a), -Math.sin(a)]
  const v: Point2 = [Math.sin(a), Math.cos(a)]
  const c = centroid(r.polygon)
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity
  for (const [x, z] of r.polygon) {
    const pu = (x - c[0]) * u[0] + (z - c[1]) * u[1]
    const pv = (x - c[0]) * v[0] + (z - c[1]) * v[1]
    u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); v0 = Math.min(v0, pv); v1 = Math.max(v1, pv)
  }
  return { c, u, v, u0: u0 - r.overhang, u1: u1 + r.overhang, v0: v0 - r.overhang, v1: v1 + r.overhang }
}

type P3 = [number, number, number]

class Mesh {
  pos: number[] = []
  uv: number[] = []
  groups: { start: number; count: number; mat: number }[] = []
  private cur = -1
  begin(mat: number) {
    if (this.cur === mat) return
    this.groups.push({ start: this.pos.length / 3, count: 0, mat })
    this.cur = mat
  }
  tri(mat: number, a: P3, b: P3, c: P3, ua: [number, number], ub: [number, number], uc: [number, number]) {
    this.begin(mat)
    this.pos.push(...a, ...b, ...c)
    this.uv.push(...ua, ...ub, ...uc)
    this.groups[this.groups.length - 1].count += 3
  }
  /** polígono convexo, em ordem anti-horária vista do lado da frente */
  poly(mat: number, pts: P3[], uvOf: (p: P3) => [number, number]) {
    for (let i = 1; i < pts.length - 1; i++) this.tri(mat, pts[0], pts[i], pts[i + 1], uvOf(pts[0]), uvOf(pts[i]), uvOf(pts[i + 1]))
  }
}

export function buildRoofGeometry(r: RRoof): THREE.BufferGeometry {
  const f = roofFrame(r)
  const tan = Math.tan((Math.min(75, Math.max(0, r.pitchDeg)) * Math.PI) / 180)
  const flat = r.kind === 'flat' || tan === 0
  const T = r.thickness
  // ponto no mundo a partir de (u, v, altura relativa ao beiral)
  const W = (u: number, v: number, y: number): P3 => [f.c[0] + u * f.u[0] + v * f.v[0], y, f.c[1] + u * f.u[1] + v * f.v[1]]
  const vc = (f.v0 + f.v1) / 2, uc = (f.u0 + f.u1) / 2
  const halfV = (f.v1 - f.v0) / 2, halfU = (f.u1 - f.u0) / 2

  // altura da face de cima no ponto (u, v) — função "por partes"; as quinas são os vértices abaixo
  const top = (u: number, v: number): number => {
    if (flat) return 0
    if (r.kind === 'shed') return (f.u1 - u) * tan // sobe ao contrário da descida
    if (r.kind === 'gable') return (halfV - Math.abs(v - vc)) * tan
    return Math.min(u - f.u0, f.u1 - u, v - f.v0, f.v1 - v) * tan // hip
  }

  const m = new Mesh()
  const up = (u: number, v: number): P3 => W(u, v, top(u, v) + T)
  const dn = (u: number, v: number): P3 => W(u, v, top(u, v))
  const k = 1 / Math.cos(Math.atan(tan))
  const uvSlope = (u: number, v: number): [number, number] => [u, (flat ? v : r.kind === 'shed' ? u : Math.abs(v - vc)) * (flat ? 1 : k)]

  // facetas da face de cima, em listas de (u, v) por polígono (anti-horário visto de cima, em coordenadas u,v → sentido invertido no mundo)
  type UV = [number, number]
  let facets: UV[][]
  const R = Math.min(halfU, halfV)
  if (flat || r.kind === 'shed') facets = [[[f.u0, f.v0], [f.u1, f.v0], [f.u1, f.v1], [f.u0, f.v1]]]
  else if (r.kind === 'gable') facets = [
    [[f.u0, f.v0], [f.u1, f.v0], [f.u1, vc], [f.u0, vc]],
    [[f.u0, vc], [f.u1, vc], [f.u1, f.v1], [f.u0, f.v1]],
  ]
  else if (halfU >= halfV) facets = [
    [[f.u0, f.v0], [f.u1, f.v0], [f.u1 - R, vc], [f.u0 + R, vc]],
    [[f.u0 + R, vc], [f.u1 - R, vc], [f.u1, f.v1], [f.u0, f.v1]],
    [[f.u0, f.v0], [f.u0 + R, vc], [f.u0, f.v1]],
    [[f.u1, f.v0], [f.u1, f.v1], [f.u1 - R, vc]],
  ]
  else facets = [
    [[f.u0, f.v0], [f.u1, f.v0], [uc, f.v0 + R]],
    [[f.u0, f.v1], [uc, f.v1 - R], [f.u1, f.v1]],
    [[f.u0, f.v0], [uc, f.v0 + R], [uc, f.v1 - R], [f.u0, f.v1]],
    [[f.u1, f.v0], [f.u1, f.v1], [uc, f.v1 - R], [uc, f.v0 + R]],
  ]

  // o mundo espelha u,v → sentido horário; garantimos a normal para cima/baixo testando o produto vetorial
  const facing = (pts: P3[], wantUp: boolean) => {
    const a = new THREE.Vector3(...pts[0]), b = new THREE.Vector3(...pts[1]), c = new THREE.Vector3(...pts[2])
    const n = b.sub(a).cross(c.sub(a))
    return wantUp === n.y > 0
  }
  for (const fc of facets) {
    const topPts = fc.map(([u, v]) => up(u, v))
    const botPts = fc.map(([u, v]) => dn(u, v))
    const uvs = fc.map(([u, v]) => uvSlope(u, v))
    const idx = fc.map((_, i) => i)
    const ordTop = facing(topPts, true) ? idx : [...idx].reverse()
    const ordBot = facing(botPts, false) ? idx : [...idx].reverse()
    for (let i = 1; i < ordTop.length - 1; i++) m.tri(0, topPts[ordTop[0]], topPts[ordTop[i]], topPts[ordTop[i + 1]], uvs[ordTop[0]], uvs[ordTop[i]], uvs[ordTop[i + 1]])
    for (let i = 1; i < ordBot.length - 1; i++) m.tri(1, botPts[ordBot[0]], botPts[ordBot[i]], botPts[ordBot[i + 1]], uvs[ordBot[0]], uvs[ordBot[i]], uvs[ordBot[i + 1]])
  }

  // rufos: faixa vertical de espessura T ao longo do perímetro, seguindo o perfil da face de cima.
  // O perfil só tem quebra nos oitões do telhado de duas águas (cumeeira no meio da aresta).
  const edge = (a: UV, b: UV): UV[] => (!flat && r.kind === 'gable' && Math.abs(a[0] - b[0]) < 1e-6 ? [a, [a[0], vc], b] : [a, b])
  const corners: UV[] = [[f.u0, f.v0], [f.u1, f.v0], [f.u1, f.v1], [f.u0, f.v1]]
  for (let i = 0; i < 4; i++) {
    const pts = edge(corners[i], corners[(i + 1) % 4]).filter((p, j, arr) => j === 0 || Math.hypot(p[0] - arr[j - 1][0], p[1] - arr[j - 1][1]) > 1e-6)
    for (let j = 0; j < pts.length - 1; j++) {
      const [pa, pb] = [pts[j], pts[j + 1]]
      const quad: P3[] = [dn(...pa), dn(...pb), up(...pb), up(...pa)]
      // normal para fora do retângulo
      const midU = (pa[0] + pb[0]) / 2, midV = (pa[1] + pb[1]) / 2
      const out = new THREE.Vector3(...W(midU, midV, 0)).sub(new THREE.Vector3(...W(uc, vc, 0))).setY(0)
      const a = new THREE.Vector3(...quad[0]), b = new THREE.Vector3(...quad[1]), c = new THREE.Vector3(...quad[2])
      const n = b.clone().sub(a).cross(c.clone().sub(a))
      const ordered = n.dot(out) > 0 ? quad : [...quad].reverse()
      m.poly(2, ordered, (p) => [p[0] + p[2], p[1]])
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(m.uv, 2))
  for (const gr of m.groups) g.addGroup(gr.start, gr.count, gr.mat)
  g.computeVertexNormals()
  return g
}

/**
 * Oitões (triângulos de parede sob a cumeeira) das duas extremidades de um telhado de duas águas:
 * dão volume à fachada em vez de deixar o vão aberto. Ficam recuados do beiral.
 */
export function buildGableEnds(r: RRoof): THREE.BufferGeometry | null {
  if (r.kind !== 'gable') return null
  const f = roofFrame(r)
  const tan = Math.tan((r.pitchDeg * Math.PI) / 180)
  if (tan <= 0) return null
  const vc = (f.v0 + f.v1) / 2
  const hv = (f.v1 - f.v0) / 2 - r.overhang
  const W = (u: number, v: number, y: number): P3 => [f.c[0] + u * f.u[0] + v * f.v[0], y, f.c[1] + u * f.u[1] + v * f.v[1]]
  const pos: number[] = []
  const ride = hv * tan
  for (const [u, s] of [[f.u0 + r.overhang, -1], [f.u1 - r.overhang, 1]] as const) {
    const tri: P3[] = [W(u, vc - hv, 0), W(u, vc + hv, 0), W(u, vc, ride)]
    const a = new THREE.Vector3(...tri[0]), b = new THREE.Vector3(...tri[1]), c = new THREE.Vector3(...tri[2])
    const n = b.sub(a).cross(c.sub(a))
    const out = new THREE.Vector3(f.u[0] * s, 0, f.u[1] * s)
    const t2 = n.dot(out) > 0 ? tri : [tri[0], tri[2], tri[1]]
    t2.forEach((p) => pos.push(...p))
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  const uv: number[] = []
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i], pos[i + 1])
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}
