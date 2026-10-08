import type { ReactElement } from 'react'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Vec3 } from './parts'
import { Box, Cyl, MATS, Sph, simpleMat } from './parts'

/** Dados que cada desenhista recebe. Medidas em metros; origem no centro da base; frente em +Z. */
export interface BuildProps {
  s: Vec3
  /** material pelo nome do slot (do catálogo) */
  m: (slot: string) => THREE.Material
  /** 0..1: quanto a luminária está acesa (já considera light.on e a hora) */
  glow: number
  /** cor da luz em #hex */
  lightColor: string
  /** lúmens, para dimensionar a luz */
  lumens: number
  hasLight: boolean
  /** distância da base até o forro */
  clearance: number
}

const lightIntensity = (lumens: number) => Math.min(4, 0.9 + lumens / 400)

function Glow({ pos, glow, lightColor, lumens, hasLight, distance = 5 }: { pos: Vec3; glow: number; lightColor: string; lumens: number; hasLight: boolean; distance?: number }) {
  if (!hasLight || glow < 0.05) return null
  return <pointLight position={pos} intensity={glow * lightIntensity(lumens)} distance={distance} decay={2} color={lightColor} />
}

const glowCache = new Map<string, THREE.Material>()
/** Cópia do material com brilho (emissive) proporcional a `glow`, compartilhada por degraus de 1/8 */
function useGlowMaterial(base: THREE.Material, glow: number, color: string): THREE.Material {
  return useMemo(() => {
    const q = Math.round(glow * 8)
    const key = base.uuid + ':' + q + ':' + color
    let g = glowCache.get(key)
    if (!g) {
      const c = base.clone() as THREE.MeshPhysicalMaterial
      c.emissive = new THREE.Color(color)
      c.emissiveIntensity = (q / 8) * 1.6
      g = c
      glowCache.set(key, g)
    }
    return g
  }, [base, glow, color])
}

function Sofa3({ s: [w, h, d], m }: BuildProps) {
  const fab = m('upholstery'), acc = m('cushions'), leg = m('legs')
  const legH = 0.12, seatH = 0.2, arm = 0.2, back = 0.22
  const inner = w - arm * 2
  const cw = inner / 3
  return (
    <group>
      {[-1, 1].map((sx) => [-1, 1].map((sz) => (
        <Cyl key={`${sx}${sz}`} r={0.025} rTop={0.018} h={legH} mat={leg} pos={[sx * (w / 2 - 0.1), legH / 2, sz * (d / 2 - 0.1)]} />
      )))}
      <Box size={[w, seatH, d]} pos={[0, legH + seatH / 2, 0]} mat={fab} r={0.06} />
      {[-1, 1].map((sx) => (
        <Box key={sx} size={[arm, h - legH - 0.2, d]} pos={[sx * (w / 2 - arm / 2), legH + 0.2 + (h - legH - 0.2) / 2 - 0.05, 0]} mat={fab} r={0.07} />
      ))}
      <Box size={[inner, h - legH - seatH, back]} pos={[0, legH + seatH + (h - legH - seatH) / 2 - 0.02, -d / 2 + back / 2]} mat={fab} r={0.07} />
      {[0, 1, 2].map((i) => (
        <Box key={i} size={[cw - 0.01, 0.16, d - back - 0.04]} pos={[-inner / 2 + cw / 2 + i * cw, legH + seatH + 0.08, back / 2 + 0.01]} mat={fab} r={0.06} />
      ))}
      <Box size={[0.42, 0.42, 0.14]} pos={[-inner / 2 + 0.3, legH + seatH + 0.3, -d / 2 + back + 0.08]} rot={[-0.2, 0.25, 0.1]} mat={acc} r={0.05} />
      <Box size={[0.42, 0.42, 0.14]} pos={[-inner / 2 + 0.72, legH + seatH + 0.28, -d / 2 + back + 0.07]} rot={[-0.2, -0.15, -0.06]} mat={acc} r={0.05} />
    </group>
  )
}

