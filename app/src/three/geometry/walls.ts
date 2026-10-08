import * as THREE from 'three'
import type { Point2 as Vec2 } from '../../../../schema/types'
import type { ROpening, RWall as WallView } from '../render/types'
import { isNotch } from '../adapter/toRender'

type Opening = ROpening

/**
 * Convenções de parede (as do schema):
 *  - o eixo local u vai de `start` (a) para `end` (b); v é a altura; z local é a espessura
 *  - lado direito (`finish.right`) = +z local = normal (-dz, dx)/L; lado esquerdo = -z local
 *  - o mesh é posicionado em `a` com rotation.y = -atan2(dz, dx)
 *  - extremidades em cantos de duas paredes ganham esquadria (mitre) para fechar sem sobreposição
 */

export const wallLength = (w: Pick<WallView, 'a' | 'b'>) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1])
export const wallDir = (w: Pick<WallView, 'a' | 'b'>): Vec2 => {
  const L = wallLength(w) || 1
  return [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L]
}
/** normal do lado direito (+z local), no plano (x, z) */
export const wallNormalRight = (w: Pick<WallView, 'a' | 'b'>): Vec2 => {
  const [dx, dz] = wallDir(w)
  return [-dz, dx]
}

const EPS = 0.02
const same = (p: Vec2, q: Vec2) => Math.hypot(p[0] - q[0], p[1] - q[1]) < EPS

interface End { ext: [number, number] } // extensão de u para os lados z=-t/2 e z=+t/2

/**
 * Para a extremidade `at` (0 = a, 1 = b) da parede, procura exatamente uma outra parede
 * com extremidade no mesmo ponto e calcula a extensão (positiva ou negativa) em cada
 * face para a esquadria.
 */
function mitre(w: WallView, at: 0 | 1, all: WallView[]): End {
  const node = at === 0 ? w.a : w.b
  const others: { w: WallView; dirAway: Vec2 }[] = []
  for (const o of all) {
    if (o.id === w.id || o.levelId !== w.levelId) continue
    if (same(o.a, node)) others.push({ w: o, dirAway: wallDir(o) })
    else if (same(o.b, node)) { const d = wallDir(o); others.push({ w: o, dirAway: [-d[0], -d[1]] }) }
  }
  if (others.length !== 1) return { ext: [0, 0] }
  const o = others[0]

  const dw = wallDir(w)
  const d1: Vec2 = at === 0 ? dw : [-dw[0], -dw[1]] // direção afastando-se do nó
  const d2 = o.dirAway
  // normais "locais" do lado A para a parede w, no sentido de u crescente
  const nA = wallNormalRight(w)
  // normal de w em relação à direção d1 (afastando do nó); sinal para trocar o lado quando at===1
  const flip = at === 0 ? 1 : -1
  const n1: Vec2 = [nA[0] * flip, nA[1] * flip]
  const n2: Vec2 = [-d2[1], d2[0]]
  const dot = (p: Vec2, q: Vec2) => p[0] * q[0] + p[1] * q[1]

  const d1n2 = dot(d1, n2)
  if (Math.abs(d1n2) < 0.2) return { ext: [0, 0] }

  const t1 = w.thickness / 2, t2 = o.w.thickness / 2
  const innerSign1 = Math.sign(dot(n1, d2)) // lado de w voltado para dentro do ângulo
  const innerSign2 = Math.sign(dot(n2, d1))
  const ext = [-1, 1].map((sz) => {
    // sz é o lado de w na convenção de z local (+1 = lado A). Em n1, A corresponde a +flip.
    const s1 = sz * flip * t1
    const isInner = Math.sign(s1) === innerSign1
    const s2 = (isInner ? innerSign2 : -innerSign2) * t2
    return (s2 - s1 * dot(n1, n2)) / d1n2
  }) as [number, number]
  // ext[] está na direção d1 (afastando do nó); a extensão para fora da parede é o oposto
  return { ext: [-ext[0], -ext[1]] }
}

function openingPath(o: Opening) {
  const u0 = o.offset - o.width / 2, u1 = o.offset + o.width / 2
  return { u0, u1, v0: o.sill, v1: o.sill + o.height }
}

export function buildWallGeometry(w: WallView, all: WallView[]): THREE.BufferGeometry {
  const L = wallLength(w)
  const H = w.height
  const t = w.thickness

  const shape = new THREE.Shape()
  // contorno com recortes de porta na base
  const doors = w.openings.filter(isNotch).map(openingPath).sort((p, q) => p.u0 - q.u0)
  shape.moveTo(0, 0)
  for (const d of doors) {
    shape.lineTo(Math.max(0, d.u0), 0)
    shape.lineTo(Math.max(0, d.u0), d.v1)
    shape.lineTo(Math.min(L, d.u1), d.v1)
    shape.lineTo(Math.min(L, d.u1), 0)
  }
  shape.lineTo(L, 0)
  shape.lineTo(L, w.heightEnd)
  shape.lineTo(0, H)
  shape.closePath()
  for (const o of w.openings) {
    if (isNotch(o)) continue
    const p = openingPath(o)
    const hole = new THREE.Path()
    hole.moveTo(p.u0, p.v0)
    hole.lineTo(p.u0, p.v1)
    hole.lineTo(p.u1, p.v1)
    hole.lineTo(p.u1, p.v0)
    hole.closePath()
    shape.holes.push(hole)
  }

  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, steps: 1 })
  geo.translate(0, 0, -t / 2)

  // esquadria: desloca u dos vértices nas extremidades conforme o lado (z)
  const m0 = mitre(w, 0, all).ext
  const m1 = mitre(w, 1, all).ext
  if (m0[0] || m0[1] || m1[0] || m1[1]) {
    const pos = geo.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i)
      const z = pos.getZ(i)
      const side = z > 0 ? 1 : 0 // 0 = z -t/2, 1 = z +t/2
      if (u < 1e-4) pos.setX(i, u - m0[side])
      else if (u > L - 1e-4) pos.setX(i, u + m1[side])
    }
    pos.needsUpdate = true
  }

  // grupos: [0] face -z (esquerda), [1] face +z (direita), [2] bordas/topo/vãos
  const idxCount = geo.getAttribute('position').count
  const g = geo.groups[0]
  // a primeira "tampa" (z=0) vem antes da segunda (z=t) e ambas têm o mesmo nº de vértices
  const capVerts = g.count
  geo.clearGroups()
  geo.addGroup(0, capVerts / 2, 0) // esquerda (z -t/2)
  geo.addGroup(capVerts / 2, capVerts / 2, 1) // direita (z +t/2)
  geo.addGroup(capVerts, idxCount - capVerts, 2)
  geo.computeVertexNormals()
  return geo
}

export function wallTransform(w: WallView): { position: [number, number, number]; rotationY: number } {
  const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1]
  return { position: [w.a[0], 0, w.a[1]], rotationY: -Math.atan2(dz, dx) }
}

/** ponto do plano (x, z) -> dentro do polígono? */
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j]
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}
