import * as THREE from 'three'
export type TimePreset = 'morning' | 'midday' | 'evening' | 'night'
type Vec3 = [number, number, number]

/** Horários dos botões Manhã / Meio-dia / Tarde / Noite (em horas decimais). */
export const TIME_PRESETS: Record<TimePreset, number> = {
  morning: 7.6,
  midday: 12.8,
  evening: 18.5,
  night: 22.2,
}

export const formatTime = (t: number) => {
  const h = Math.floor(t) % 24
  const m = Math.floor((t - Math.floor(t)) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const SUNRISE = 6
const SUNSET = 19.5

export interface Body {
  kind: 'sun' | 'moon'
  /** direção unitária do centro da cena para o astro */
  dir: Vec3
  /** 0..1 progresso ao longo do arco (para o gizmo) */
  p: number
  elevation: number
}

/** Posição do sol (6h–19:30) ou da lua (resto da noite) para a hora t. */
export function bodyAt(t: number, northDeg = 0): Body {
  t = ((t % 24) + 24) % 24
  const isDay = t >= SUNRISE && t <= SUNSET
  let p: number, maxEl: number, kind: Body['kind']
  if (isDay) {
    p = (t - SUNRISE) / (SUNSET - SUNRISE)
    maxEl = 66
    kind = 'sun'
  } else {
    const nt = t < SUNRISE ? t + 24 : t
    p = (nt - SUNSET) / (24 + SUNRISE - SUNSET)
    maxEl = 52
    kind = 'moon'
  }
  const el = Math.sin(Math.PI * p) * THREE.MathUtils.degToRad(maxEl)
  // leste (+x) -> sul-frente (+z) -> oeste (-x); levemente girado para sombras mais interessantes
  const az = THREE.MathUtils.degToRad((1 - 2 * p) * 100 + 18 + northDeg)
  const dir: Vec3 = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)]
  return { kind, dir, p, elevation: el }
}

/** Tempo mais próximo de um ponto do arco, dado um raio no espaço (para arrastar o sol). */
export function timeFromRay(ray: THREE.Ray, center: THREE.Vector3, radius: number, northDeg = 0): number {
  let best = 0, bestD = Infinity
  const v = new THREE.Vector3()
  for (let t = 0; t < 24; t += 0.1) {
    const b = bodyAt(t, northDeg)
    v.set(...b.dir).multiplyScalar(radius).add(center)
    const d = ray.distanceSqToPoint(v)
    if (d < bestD) { bestD = d; best = t }
  }
  return best
}

interface Key {
  h: number
  sun: string
  sunI: number
  sky: string
  ground: string
  hemiI: number
  bg: string
  lamp: number
  exposure: number
  env: number
}

// h em horas; entre as chaves interpolamos linearmente (0 e 24 repetem a noite)
const KEYS: Key[] = [
  { h: 0, sun: '#7f9bff', sunI: 0.6, sky: '#26305e', ground: '#101428', hemiI: 1.0, bg: '#080b16', lamp: 1, exposure: 1.1, env: 0.15 },
  { h: 5, sun: '#8aa0ff', sunI: 0.55, sky: '#2c376a', ground: '#101428', hemiI: 1.0, bg: '#0e1328', lamp: 1, exposure: 1.1, env: 0.15 },
  { h: 6.3, sun: '#ff9a5a', sunI: 1.4, sky: '#f0a678', ground: '#3a2d33', hemiI: 1.0, bg: '#ae7f78', lamp: 0.7, exposure: 1.0, env: 0.35 },
  { h: 7.6, sun: '#ffd0a0', sunI: 2.8, sky: '#a8c4ee', ground: '#6a5c52', hemiI: 1.15, bg: '#8ca5c8', lamp: 0.0, exposure: 1.0, env: 0.7 },
  { h: 12.8, sun: '#fff6ea', sunI: 4.2, sky: '#bcd8ff', ground: '#8a8478', hemiI: 1.15, bg: '#9dbce0', lamp: 0.0, exposure: 0.95, env: 1.0 },
  { h: 17, sun: '#ffd9a8', sunI: 3.4, sky: '#b4cbe8', ground: '#7a6c5d', hemiI: 1.0, bg: '#a0b2c6', lamp: 0.0, exposure: 1.0, env: 0.85 },
  { h: 18.5, sun: '#ff9d4a', sunI: 3.0, sky: '#f0b27e', ground: '#6a4d42', hemiI: 1.2, bg: '#5c4550', lamp: 0.75, exposure: 1.08, env: 0.75 },
  { h: 19.6, sun: '#ff7a4a', sunI: 0.8, sky: '#6a5f9a', ground: '#2c2238', hemiI: 0.95, bg: '#2f2c52', lamp: 1.0, exposure: 1.1, env: 0.3 },
  { h: 21, sun: '#8aa0ff', sunI: 0.6, sky: '#34417a', ground: '#141830', hemiI: 1.0, bg: '#0f1430', lamp: 1.0, exposure: 1.1, env: 0.15 },
  { h: 24, sun: '#7f9bff', sunI: 0.6, sky: '#26305e', ground: '#101428', hemiI: 1.0, bg: '#080b16', lamp: 1, exposure: 1.1, env: 0.15 },
]

export interface Atmosphere {
  sun: THREE.Color
  sunIntensity: number
  sky: THREE.Color
  ground: THREE.Color
  hemiIntensity: number
  bg: THREE.Color
  lamp: number
  exposure: number
  env: number
}

const c = (s: string) => new THREE.Color(s)
export function atmosphereAt(t: number): Atmosphere {
  t = ((t % 24) + 24) % 24
  let i = 0
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= t) i++
  const a = KEYS[i], b = KEYS[i + 1]
  const f = THREE.MathUtils.clamp((t - a.h) / (b.h - a.h), 0, 1)
  const s = f * f * (3 - 2 * f)
  const l = THREE.MathUtils.lerp
  return {
    sun: c(a.sun).lerp(c(b.sun), s),
    sunIntensity: l(a.sunI, b.sunI, s),
    sky: c(a.sky).lerp(c(b.sky), s),
    ground: c(a.ground).lerp(c(b.ground), s),
    hemiIntensity: l(a.hemiI, b.hemiI, s),
    bg: c(a.bg).lerp(c(b.bg), s),
    lamp: l(a.lamp, b.lamp, s),
    exposure: l(a.exposure, b.exposure, s),
    env: l(a.env, b.env, s),
  }
}