/** Sofá em L: corpo no fundo + chaise no lado direito (+x) que avança até a frente. */
function SofaL({ s: [w, h, d], m }: BuildProps) {
  const fab = m('upholstery'), acc = m('cushions'), leg = m('legs')
  const legH = 0.12, seatH = 0.2, arm = 0.18, back = 0.22
  const mainD = Math.min(0.98, d * 0.6) // profundidade do corpo principal
  const chaiseW = Math.min(0.95, w * 0.36)
  const topY = legH + seatH
  const mainZ = -d / 2 + mainD / 2
  const chaiseZ = 0, chaiseX = w / 2 - chaiseW / 2
  const seatsW = w - arm - chaiseW
  const n = Math.max(2, Math.round(seatsW / 0.75))
  const cw = seatsW / n
  const bh = h - topY
  return (
    <group>
      {[[-w / 2 + 0.1, -d / 2 + 0.1], [-w / 2 + 0.1, -d / 2 + mainD - 0.1], [w / 2 - 0.1, -d / 2 + 0.1], [w / 2 - 0.1, d / 2 - 0.1], [w / 2 - chaiseW + 0.1, d / 2 - 0.1]].map(([x, z], i) => (
        <Cyl key={i} r={0.025} rTop={0.018} h={legH} mat={leg} pos={[x, legH / 2, z]} />
      ))}
      <Box size={[w - chaiseW, seatH, mainD]} pos={[-chaiseW / 2, legH + seatH / 2, mainZ]} mat={fab} r={0.06} />
      <Box size={[chaiseW, seatH, d]} pos={[chaiseX, legH + seatH / 2, chaiseZ]} mat={fab} r={0.06} />
      <Box size={[arm, bh - 0.05, mainD]} pos={[-w / 2 + arm / 2, topY + (bh - 0.05) / 2, mainZ]} mat={fab} r={0.07} />
      <Box size={[w - arm * 2 + 0.0, bh - 0.02, back]} pos={[0, topY + (bh - 0.02) / 2, -d / 2 + back / 2]} mat={fab} r={0.07} />
      <Box size={[arm, 0.35, d - mainD]} pos={[w / 2 - arm / 2, topY + 0.175, mainD / 2 - mainD / 2 + (d - mainD) / 2 - d / 2 + mainD]} mat={fab} r={0.06} />
      {Array.from({ length: n }, (_, i) => (
        <Box key={i} size={[cw - 0.01, 0.16, mainD - back - 0.03]} pos={[-w / 2 + arm + cw / 2 + i * cw, topY + 0.08, mainZ + back / 2 + 0.01]} mat={fab} r={0.06} />
      ))}
      <Box size={[chaiseW - arm - 0.02, 0.16, d - back - 0.04]} pos={[chaiseX - arm / 2, topY + 0.08, back / 2 + 0.01]} mat={fab} r={0.06} />
      <Box size={[0.45, 0.45, 0.14]} pos={[-w / 2 + arm + 0.35, topY + 0.3, -d / 2 + back + 0.08]} rot={[-0.2, 0.25, 0.1]} mat={acc} r={0.05} />
      <Box size={[0.42, 0.42, 0.14]} pos={[-w / 2 + arm + 0.8, topY + 0.28, -d / 2 + back + 0.07]} rot={[-0.2, -0.15, -0.06]} mat={acc} r={0.05} />
    </group>
  )
}

function Armchair({ s: [w, h, d], m }: BuildProps) {
  const fab = m('upholstery'), wood = m('frame')
  const legH = 0.2
  return (
    <group>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <Cyl key={i} r={0.022} rTop={0.016} h={legH} mat={wood} pos={[sx * (w / 2 - 0.08), legH / 2, sz * (d / 2 - 0.08)]} rot={[sz * 0.15, 0, -sx * 0.15]} />
      ))}
      <Box size={[w, 0.16, d]} pos={[0, legH + 0.08, 0]} mat={wood} r={0.02} />
      <Box size={[w - 0.14, 0.14, d - 0.1]} pos={[0, legH + 0.23, 0.02]} mat={fab} r={0.05} />
      <Box size={[w - 0.1, h - legH - 0.2, 0.14]} pos={[0, legH + 0.2 + (h - legH - 0.2) / 2, -d / 2 + 0.1]} rot={[-0.18, 0, 0]} mat={fab} r={0.05} />
      {[-1, 1].map((sx) => (
        <Box key={sx} size={[0.07, 0.05, d - 0.1]} pos={[sx * (w / 2 - 0.035), legH + 0.4, 0.02]} mat={wood} r={0.015} />
      ))}
      {[-1, 1].map((sx) => (
        <Box key={sx} size={[0.05, 0.24, 0.05]} pos={[sx * (w / 2 - 0.035), legH + 0.29, d / 2 - 0.1]} mat={wood} />
      ))}
    </group>
  )
}

