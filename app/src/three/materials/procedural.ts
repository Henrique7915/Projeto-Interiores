import * as THREE from 'three'

/** Gerador de texturas procedurais em canvas, sem arquivos externos. */

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Ruído de valor 2D periódico (tileável) com fbm. */
function makeNoise(seed: number, period: number) {
  const rnd = mulberry32(seed)
  const size = period
  const grid = new Float32Array(size * size)
  for (let i = 0; i < grid.length; i++) grid[i] = rnd()
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const at = (x: number, y: number) => grid[(((y % size) + size) % size) * size + (((x % size) + size) % size)]
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const xf = smooth(x - xi), yf = smooth(y - yi)
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1)
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
  }
  return (x: number, y: number, oct = 4) => {
    let v = 0, amp = 0.5, f = 1, norm = 0
    for (let o = 0; o < oct; o++) {
      v += amp * noise(x * f, y * f)
      norm += amp
      amp *= 0.5
      f *= 2
    }
    return v / norm
  }
}

export type TextureKind =
  | 'planks'
  | 'wood'
  | 'marble'
  | 'speckle'
  | 'concrete'
  | 'weave'
  | 'boucle'
  | 'knit'
  | 'leather'
  | 'felt'
  | 'velvet'
  | 'paint'
  | 'limewash'
  | 'tile'
  | 'grass'
  | 'soil'
  | 'gravel'
  | 'deck'

