import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
export type Vec3 = [number, number, number]

/** Reescreve os UVs em metros (projeção pelo eixo dominante da normal), para que
 * a textura mantenha escala real em qualquer peça, independente do tamanho. */
export function metersUV<G extends THREE.BufferGeometry>(g: G): G {
  const pos = g.getAttribute('position')
  const nor = g.getAttribute('normal')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i))
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    if (nx >= ny && nx >= nz) { uv[i * 2] = z; uv[i * 2 + 1] = y }
    else if (ny >= nz) { uv[i * 2] = x; uv[i * 2 + 1] = z }
    else { uv[i * 2] = x; uv[i * 2 + 1] = y }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

const geoCache = new Map<string, THREE.BufferGeometry>()
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined
  if (!g) { g = make(); geoCache.set(key, g) }
  return g
}

const r3 = (n: number) => Math.round(n * 1000) / 1000

interface PartProps {
  pos?: Vec3
  rot?: Vec3
  mat: THREE.Material
  cast?: boolean
  receive?: boolean
}

interface BoxProps extends PartProps {
  size: Vec3
  /** raio de arredondamento das arestas (0 = caixa reta) */
  r?: number
}

export function Box({ size, pos = [0, 0, 0], rot, mat, r = 0, cast = true, receive = true }: BoxProps) {
  const [w, h, d] = size.map(r3) as Vec3
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)
  const geo = useMemo(
    () => cached(`box:${w}:${h}:${d}:${rr}`, () => metersUV(rr > 0.002 ? new RoundedBoxGeometry(w, h, d, 3, rr) : new THREE.BoxGeometry(w, h, d))),
    [w, h, d, rr],
  )
  return <mesh geometry={geo} material={mat} position={pos} rotation={rot} castShadow={cast} receiveShadow={receive} />
}

interface CylProps extends PartProps {
  r: number
  h: number
  rTop?: number
  seg?: number
}

export function Cyl({ r, h, rTop, pos = [0, 0, 0], rot, mat, seg = 32, cast = true, receive = true }: CylProps) {
  const geo = useMemo(
    () => cached(`cyl:${r3(r)}:${r3(h)}:${r3(rTop ?? r)}:${seg}`, () => metersUV(new THREE.CylinderGeometry(rTop ?? r, r, h, seg))),
    [r, h, rTop, seg],
  )
  return <mesh geometry={geo} material={mat} position={pos} rotation={rot} castShadow={cast} receiveShadow={receive} />
}

interface SphProps extends PartProps {
  r: number
  scale?: Vec3
}

export function Sph({ r, scale = [1, 1, 1], pos = [0, 0, 0], rot, mat, cast = true, receive = true }: SphProps) {
  const geo = useMemo(() => cached(`sph:${r3(r)}`, () => metersUV(new THREE.SphereGeometry(r, 24, 16))), [r])
  return <mesh geometry={geo} material={mat} position={pos} rotation={rot} scale={scale} castShadow={cast} receiveShadow={receive} />
}

/** Materiais simples compartilhados (metal, vidro, folhas, cerâmica) */
const simple = new Map<string, THREE.MeshStandardMaterial>()
export function simpleMat(key: string, params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  let m = simple.get(key)
  if (!m) { m = new THREE.MeshStandardMaterial(params); simple.set(key, m) }
  return m
}
export const MATS = {
  brass: () => simpleMat('brass', { color: '#c9a14a', metalness: 0.9, roughness: 0.3 }),
  blackMetal: () => simpleMat('blackMetal', { color: '#1b1c1f', metalness: 0.7, roughness: 0.45 }),
  leaf: () => simpleMat('leaf', { color: '#3d6b3a', roughness: 0.8 }),
  leaf2: () => simpleMat('leaf2', { color: '#4f8247', roughness: 0.8 }),
  pot: () => simpleMat('pot', { color: '#b7a58f', roughness: 0.9 }),
  soil: () => simpleMat('soil', { color: '#2b1f16', roughness: 1 }),
  paper: () => simpleMat('paper', { color: '#f2ead8', roughness: 0.9 }),
  books: () => simpleMat('books', { color: '#8a4a3a', roughness: 0.8 }),
  books2: () => simpleMat('books2', { color: '#3d5a73', roughness: 0.8 }),
  books3: () => simpleMat('books3', { color: '#d7c9a4', roughness: 0.8 }),
}