function BedQueen({ s: [w, h, d], m }: BuildProps) {
  const fab = m('bedding'), acc = m('accent'), wood = m('frame')
  const baseH = 0.28
  return (
    <group>
      <Box size={[w + 0.08, baseH, d]} pos={[0, 0.14 + 0.06, 0]} mat={wood} r={0.015} />
      <Box size={[w - 0.04, 0.22, d - 0.08]} pos={[0, baseH + 0.11 + 0.06, 0.02]} mat={fab} r={0.06} />
      <Box size={[w + 0.08, h - 0.1, 0.1]} pos={[0, (h - 0.1) / 2 + 0.05, -d / 2 - 0.02]} mat={wood} r={0.03} />
      {[-1, 1].map((sx) => (
        <Box key={sx} size={[w / 2 - 0.12, 0.14, 0.42]} pos={[sx * (w / 4), baseH + 0.22 + 0.13, -d / 2 + 0.34]} rot={[-0.18, 0, 0]} mat={fab} r={0.06} />
      ))}
      <Box size={[w - 0.04, 0.24, 0.9]} pos={[0, baseH + 0.15, d / 2 - 0.62]} mat={fab} r={0.05} />
      <Box size={[w - 0.02, 0.05, 0.52]} pos={[0, baseH + 0.29, d / 2 - 0.55]} mat={acc} r={0.025} />
    </group>
  )
}

function TableDining({ s: [w, h, d], m }: BuildProps) {
  const top = m('top'), legs = m('legs')
  const th = 0.04, lw = 0.06
  return (
    <group>
      <Box size={[w, th, d]} pos={[0, h - th / 2, 0]} mat={top} r={0.012} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <Box key={i} size={[lw, h - th, lw]} pos={[sx * (w / 2 - 0.08), (h - th) / 2, sz * (d / 2 - 0.08)]} mat={legs} />
      ))}
      <Box size={[w - 0.2, 0.06, 0.04]} pos={[0, h - th - 0.04, d / 2 - 0.08]} mat={legs} />
      <Box size={[w - 0.2, 0.06, 0.04]} pos={[0, h - th - 0.04, -d / 2 + 0.08]} mat={legs} />
    </group>
  )
}

function TableCoffeeRound({ s: [w, h, d], m }: BuildProps) {
  const top = m('top')
  const r = Math.min(w, d) / 2
  return (
    <group>
      <Cyl r={r} h={0.04} pos={[0, h - 0.02, 0]} mat={top} seg={48} />
      <Cyl r={0.04} rTop={0.03} h={h - 0.04} pos={[0, (h - 0.04) / 2, 0]} mat={top} />
      <Cyl r={r * 0.75} h={0.025} pos={[0, 0.0725, 0]} mat={top} seg={48} />
    </group>
  )
}

function ChairDining({ s: [w, h, d], m }: BuildProps) {
  const wood = m('frame'), fab = m('seat')
  const seatH = h * 0.535
  return (
    <group>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <Box key={i} size={[0.04, seatH, 0.04]} pos={[sx * (w / 2 - 0.03), seatH / 2, sz * (d / 2 - 0.03)]} rot={[sz * 0.05, 0, -sx * 0.05]} mat={wood} />
      ))}
      <Box size={[w, 0.04, d]} pos={[0, seatH, 0]} mat={fab} r={0.015} />
      {[-1, 1].map((sx) => (
        <Box key={sx} size={[0.04, h - seatH, 0.04]} pos={[sx * (w / 2 - 0.03), seatH + (h - seatH) / 2, -d / 2 + 0.03]} rot={[-0.1, 0, 0]} mat={wood} />
      ))}
      <Box size={[w - 0.04, 0.1, 0.03]} pos={[0, h - 0.07, -d / 2 - 0.01]} rot={[-0.1, 0, 0]} mat={wood} r={0.01} />
      <Box size={[w - 0.04, 0.08, 0.03]} pos={[0, h - 0.22, -d / 2 + 0.01]} rot={[-0.1, 0, 0]} mat={wood} r={0.01} />
    </group>
  )
}