export interface TextureSpec {
  kind: TextureKind
  color: string
  /** segunda cor (veios, fios, juntas) */
  color2?: string
  /** tamanho real de uma repetição [u, v], em metros */
  tile: [number, number]
  rotationDeg?: number
  seed: number
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export interface TexturePair {
  map: THREE.CanvasTexture
  bump: THREE.CanvasTexture
}

/**
 * Cada gerador devolve, por pixel, [mistura 0..1 entre color e color2, altura 0..1].
 * u,v em 0..1 dentro do ladrilho (periódicos).
 */
type Gen = (u: number, v: number, n: ReturnType<typeof makeNoise>, rnd: () => number) => [number, number]

const GENS: Record<string, Gen> = {
  // tábuas de piso: 4 tábuas por ladrilho, veio longitudinal
  planks: (u, v, n) => {
    const planks = 4
    const row = Math.floor(v * planks)
    const off = (row * 0.37) % 1
    const ru = (u + off) % 1
    const rv = v * planks - row
    const grain = n(ru * 3 + row * 11, rv * 40 + row * 7, 4) * 0.7 + n(ru * 12, rv * 90, 2) * 0.3
    const seam = rv < 0.03 || rv > 0.97 ? 1 : 0
    const endSeam = ru < 0.008 || ru > 0.992 ? 1 : 0
    const tone = (Math.sin(row * 12.9) * 0.5 + 0.5) * 0.25
    const m = clamp01(grain * 0.8 + tone - (seam || endSeam ? 0.6 : 0))
    return [m, seam || endSeam ? 0 : 0.6 + grain * 0.4]
  },
  // painel de madeira com veio vertical
  wood: (u, v, n) => {
    const warp = n(u * 4, v * 3, 3) * 0.08
    const grain = n(u * 30 + warp * 20, v * 2.5, 4) * 0.65 + n(u * 90, v * 6, 2) * 0.35
    const ring = Math.sin((u + warp) * Math.PI * 14) * 0.5 + 0.5
    const m = clamp01(grain * 0.6 + ring * 0.4)
    return [m, 0.5 + m * 0.5]
  },
  marble: (u, v, n) => {
    const w = n(u * 3, v * 3, 5)
    const vein = Math.abs(Math.sin((u * 2 + v * 1.3 + w * 2.2) * Math.PI * 2))
    const thin = Math.pow(1 - vein, 14)
    const cloud = n(u * 5 + 9, v * 5, 4) * 0.25
    return [clamp01(thin * 0.85 + cloud), 0.5 + cloud * 0.2]
  },
  speckle: (u, v, n, rnd) => {
    const s = n(u * 50, v * 50, 2)
    const fleck = s > 0.72 ? 1 : 0
    return [clamp01(fleck * 0.9 + n(u * 6, v * 6, 3) * 0.3), 0.5 + (rnd() - 0.5) * 0.15]
  },
  concrete: (u, v, n) => {
    const m = n(u * 8, v * 8, 5)
    return [clamp01(m), 0.45 + n(u * 60, v * 60, 2) * 0.3]
  },
  weave: (u, v, n) => {
    const cells = 90
    const cu = u * cells, cv = v * cells
    const over = (Math.floor(cu) + Math.floor(cv)) % 2 === 0
    const fu = cu - Math.floor(cu), fv = cv - Math.floor(cv)
    const h = over ? Math.sin(fu * Math.PI) : Math.sin(fv * Math.PI)
    return [clamp01(n(u * 20, v * 20, 3) * 0.6 + (over ? 0.15 : 0)), 0.3 + h * 0.6]
  },
  boucle: (u, v, n) => {
    const a = n(u * 70, v * 70, 2)
    const b = n(u * 140 + 3, v * 140, 2)
    const loops = Math.max(0, a * b * 2 - 0.45)
    return [clamp01(loops), clamp01(0.25 + loops * 1.3)]
  },
  knit: (u, v, n) => {
    // pontos de tricô em "V"
    const cols = 14, rows = 18
    const cu = u * cols, cv = v * rows
    const col = Math.floor(cu), fu = cu - col
    const fv = cv - Math.floor(cv)
    const d = Math.abs(fu - 0.5) * 2 // 0 centro, 1 borda
    const vShape = Math.abs(fv - (0.2 + d * 0.6))
    const h = clamp01(1 - vShape * 3.2) * (1 - d * 0.4)
    return [clamp01(0.35 + h * 0.4 + n(u * 40, v * 40, 2) * 0.2), 0.2 + h * 0.8]
  },
  leather: (u, v, n) => {
    const cell = n(u * 60, v * 60, 2)
    const crack = Math.abs(cell - 0.5) < 0.04 ? 1 : 0
    return [clamp01(n(u * 8, v * 8, 3) * 0.6 + crack * 0.2), 0.55 - crack * 0.4 + cell * 0.1]
  },
  felt: (u, v, n) => {
    const f = n(u * 120, v * 120, 2)
    return [clamp01(f * 0.9), 0.4 + f * 0.3]
  },
  velvet: (u, v, n) => {
    const f = n(u * 200, v * 200, 1)
    const sheen = n(u * 3, v * 3, 3)
    return [clamp01(sheen * 0.7 + f * 0.2), 0.45 + f * 0.1]
  },
  paint: (u, v, n) => {
    return [clamp01(n(u * 30, v * 30, 2) * 0.6), 0.5 + n(u * 100, v * 100, 1) * 0.1]
  },
  limewash: (u, v, n) => {
    const c = n(u * 4, v * 4, 5)
    const s = n(u * 22 + 5, v * 5, 3)
    return [clamp01(c * 0.8 + s * 0.3), 0.4 + c * 0.4]
  },
}

GENS.tile = (u, v, n) => {
  const cells = 4
  const fu = (u * cells) % 1, fv = (v * cells) % 1
  const grout = fu < 0.04 || fv < 0.04 ? 1 : 0
  return [clamp01(n(u * 6, v * 6, 2) * 0.35 + grout * 0.6), grout ? 0.1 : 0.7]
}
GENS.grass = (u, v, n) => {
  const blade = n(u * 160, v * 160, 2)
  const patch = n(u * 5, v * 5, 4)
  return [clamp01(patch * 0.7 + blade * 0.3), 0.3 + blade * 0.7]
}
GENS.soil = (u, v, n) => {
  const clod = n(u * 40, v * 40, 3)
  return [clamp01(clod * 0.8), 0.2 + clod * 0.8]
}
GENS.gravel = (u, v, n, rnd) => {
  const g = n(u * 90, v * 90, 2)
  return [clamp01(g > 0.55 ? 0.8 : 0.2 + rnd() * 0.2), 0.2 + g * 0.8]
}
GENS.deck = (u, v, n) => {
  const boards = 6
  const row = Math.floor(v * boards)
  const rv = v * boards - row
  const grain = n(u * 4 + row * 5, rv * 60, 4)
  const gap = rv < 0.04 || rv > 0.96 ? 1 : 0
  const tone = (Math.sin(row * 7.3) * 0.5 + 0.5) * 0.3
  return [clamp01(grain * 0.7 + tone - gap * 0.5), gap ? 0 : 0.6 + grain * 0.4]
}

const cache = new Map<string, TexturePair>()

function colorSpace(t: THREE.Texture, srgb: boolean) {
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  t.generateMipmaps = true
}

export function getTexture(spec: TextureSpec, res = 512): TexturePair {
  const key = JSON.stringify(spec) + res
  const hit = cache.get(key)
  if (hit) return hit

  const gen = GENS[spec.kind]
  const noise = makeNoise(spec.seed, 16)
  const rnd = mulberry32(spec.seed + 1)
  const c1 = hex(spec.color)
  const c2 = spec.color2 ? hex(spec.color2) : mix(c1, [255, 255, 255], 0.28)
  const dark = mix(c1, [0, 0, 0], 0.35)

  const colorCv = document.createElement('canvas')
  const bumpCv = document.createElement('canvas')
  colorCv.width = colorCv.height = bumpCv.width = bumpCv.height = res
  const cctx = colorCv.getContext('2d')!
  const bctx = bumpCv.getContext('2d')!
  const cimg = cctx.createImageData(res, res)
  const bimg = bctx.createImageData(res, res)

  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const [m, h] = gen(x / res, y / res, noise, rnd)
      const base = mix(dark, c1, 0.55 + h * 0.45)
      const col = mix(base, c2, m * (spec.color2 ? 1 : 0.5))
      const i = (y * res + x) * 4
      cimg.data[i] = col[0]
      cimg.data[i + 1] = col[1]
      cimg.data[i + 2] = col[2]
      cimg.data[i + 3] = 255
      const hv = Math.round(clamp01(h) * 255)
      bimg.data[i] = bimg.data[i + 1] = bimg.data[i + 2] = hv
      bimg.data[i + 3] = 255
    }
  }
  cctx.putImageData(cimg, 0, 0)
  bctx.putImageData(bimg, 0, 0)

  const map = new THREE.CanvasTexture(colorCv)
  const bump = new THREE.CanvasTexture(bumpCv)
  colorSpace(map, true)
  colorSpace(bump, false)
  for (const t of [map, bump]) {
    t.repeat.set(1 / spec.tile[0], 1 / spec.tile[1])
    t.rotation = ((spec.rotationDeg ?? 0) * Math.PI) / 180
  }

  const pair = { map, bump }
  cache.set(key, pair)
  return pair
}