function ChairOffice({ s: [w, h, d], m }: BuildProps) {
  const fab = m('seat'), frame = m('frame')
  const seatY = h * 0.5
  return (
    <group>
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <group key={i} rotation={[0, a, 0]}>
            <Box size={[0.3, 0.025, 0.04]} pos={[0.15, 0.06, 0]} mat={frame} />
            <Sph r={0.025} pos={[0.3, 0.025, 0]} mat={frame} scale={[1, 1, 1]} />
          </group>
        )
      })}
      <Cyl r={0.025} h={seatY - 0.1} pos={[0, 0.06 + (seatY - 0.1) / 2, 0]} mat={frame} />
      <Box size={[w * 0.82, 0.08, d * 0.8]} pos={[0, seatY, 0.02]} mat={fab} r={0.035} />
      <Box size={[w * 0.78, h * 0.4, 0.07]} pos={[0, seatY + h * 0.24, -d * 0.36]} rot={[-0.12, 0, 0]} mat={fab} r={0.035} />
      {[-1, 1].map((sx) => (
        <Box key={sx} size={[0.03, 0.03, d * 0.45]} pos={[sx * w * 0.42, seatY + 0.2, -0.02]} mat={frame} />
      ))}
    </group>
  )
}

function Bookcase({ s: [w, h, d], m }: BuildProps) {
  const wood = m('body')
  const t = 0.03
  const shelves = Math.max(3, Math.round(h / 0.38))
  const gap = (h - t) / shelves
  const bookMats = [MATS.books(), MATS.books2(), MATS.books3(), MATS.paper()]
  return (
    <group>
      <Box size={[t, h, d]} pos={[-w / 2 + t / 2, h / 2, 0]} mat={wood} />
      <Box size={[t, h, d]} pos={[w / 2 - t / 2, h / 2, 0]} mat={wood} />
      <Box size={[w, h, 0.012]} pos={[0, h / 2, -d / 2 + 0.006]} mat={wood} />
      {Array.from({ length: shelves + 1 }, (_, i) => (
        <Box key={i} size={[w - 2 * t, t, d]} pos={[0, t / 2 + i * gap, 0]} mat={wood} />
      ))}
      {Array.from({ length: shelves }, (_, row) => {
        const books: ReactElement[] = []
        let x = -w / 2 + t + 0.04
        let k = row * 7 + 3
        const limit = w / 2 - t - 0.05 - (row % 3 === 1 ? w * 0.4 : 0)
        while (x < limit) {
          k = (k * 1103515245 + 12345) & 0x7fffffff
          const bw = 0.025 + (k % 20) / 700
          const bh = Math.min(gap * (0.55 + ((k >> 4) % 30) / 100), gap - 0.05)
          books.push(<Box key={x} size={[bw, bh, d * 0.7]} pos={[x + bw / 2, t + row * gap + bh / 2, 0]} mat={bookMats[(k >> 8) % bookMats.length]} cast={false} />)
          x += bw + 0.003
        }
        return <group key={row}>{books}</group>
      })}
    </group>
  )
}

function WallShelf({ s: [w, h, d], m }: BuildProps) {
  const wood = m('body')
  return (
    <group>
      {[0.12, h - 0.05].map((y, i) => (
        <group key={i}>
          <Box size={[w, 0.04, d]} pos={[0, y, 0]} mat={wood} r={0.008} />
          {i === 0 && [0, 1, 2, 3].map((k) => (
            <Box key={k} size={[0.035, 0.22 + (k % 2) * 0.04, d * 0.7]} pos={[-w / 2 + 0.1 + k * 0.045, y + 0.13, 0]} mat={[MATS.books(), MATS.books2(), MATS.books3(), MATS.paper()][k]} cast={false} />
          ))}
          {i === 1 && <Cyl r={0.05} rTop={0.035} h={0.18} pos={[w / 2 - 0.2, y + 0.11, 0]} mat={MATS.pot()} />}
        </group>
      ))}
    </group>
  )
}

function Wardrobe({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), acc = m('doors')
  const doors = Math.max(2, Math.round(w / 0.6))
  const dw = (w - 0.04) / doors
  return (
    <group>
      <Box size={[w, h - 0.08, d]} pos={[0, 0.08 + (h - 0.08) / 2, 0]} mat={body} r={0.01} />
      <Box size={[w - 0.1, 0.08, d - 0.08]} pos={[0, 0.04, 0]} mat={MATS.blackMetal()} />
      {Array.from({ length: doors }, (_, i) => {
        const x = -w / 2 + 0.02 + dw * (i + 0.5)
        return (
          <group key={i}>
            <Box size={[dw - 0.012, h - 0.14, 0.025]} pos={[x, 0.08 + (h - 0.14) / 2 + 0.03, d / 2 + 0.01]} mat={acc} r={0.006} />
            <Box size={[0.015, 0.35, 0.02]} pos={[x + (i % 2 === 0 ? 1 : -1) * (dw / 2 - 0.05), h / 2, d / 2 + 0.035]} mat={MATS.brass()} />
          </group>
        )
      })}
    </group>
  )
}

function Nightstand({ s: [w, h, d], m }: BuildProps) {
  const wood = m('body')
  return (
    <group>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <Cyl key={i} r={0.016} rTop={0.012} h={0.16} mat={wood} pos={[sx * (w / 2 - 0.04), 0.08, sz * (d / 2 - 0.04)]} />
      ))}
      <Box size={[w, h - 0.16, d]} pos={[0, 0.16 + (h - 0.16) / 2, 0]} mat={wood} r={0.012} />
      {[0.73, 0.27].map((f) => (
        <group key={f}>
          <Box size={[w - 0.06, (h - 0.16) / 2 - 0.03, 0.015]} pos={[0, 0.16 + (h - 0.16) * f, d / 2 + 0.002]} mat={wood} />
          <Box size={[0.08, 0.012, 0.014]} pos={[0, 0.16 + (h - 0.16) * f, d / 2 + 0.014]} mat={MATS.brass()} />
        </group>
      ))}
    </group>
  )
}

function Desk({ s: [w, h, d], m }: BuildProps) {
  const top = m('top'), legs = m('legs')
  return (
    <group>
      <Box size={[w, 0.035, d]} pos={[0, h - 0.0175, 0]} mat={top} r={0.01} />
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Box size={[0.03, h - 0.035, d - 0.1]} pos={[sx * (w / 2 - 0.05), (h - 0.035) / 2, 0]} mat={legs} />
          <Box size={[0.03, 0.03, d]} pos={[sx * (w / 2 - 0.05), 0.015, 0]} mat={legs} />
        </group>
      ))}
    </group>
  )
}

function TvUnit({ s: [w, h, d], m }: BuildProps) {
  const wood = m('body')
  return (
    <group>
      {[-1, 1].map((sx) => (
        <Box key={sx} size={[0.035, 0.12, 0.035]} pos={[sx * (w / 2 - 0.08), 0.06, 0]} mat={MATS.blackMetal()} />
      ))}
      <Box size={[w, h - 0.12, d]} pos={[0, 0.12 + (h - 0.12) / 2, 0]} mat={wood} r={0.01} />
      {Array.from({ length: 4 }, (_, i) => (
        <Box key={i} size={[(w - 0.05) / 4 - 0.01, h - 0.18, 0.012]} pos={[-w / 2 + 0.025 + ((w - 0.05) / 4) * (i + 0.5), 0.12 + (h - 0.12) / 2, d / 2 + 0.002]} mat={wood} />
      ))}
    </group>
  )
}

function LampTable(p: BuildProps) {
  const { s: [w, h], m, glow } = p
  const shade = useGlowMaterial(m('shade'), glow, p.lightColor)
  return (
    <group>
      <Cyl r={w * 0.28} h={0.02} pos={[0, 0.01, 0]} mat={m('base')} />
      <Cyl r={0.012} h={h * 0.5} pos={[0, h * 0.25, 0]} mat={m('base')} />
      <Cyl r={w / 2} rTop={w * 0.34} h={h * 0.45} pos={[0, h * 0.72, 0]} mat={shade} cast={glow < 0.05} />
      <Glow {...p} pos={[0, h * 0.72, 0]} distance={4.5} />
    </group>
  )
}

function LampFloor(p: BuildProps) {
  const { s: [w, h], m, glow } = p
  const shade = useGlowMaterial(m('shade'), glow, p.lightColor)
  return (
    <group>
      <Cyl r={w * 0.3} h={0.025} pos={[0, 0.0125, 0]} mat={m('base')} />
      <Cyl r={0.012} h={h - 0.3} pos={[0, (h - 0.3) / 2, 0]} mat={m('base')} />
      <Cyl r={w / 2} rTop={w * 0.35} h={0.3} pos={[0, h - 0.15, 0]} mat={shade} cast={glow < 0.05} />
      <Glow {...p} pos={[0, h - 0.15, 0]} distance={5.5} />
    </group>
  )
}

function LampFloorArc(p: BuildProps) {
  const { s: [w, h, d], m, glow } = p
  const shade = useGlowMaterial(m('shade'), glow, p.lightColor)
  const base = m('base')
  const x0 = -w / 2 + 0.12
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x0, 0.05, 0),
      new THREE.Vector3(x0, h * 0.5, 0),
      new THREE.Vector3(x0 + w * 0.15, h * 0.88, 0),
      new THREE.Vector3(x0 + w * 0.5, h * 0.98, 0),
      new THREE.Vector3(x0 + w * 0.8, h * 0.88, 0),
    ])
    return new THREE.TubeGeometry(curve, 28, 0.013, 8)
  }, [w, h, x0])
  const sx = x0 + w * 0.8
  return (
    <group>
      <Cyl r={Math.min(d, 0.3) / 2} h={0.04} pos={[x0, 0.02, 0]} mat={base} seg={32} />
      <mesh geometry={geo} material={base} castShadow />
      <Cyl r={0.17} rTop={0.03} h={0.22} pos={[sx, h * 0.88 - 0.14, 0]} mat={shade} cast={glow < 0.05} />
      <Glow {...p} pos={[sx, h * 0.88 - 0.2, 0]} distance={6} />
    </group>
  )
}

function PendantDome(p: BuildProps) {
  const { s: [w], m, glow, clearance } = p
  const shadeMat = m('shade')
  const dome = useMemo(() => new THREE.SphereGeometry(w / 2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), [w])
  const bulb = useMemo(() => simpleMat('bulb', { color: '#fff3d6', emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0, roughness: 0.4 }), [])
  bulb.emissiveIntensity = glow * 3
  const h = Math.min(0.26, w / 2)
  return (
    <group>
      <Cyl r={0.006} h={clearance} pos={[0, h + clearance / 2, 0]} mat={MATS.blackMetal()} />
      <mesh geometry={dome} material={shadeMat} scale={[1, h / (w / 2), 1]} castShadow />
      <Sph r={0.045} pos={[0, h * 0.35, 0]} mat={bulb} cast={false} />
      <Glow {...p} pos={[0, h * 0.2, 0]} distance={5} />
    </group>
  )
}

function LampDesk(p: BuildProps) {
  const { s: [w, h], m, glow } = p
  const base = m('base')
  const shade = simpleMat('deskShade', { color: '#2a2b2e', metalness: 0.6, roughness: 0.4, emissive: new THREE.Color('#ffe2b0'), emissiveIntensity: 0 })
  shade.emissiveIntensity = glow * 0.4
  return (
    <group>
      <Cyl r={0.09} h={0.02} pos={[-w * 0.3, 0.01, 0]} mat={base} />
      <Cyl r={0.008} h={h * 0.62} pos={[-w * 0.3, h * 0.31, 0]} mat={base} rot={[0, 0, -0.18]} />
      <Cyl r={0.008} h={h * 0.55} pos={[-w * 0.3 + h * 0.11 + 0.02, h * 0.72, 0]} mat={base} rot={[0, 0, 1.0]} />
      <Cyl r={0.09} rTop={0.03} h={0.12} pos={[w * 0.2, h * 0.86, 0]} mat={shade} rot={[0, 0, 0.35]} />
      <Glow {...p} pos={[w * 0.22, h * 0.78, 0]} distance={3} />
    </group>
  )
}

function RugRect({ s: [w, h, d], m }: BuildProps) {
  return <Box size={[w, h, d]} pos={[0, h / 2, 0]} mat={m('fabric')} r={0.007} cast={false} />
}
function RugRound({ s: [w, h, d], m }: BuildProps) {
  return <group scale={[1, 1, d / w]}><Cyl r={w / 2} h={h} pos={[0, h / 2, 0]} mat={m('fabric')} seg={48} cast={false} /></group>
}

function PlantMonstera({ s: [w, h], m }: BuildProps) {
  const potH = h * 0.22
  const leafMats = [MATS.leaf(), MATS.leaf2()]
  const leaves = Array.from({ length: 11 }, (_, i) => {
    const a = i * 2.399963 // ângulo áureo
    const r = (0.25 + (i % 4) * 0.14) * w * 0.7
    const y = potH + (h - potH) * (0.35 + ((i * 37) % 60) / 100 * 0.65)
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, y, a, s: 0.7 + ((i * 13) % 30) / 100 }
  })
  return (
    <group>
      <Cyl r={w * 0.2} rTop={w * 0.26} h={potH} pos={[0, potH / 2, 0]} mat={m('pot')} />
      <Cyl r={w * 0.23} h={0.01} pos={[0, potH - 0.004, 0]} mat={MATS.soil()} />
      {leaves.map((l, i) => (
        <group key={i}>
          <Cyl r={0.008} h={l.y - potH} pos={[l.x * 0.5, potH + (l.y - potH) / 2, l.z * 0.5]} mat={MATS.leaf()} rot={[l.z * 0.8, 0, -l.x * 0.8]} cast={false} />
          <Sph r={w * 0.24 * l.s} scale={[1, 0.07, 1.25]} pos={[l.x, l.y, l.z]} rot={[0.35, -l.a, 0.15]} mat={leafMats[i % 2]} />
        </group>
      ))}
    </group>
  )
}

function Tree({ s: [w, h, d] }: BuildProps) {
  const trunkH = h * 0.45
  const leaf = [MATS.leaf(), MATS.leaf2(), simpleMat('leaf3', { color: '#356b3a', roughness: 0.85 })]
  // copa feita de várias "nuvens" achatadas, mais natural que uma bola só
  const blobs: [number, number, number, number, number][] = [
    [0, 0.66, 0, 0.34, 0.2], [0.24, 0.58, 0.12, 0.24, 0.17], [-0.22, 0.6, -0.12, 0.25, 0.17], [0.08, 0.82, -0.08, 0.22, 0.15],
    [-0.1, 0.56, 0.24, 0.22, 0.15], [0.16, 0.74, 0.22, 0.18, 0.13], [-0.26, 0.72, 0.1, 0.18, 0.13], [0.3, 0.7, -0.18, 0.17, 0.12],
  ]
  const bark = simpleMat('bark', { color: '#5a4332', roughness: 0.95 })
  return (
    <group>
      <Cyl r={Math.max(0.1, w * 0.04)} rTop={Math.max(0.06, w * 0.022)} h={trunkH} pos={[0, trunkH / 2, 0]} mat={bark} seg={12} />
      <Cyl r={0.025} h={h * 0.2} pos={[w * 0.06, trunkH + h * 0.04, 0]} rot={[0, 0, -0.5]} mat={bark} seg={6} />
      <Cyl r={0.025} h={h * 0.2} pos={[-w * 0.06, trunkH + h * 0.05, w * 0.03]} rot={[0.3, 0, 0.5]} mat={bark} seg={6} />
      {blobs.map(([x, y, z, r, ry], i) => (
        <Sph key={i} r={1} scale={[r * w * 1.5, ry * h * 1.5, r * d * 1.5]} pos={[x * w, y * h, z * d]} mat={leaf[i % 3]} />
      ))}
    </group>
  )
}

function Palm({ s: [w, h] }: BuildProps) {
  const trunkMat = simpleMat('palmTrunk', { color: '#7a6248', roughness: 0.95 })
  const frondMat = [MATS.leaf(), MATS.leaf2()]
  const trunkH = h * 0.78
  const segs = 8
  return (
    <group>
      {Array.from({ length: segs }, (_, i) => {
        const t = i / segs
        return <Cyl key={i} r={0.14 * (1 - t * 0.35)} h={trunkH / segs + 0.01} pos={[Math.sin(t * 1.1) * 0.12 * h * 0.1, (i + 0.5) * (trunkH / segs), 0]} mat={trunkMat} seg={10} />
      })}
      {Array.from({ length: 11 }, (_, i) => {
        const a = (i / 11) * Math.PI * 2
        const len = w * 0.52
        return (
          <group key={i} position={[0.1, trunkH, 0]} rotation={[0, a, 0]}>
            <Sph r={1} scale={[len, 0.03, 0.17]} pos={[len * 0.88, 0.03 - len * 0.2, 0]} rot={[0, 0, -0.55]} mat={frondMat[i % 2]} />
          </group>
        )
      })}
    </group>
  )
}

function Lounger({ s: [w, h, d], m }: BuildProps) {
  const fab = m('fabric'), frame = m('frame')
  const seatY = h * 0.36
  return (
    <group>
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Box size={[0.04, 0.04, d * 0.95]} pos={[sx * (w / 2 - 0.03), seatY - 0.04, 0]} mat={frame} />
          <Box size={[0.04, seatY - 0.04, 0.04]} pos={[sx * (w / 2 - 0.03), (seatY - 0.04) / 2, d / 2 - 0.1]} mat={frame} />
          <Box size={[0.04, seatY - 0.04, 0.04]} pos={[sx * (w / 2 - 0.03), (seatY - 0.04) / 2, -d / 2 + 0.3]} mat={frame} />
        </group>
      ))}
      <Box size={[w - 0.1, 0.07, d * 0.55]} pos={[0, seatY + 0.02, d * 0.2]} mat={fab} r={0.03} />
      <Box size={[w - 0.1, 0.07, d * 0.5]} pos={[0, seatY + d * 0.22, -d * 0.28]} rot={[0.95, 0, 0]} mat={fab} r={0.03} />
    </group>
  )
}

function Umbrella({ s: [w, h], m }: BuildProps) {
  const poleH = h * 0.88
  const canopy = useMemo(() => new THREE.ConeGeometry(w / 2, h * 0.16, 8, 1, true), [w, h])
  return (
    <group>
      <Cyl r={w * 0.14} rTop={w * 0.1} h={0.06} pos={[0, 0.03, 0]} mat={MATS.blackMetal()} seg={24} />
      <Cyl r={0.02} h={poleH} pos={[0, poleH / 2, 0]} mat={m('pole')} />
      <mesh geometry={canopy} material={m('canopy')} position={[0, h - h * 0.08, 0]} castShadow />
    </group>
  )
}

function BoxGeneric({ s: [w, h, d], m }: BuildProps) {
  return <Box size={[w, h, d]} pos={[0, h / 2, 0]} mat={m('body')} r={0.01} />
}

export const BUILDERS: Record<string, (p: BuildProps) => ReactElement> = {
  'sofa-3': Sofa3,
  'sofa-l': SofaL,
  armchair: Armchair,
  'bed-queen': BedQueen,
  'table-dining': TableDining,
  'table-coffee-round': TableCoffeeRound,
  'chair-dining': ChairDining,
  'chair-office': ChairOffice,
  bookcase: Bookcase,
  'wall-shelf': WallShelf,
  wardrobe: Wardrobe,
  nightstand: Nightstand,
  desk: Desk,
  'tv-unit': TvUnit,
  'lamp-table': LampTable,
  'lamp-floor': LampFloor,
  'lamp-floor-arc': LampFloorArc,
  'pendant-dome': PendantDome,
  'lamp-desk': LampDesk,
  'rug-rect': RugRect,
  'rug-round': RugRound,
  'plant-monstera': PlantMonstera,
  tree: Tree,
  palm: Palm,
  lounger: Lounger,
  umbrella: Umbrella,
  box: BoxGeneric,
}
