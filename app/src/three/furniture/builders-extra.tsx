import type { ReactElement } from 'react'
import { useMemo } from 'react'
import * as THREE from 'three'
import { Box, Cyl, MATS, Sph, simpleMat } from './parts'
import type { BuildProps } from './builders'
import { Glow, useGlowMaterial } from './glow'

/**
 * Segunda leva de móveis: sala, quarto, cozinha, lavanderia, decoração, luminárias e exterior.
 * Mesmas regras dos outros desenhistas: metros, origem no centro da base, frente em +Z, um material por slot.
 */

const dark = () => simpleMat('darkInset', { color: '#15161a', roughness: 0.7 })
const screenMat = () => simpleMat('screen', { color: '#0b0c10', roughness: 0.15, metalness: 0.3 })
const steel = () => simpleMat('steel', { color: '#b9bcc2', metalness: 0.85, roughness: 0.35 })
const cactusMat = () => simpleMat('cactus', { color: '#3f7a4a', roughness: 0.75 })
const ember = () => simpleMat('ember', { color: '#ff7a1c', emissive: new THREE.Color('#ff5a00'), emissiveIntensity: 1.4, roughness: 0.6 })
const rope = () => simpleMat('rope', { color: '#d8c9a4', roughness: 0.95 })

const corners = (w: number, d: number, inset: number): [number, number][] => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => [x * (w / 2 - inset), z * (d / 2 - inset)])

// ---------------------------------------------------------------- sala e quarto

function SofaChaise({ s: [w, h, d], m }: BuildProps) {
  const fab = m('upholstery'), cush = m('cushions'), legs = m('legs')
  const legH = 0.12, baseH = 0.3, armW = 0.14
  const sd = Math.min(0.95, d * 0.6) // profundidade do corpo do sofá
  const cw = Math.min(0.85, w * 0.4) // largura da chaise
  const zBody = -d / 2 + sd / 2
  const zChaise = -d / 2 + sd + (d - sd) / 2
  const xChaise = w / 2 - cw / 2
  const top = legH + baseH
  const n = Math.max(2, Math.round((w - cw - armW) / 0.7))
  const cwid = (w - cw - armW) / n
  return (
    <group>
      {corners(w, d, 0.1).filter(([x, z]) => !(x < 0 && z > 0)).map(([x, z], i) => <Cyl key={i} r={0.03} rTop={0.022} h={legH} pos={[x, legH / 2, z]} mat={legs} seg={12} />)}
      <Box size={[w, baseH, sd]} pos={[0, legH + baseH / 2, zBody]} mat={fab} r={0.04} />
      <Box size={[cw, baseH, d - sd]} pos={[xChaise, legH + baseH / 2, zChaise]} mat={fab} r={0.04} />
      <Box size={[w, h - top, 0.22]} pos={[0, top + (h - top) / 2, -d / 2 + 0.11]} mat={fab} r={0.06} />
      <Box size={[armW, 0.3, sd - 0.1]} pos={[-w / 2 + armW / 2, top + 0.15, zBody + 0.05]} mat={fab} r={0.05} />
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + armW + cwid * (i + 0.5)
        return (
          <group key={i}>
            <Box size={[cwid - 0.02, 0.14, sd - 0.24]} pos={[x, top + 0.07, zBody + 0.07]} mat={fab} r={0.05} />
            <Box size={[cwid - 0.04, 0.36, 0.15]} pos={[x, top + 0.2, -d / 2 + 0.3]} mat={fab} r={0.06} rot={[-0.18, 0, 0]} />
          </group>
        )
      })}
      <Box size={[cw - 0.02, 0.14, d - sd - 0.02]} pos={[xChaise, top + 0.07, zChaise]} mat={fab} r={0.05} />
      <Box size={[0.4, 0.4, 0.13]} pos={[-w / 2 + armW + 0.3, top + 0.33, zBody + 0.12]} mat={cush} r={0.05} rot={[-0.3, 0.25, 0.1]} />
    </group>
  )
}

function Ottoman({ s: [w, h, d], m }: BuildProps) {
  const fab = m('upholstery'), legs = m('legs')
  const legH = Math.min(0.1, h * 0.25)
  return (
    <group>
      {corners(w, d, 0.07).map(([x, z], i) => <Cyl key={i} r={0.025} rTop={0.018} h={legH} pos={[x, legH / 2, z]} mat={legs} seg={10} />)}
      <Box size={[w, h - legH, d]} pos={[0, legH + (h - legH) / 2, 0]} mat={fab} r={0.07} />
    </group>
  )
}

function TableConsole({ s: [w, h, d], m }: BuildProps) {
  const top = m('top'), legs = m('legs')
  return (
    <group>
      <Box size={[w, 0.035, d]} pos={[0, h - 0.0175, 0]} mat={top} r={0.01} />
      <Box size={[w - 0.12, 0.03, d - 0.08]} pos={[0, 0.2, 0]} mat={top} r={0.008} />
      {corners(w, d, 0.04).map(([x, z], i) => <Box key={i} size={[0.035, h - 0.035, 0.035]} pos={[x, (h - 0.035) / 2, z]} mat={legs} />)}
    </group>
  )
}

function DeskL({ s: [w, h, d], m }: BuildProps) {
  const top = m('top'), legs = m('legs')
  const th = 0.035, arm = Math.min(0.6, d * 0.45)
  const lx = -w / 2 + 0.05, rx = w / 2 - 0.05
  return (
    <group>
      <Box size={[w, th, arm]} pos={[0, h - th / 2, -d / 2 + arm / 2]} mat={top} r={0.008} />
      <Box size={[arm, th, d - arm]} pos={[-w / 2 + arm / 2, h - th / 2, -d / 2 + arm + (d - arm) / 2]} mat={top} r={0.008} />
      {[[lx, -d / 2 + 0.05], [rx, -d / 2 + 0.05], [lx, d / 2 - 0.05], [-w / 2 + arm - 0.05, d / 2 - 0.05]].map(([x, z], i) => (
        <Box key={i} size={[0.045, h - th, 0.045]} pos={[x, (h - th) / 2, z]} mat={legs} />
      ))}
      <Box size={[w - 0.1, 0.18, 0.02]} pos={[0, h - th - 0.12, -d / 2 + 0.04]} mat={legs} />
    </group>
  )
}

function BedBunk({ s: [w, h, d], m }: BuildProps) {
  const frame = m('frame'), bed = m('bedding')
  const p = 0.07
  const lower = 0.32, upper = h * 0.62
  return (
    <group>
      {corners(w, d, p / 2).map(([x, z], i) => <Box key={i} size={[p, h, p]} pos={[x, h / 2, z]} mat={frame} r={0.01} />)}
      {[lower, upper].map((y, i) => (
        <group key={i}>
          <Box size={[w - p, 0.07, d - p]} pos={[0, y, 0]} mat={frame} r={0.01} />
          <Box size={[w - p - 0.04, 0.16, d - p - 0.04]} pos={[0, y + 0.115, 0]} mat={bed} r={0.05} />
        </group>
      ))}
      {/* grade de proteção do beliche de cima */}
      <Box size={[0.03, 0.22, d * 0.6]} pos={[w / 2 - p / 2, upper + 0.2, -d * 0.2]} mat={frame} />
      <Box size={[0.03, 0.22, d * 0.6]} pos={[-w / 2 + p / 2, upper + 0.2, -d * 0.2]} mat={frame} />
      {/* escada na frente */}
      {Array.from({ length: 4 }, (_, i) => <Box key={i} size={[0.03, 0.03, 0.34]} pos={[w / 2 - p / 2 + 0.02, 0.35 + i * (upper - 0.2) / 4, d / 2 - 0.1]} mat={frame} rot={[0, 0, 0]} />)}
    </group>
  )
}

function Crib({ s: [w, h, d], m }: BuildProps) {
  const frame = m('frame'), bed = m('bedding')
  const bars = Math.max(6, Math.round(d / 0.08))
  return (
    <group>
      {corners(w, d, 0.025).map(([x, z], i) => <Box key={i} size={[0.05, h, 0.05]} pos={[x, h / 2, z]} mat={frame} r={0.008} />)}
      <Box size={[w - 0.05, 0.03, d - 0.05]} pos={[0, 0.25, 0]} mat={frame} />
      <Box size={[w - 0.1, 0.1, d - 0.1]} pos={[0, 0.32, 0]} mat={bed} r={0.04} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box size={[0.035, 0.035, d - 0.05]} pos={[s * (w / 2 - 0.025), h - 0.05, 0]} mat={frame} />
          {Array.from({ length: bars }, (_, i) => <Box key={i} size={[0.014, h - 0.4, 0.014]} pos={[s * (w / 2 - 0.025), 0.28 + (h - 0.4) / 2 + 0.1, -d / 2 + 0.06 + (i * (d - 0.12)) / (bars - 1)]} mat={frame} />)}
        </group>
      ))}
      {[-1, 1].map((s) => <Box key={s} size={[w - 0.05, h * 0.55, 0.03]} pos={[0, h * 0.5, s * (d / 2 - 0.025)]} mat={frame} />)}
    </group>
  )
}

function Dresser({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), handle = m('handles')
  const legH = 0.12, bh = h - legH
  const rows = Math.max(3, Math.round(bh / 0.2))
  const rh = bh / rows
  const cols = w > 1.1 ? 2 : 1
  const cw = w / cols
  return (
    <group>
      {corners(w, d, 0.06).map(([x, z], i) => <Cyl key={i} r={0.03} rTop={0.02} h={legH} pos={[x, legH / 2, z]} mat={body} seg={10} />)}
      <Box size={[w, bh, d]} pos={[0, legH + bh / 2, 0]} mat={body} r={0.012} />
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const x = -w / 2 + cw * (c + 0.5), y = legH + rh * (r + 0.5)
          return (
            <group key={`${r}${c}`}>
              <Box size={[cw - 0.025, rh - 0.02, 0.02]} pos={[x, y, d / 2 + 0.004]} mat={body} r={0.006} />
              <Box size={[0.12, 0.014, 0.018]} pos={[x, y + 0.02, d / 2 + 0.025]} mat={handle} />
            </group>
          )
        }),
      )}
    </group>
  )
}

function ShoeCabinet({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), handle = m('handles')
  const legH = 0.1, bh = h - legH
  const n = Math.max(2, Math.round(h / 0.3))
  const rh = bh / n
  return (
    <group>
      <Box size={[w, bh, d]} pos={[0, legH + bh / 2, 0]} mat={body} r={0.01} />
      <Box size={[w - 0.06, legH, d - 0.06]} pos={[0, legH / 2, 0]} mat={dark()} />
      {Array.from({ length: n }, (_, i) => (
        <group key={i}>
          <Box size={[w - 0.03, rh - 0.015, 0.02]} pos={[0, legH + rh * (i + 0.5), d / 2 + 0.004]} mat={body} r={0.006} rot={[i % 2 ? 0 : 0, 0, 0]} />
          <Box size={[w * 0.5, 0.012, 0.012]} pos={[0, legH + rh * (i + 1) - 0.035, d / 2 + 0.022]} mat={handle} />
        </group>
      ))}
    </group>
  )
}

function BenchChest({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), seat = m('seat')
  const bh = h - 0.08
  return (
    <group>
      <Box size={[w, bh, d]} pos={[0, bh / 2, 0]} mat={body} r={0.01} />
      <Box size={[w - 0.04, 0.08, d - 0.03]} pos={[0, h - 0.04, 0]} mat={seat} r={0.03} />
      <Box size={[w - 0.1, 0.012, 0.012]} pos={[0, bh - 0.05, d / 2 + 0.006]} mat={dark()} />
    </group>
  )
}

function ShelfCube({ s: [w, h, d], m }: BuildProps) {
  const body = m('body')
  const cols = Math.max(2, Math.round(w / 0.4)), rows = Math.max(2, Math.round(h / 0.4))
  const t = 0.025
  const cw = w / cols, rh = h / rows
  return (
    <group>
      {Array.from({ length: cols + 1 }, (_, i) => <Box key={`v${i}`} size={[t, h, d]} pos={[-w / 2 + i * cw + (i === cols ? -t / 2 : i === 0 ? t / 2 : 0), h / 2, 0]} mat={body} />)}
      {Array.from({ length: rows + 1 }, (_, j) => <Box key={`h${j}`} size={[w, t, d]} pos={[0, j * rh + (j === rows ? -t / 2 : j === 0 ? t / 2 : 0), 0]} mat={body} />)}
      <Box size={[w - 0.02, h - 0.02, 0.012]} pos={[0, h / 2, -d / 2 + 0.006]} mat={body} />
      {/* alguns livros e objetos nos nichos */}
      {Array.from({ length: rows }, (_, j) => (j % 2 === 0 ? <Box key={`b${j}`} size={[0.2, rh * 0.6, 0.15]} pos={[-w / 2 + cw * 0.5, j * rh + rh * 0.35, 0]} mat={j % 4 === 0 ? MATS.books() : MATS.books2()} r={0.004} /> : null))}
    </group>
  )
}

// ---------------------------------------------------------------- cozinha e lavanderia

function WallCabinet({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), handle = m('handles')
  const n = Math.max(1, Math.round(w / 0.6)), dw = w / n
  return (
    <group>
      <Box size={[w, h, d]} pos={[0, h / 2, 0]} mat={body} r={0.01} />
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + dw * (i + 0.5)
        return (
          <group key={i}>
            <Box size={[dw - 0.014, h - 0.03, 0.02]} pos={[x, h / 2, d / 2 + 0.004]} mat={body} r={0.006} />
            <Box size={[0.012, 0.14, 0.014]} pos={[x + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), 0.12, d / 2 + 0.022]} mat={handle} />
          </group>
        )
      })}
    </group>
  )
}

function KitchenTall({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), handle = m('handles')
  const plinth = 0.1
  const split = h * 0.55
  return (
    <group>
      <Box size={[w - 0.04, plinth, d - 0.06]} pos={[0, plinth / 2, 0]} mat={dark()} />
      <Box size={[w, h - plinth, d]} pos={[0, plinth + (h - plinth) / 2, 0]} mat={body} r={0.01} />
      <Box size={[w - 0.02, split - plinth - 0.015, 0.02]} pos={[0, plinth + (split - plinth) / 2, d / 2 + 0.004]} mat={body} r={0.006} />
      <Box size={[w - 0.02, h - split - 0.015, 0.02]} pos={[0, split + (h - split) / 2, d / 2 + 0.004]} mat={body} r={0.006} />
      <Box size={[0.012, 0.3, 0.014]} pos={[w / 2 - 0.05, split - 0.2, d / 2 + 0.022]} mat={handle} />
      <Box size={[0.012, 0.3, 0.014]} pos={[w / 2 - 0.05, split + 0.2, d / 2 + 0.022]} mat={handle} />
    </group>
  )
}

function KitchenSink({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), top = m('top'), handle = m('handles'), basin = m('basin'), tap = m('tap')
  const plinth = 0.1, topT = 0.04, bh = h - plinth - topT
  const n = Math.max(1, Math.round(w / 0.6)), dw = w / n
  const bw = Math.min(0.55, w * 0.5)
  return (
    <group>
      <Box size={[w - 0.04, plinth, d - 0.06]} pos={[0, plinth / 2, 0]} mat={dark()} />
      <Box size={[w, bh, d]} pos={[0, plinth + bh / 2, 0]} mat={body} r={0.01} />
      <Box size={[w + 0.02, topT, d + 0.02]} pos={[0, h - topT / 2, 0.015]} mat={top} r={0.008} />
      {/* cuba de aço embutida */}
      <Box size={[bw, 0.012, d * 0.62]} pos={[-w * 0.12, h + 0.001, 0.02]} mat={basin} r={0.004} cast={false} />
      <Box size={[bw - 0.08, 0.014, d * 0.62 - 0.08]} pos={[-w * 0.12, h + 0.002, 0.02]} mat={dark()} r={0.003} cast={false} />
      {/* torneira */}
      <Cyl r={0.013} h={0.28} pos={[-w * 0.12, h + 0.14, -d / 2 + 0.08]} mat={tap} seg={12} />
      <Cyl r={0.011} h={0.16} pos={[-w * 0.12, h + 0.28, -d / 2 + 0.16]} mat={tap} rot={[Math.PI / 2, 0, 0]} seg={12} />
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + dw * (i + 0.5)
        return (
          <group key={i}>
            <Box size={[dw - 0.014, bh - 0.03, 0.02]} pos={[x, plinth + bh / 2, d / 2 + 0.004]} mat={body} r={0.006} />
            <Box size={[0.012, 0.16, 0.014]} pos={[x + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), h - topT - 0.14, d / 2 + 0.022]} mat={handle} />
          </group>
        )
      })}
    </group>
  )
}

function RangeHood({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), glass = m('glass')
  return (
    <group>
      <Box size={[w, 0.06, d]} pos={[0, 0.03, 0]} mat={body} r={0.01} />
      <Box size={[w - 0.04, 0.02, d - 0.08]} pos={[0, 0.005, 0.01]} mat={glass} cast={false} />
      {/* chaminé que sobe até o teto/parede */}
      <Box size={[w * 0.4, h - 0.06, d * 0.5]} pos={[0, 0.06 + (h - 0.06) / 2, -d * 0.25]} mat={body} r={0.008} />
    </group>
  )
}

function Washer({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), door = m('door')
  const r = Math.min(w, h) * 0.33
  return (
    <group>
      <Box size={[w, h, d]} pos={[0, h / 2, 0]} mat={body} r={0.015} />
      <Cyl r={r} h={0.03} pos={[0, h * 0.42, d / 2 + 0.006]} mat={steel()} rot={[Math.PI / 2, 0, 0]} seg={36} />
      <Cyl r={r * 0.82} h={0.034} pos={[0, h * 0.42, d / 2 + 0.01]} mat={door} rot={[Math.PI / 2, 0, 0]} seg={36} cast={false} />
      <Box size={[w - 0.1, 0.07, 0.02]} pos={[0, h - 0.09, d / 2 + 0.004]} mat={dark()} />
      <Cyl r={0.018} h={0.016} pos={[w * 0.3, h - 0.09, d / 2 + 0.018]} mat={steel()} rot={[Math.PI / 2, 0, 0]} seg={16} />
    </group>
  )
}

function Microwave({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), glass = m('glass')
  return (
    <group>
      <Box size={[w, h, d]} pos={[0, h / 2, 0]} mat={body} r={0.012} />
      <Box size={[w * 0.66, h - 0.07, 0.012]} pos={[-w * 0.13, h / 2, d / 2 + 0.003]} mat={glass} cast={false} />
      <Box size={[w * 0.2, h - 0.07, 0.012]} pos={[w * 0.37, h / 2, d / 2 + 0.003]} mat={dark()} />
      <Box size={[0.012, h - 0.1, 0.02]} pos={[w * 0.2, h / 2, d / 2 + 0.012]} mat={steel()} />
    </group>
  )
}

function TvFlat({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), screen = m('screen')
  return (
    <group>
      <Box size={[w, h, d]} pos={[0, h / 2, 0]} mat={body} r={0.006} />
      <Box size={[w - 0.03, h - 0.03, 0.004]} pos={[0, h / 2, d / 2 + 0.0005]} mat={screen} cast={false} />
    </group>
  )
}

function AcSplit({ s: [w, h, d], m }: BuildProps) {
  const body = m('body')
  return (
    <group>
      <Box size={[w, h, d]} pos={[0, h / 2, 0]} mat={body} r={0.04} />
      <Box size={[w - 0.1, 0.03, 0.02]} pos={[0, h * 0.3, d / 2 + 0.002]} mat={dark()} />
      <Box size={[w * 0.1, 0.012, 0.012]} pos={[w * 0.36, h * 0.75, d / 2 + 0.005]} mat={dark()} />
    </group>
  )
}

// ---------------------------------------------------------------- banheiro

function PedestalSink({ s: [w, h, d], m }: BuildProps) {
  const cer = m('ceramic'), tap = m('tap')
  const bowl = 0.17
  return (
    <group>
      <Cyl r={0.07} rTop={0.055} h={h - bowl - 0.02} pos={[0, (h - bowl - 0.02) / 2, -d * 0.1]} mat={cer} seg={20} />
      <Cyl r={0.12} h={0.03} pos={[0, 0.015, -d * 0.1]} mat={cer} seg={24} />
      <Box size={[w, bowl, d]} pos={[0, h - bowl / 2, 0]} mat={cer} r={0.07} />
      <Box size={[w - 0.12, 0.012, d - 0.12]} pos={[0, h + 0.001, 0.02]} mat={simpleMat('basinWell', { color: '#d9e2e6', roughness: 0.2 })} r={0.05} cast={false} />
      <Cyl r={0.011} h={0.14} pos={[0, h + 0.07, -d / 2 + 0.07]} mat={tap} seg={12} />
      <Cyl r={0.009} h={0.09} pos={[0, h + 0.14, -d / 2 + 0.11]} mat={tap} rot={[Math.PI / 2, 0, 0]} seg={12} />
    </group>
  )
}

function TowelRail({ s: [w, h, d], m }: BuildProps) {
  const metal = m('metal'), towel = m('towel')
  return (
    <group>
      {[-1, 1].map((s) => <Box key={s} size={[0.02, h, 0.02]} pos={[s * (w / 2 - 0.01), h / 2, -d / 2 + 0.01]} mat={metal} />)}
      {Array.from({ length: 4 }, (_, i) => <Cyl key={i} r={0.008} h={w - 0.02} pos={[0, 0.12 + i * ((h - 0.2) / 3), -d / 2 + 0.05]} mat={metal} rot={[0, 0, Math.PI / 2]} seg={10} />)}
      {[-1, 1].map((s) => <Box key={`a${s}`} size={[0.016, 0.016, 0.05]} pos={[s * (w / 2 - 0.01), h * 0.5, -d / 2 + 0.025]} mat={metal} />)}
      <Box size={[w * 0.8, h * 0.4, 0.035]} pos={[0, h * 0.58, -d / 2 + 0.065]} mat={towel} r={0.012} />
    </group>
  )
}

// ---------------------------------------------------------------- decoração

function Vase({ s: [w, h], m }: BuildProps) {
  const cer = m('ceramic'), stem = m('foliage')
  const prof = useMemo(() => {
    const pts = [[0.001, 0], [0.55, 0.0], [0.9, 0.25], [1, 0.5], [0.7, 0.8], [0.4, 0.92], [0.5, 1]].map(([r, y]) => new THREE.Vector2((r * w) / 2, y * h * 0.6))
    return new THREE.LatheGeometry(pts, 28)
  }, [w, h])
  return (
    <group>
      <mesh geometry={prof} material={cer} castShadow receiveShadow />
      {[-0.25, 0, 0.3].map((a, i) => (
        <Cyl key={i} r={0.004} h={h * 0.55} pos={[Math.sin(a) * 0.08, h * 0.6 + (h * 0.5 * Math.cos(a)) / 2 - h * 0.05, 0]} mat={stem} rot={[0, 0, -a]} seg={6} />
      ))}
      {[-0.25, 0, 0.3].map((a, i) => <Sph key={`l${i}`} r={0.04} scale={[1, 1.6, 0.4]} pos={[Math.sin(a) * (h * 0.5 + 0.02) , h * 0.6 + h * 0.5 * Math.cos(a) - h * 0.05, 0]} mat={stem} rot={[0, 0, -a]} />)}
    </group>
  )
}

function WallClock({ s: [w, , d], m }: BuildProps) {
  const frame = m('frame'), face = m('face')
  const r = w / 2
  return (
    <group>
      <Cyl r={r} h={d} pos={[0, r, 0]} mat={frame} rot={[Math.PI / 2, 0, 0]} seg={48} />
      <Cyl r={r * 0.9} h={d + 0.004} pos={[0, r, 0.002]} mat={face} rot={[Math.PI / 2, 0, 0]} seg={48} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return <Box key={i} size={[0.008, i % 3 === 0 ? 0.04 : 0.022, 0.004]} pos={[Math.sin(a) * r * 0.78, r + Math.cos(a) * r * 0.78, d / 2 + 0.003]} rot={[0, 0, -a]} mat={dark()} cast={false} />
      })}
      <Box size={[0.008, r * 0.5, 0.006]} pos={[-r * 0.1, r + r * 0.2, d / 2 + 0.006]} rot={[0, 0, 0.4]} mat={dark()} cast={false} />
      <Box size={[0.006, r * 0.72, 0.006]} pos={[r * 0.18, r + r * 0.28, d / 2 + 0.008]} rot={[0, 0, -0.5]} mat={dark()} cast={false} />
    </group>
  )
}

function MirrorRound({ s: [w, , d], m }: BuildProps) {
  const frame = m('frame')
  const r = w / 2
  const ring = useMemo(() => new THREE.TorusGeometry(r, 0.018, 10, 56), [r])
  return (
    <group>
      <mesh geometry={ring} material={frame} position={[0, r, d / 2]} castShadow />
      <Cyl r={r} h={d * 0.6} pos={[0, r, 0]} mat={simpleMat('mirror', { color: '#cfdde6', metalness: 0.35, roughness: 0.06 })} rot={[Math.PI / 2, 0, 0]} seg={56} cast={false} />
    </group>
  )
}

function Fireplace({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), mantel = m('mantel')
  const ow = w * 0.5, oh = h * 0.42
  return (
    <group>
      <Box size={[w, h, d]} pos={[0, h / 2, 0]} mat={body} r={0.01} />
      <Box size={[w + 0.12, 0.06, d + 0.1]} pos={[0, h * 0.78, 0.03]} mat={mantel} r={0.01} />
      <Box size={[ow, oh, 0.05]} pos={[0, 0.1 + oh / 2, d / 2 + 0.002]} mat={dark()} />
      <Box size={[ow - 0.1, 0.08, 0.04]} pos={[0, 0.1 + 0.04, d / 2 + 0.01]} mat={ember()} cast={false} />
      <Sph r={0.1} scale={[1.4, 0.5, 0.6]} pos={[-ow * 0.2, 0.2, d / 2 + 0.02]} mat={ember()} cast={false} />
      <Box size={[w, 0.08, d + 0.03]} pos={[0, 0.04, 0.012]} mat={body} />
    </group>
  )
}

// ---------------------------------------------------------------- luminárias

function Chandelier(p: BuildProps) {
  const { s: [w, h], m, glow, clearance } = p
  const metal = m('arms')
  const bulb = useMemo(() => simpleMat('chandBulb', { color: '#fff3d6', emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0, roughness: 0.4 }), [])
  bulb.emissiveIntensity = glow * 3
  const n = 6
  return (
    <group>
      <Cyl r={0.006} h={clearance} pos={[0, h + clearance / 2, 0]} mat={MATS.blackMetal()} />
      <Sph r={0.05} pos={[0, h * 0.5, 0]} mat={metal} />
      <Cyl r={0.012} h={h * 0.5} pos={[0, h * 0.75, 0]} mat={metal} seg={8} />
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        const x = Math.sin(a) * w * 0.42, z = Math.cos(a) * w * 0.42
        return (
          <group key={i}>
            <Cyl r={0.006} h={w * 0.42} pos={[x / 2, h * 0.42, z / 2]} mat={metal} rot={[Math.PI / 2 - 0, 0, 0]} seg={6} />
            <Box size={[0.012, 0.012, w * 0.43]} pos={[x / 2, h * 0.45, z / 2]} mat={metal} rot={[0, a, 0]} />
            <Cyl r={0.018} h={0.05} pos={[x, h * 0.5, z]} mat={metal} seg={10} />
            <Sph r={0.028} scale={[1, 1.3, 1]} pos={[x, h * 0.5 + 0.055, z]} mat={bulb} cast={false} />
          </group>
        )
      })}
      <Glow {...p} pos={[0, h * 0.45, 0]} distance={6} />
    </group>
  )
}

function WallSconce(p: BuildProps) {
  const { s: [w, h, d], m, glow } = p
  const base = m('base')
  const shade = useGlowMaterial(m('shade'), glow, p.lightColor)
  return (
    <group>
      <Box size={[0.07, h * 0.55, 0.02]} pos={[0, h * 0.5, -d / 2 + 0.01]} mat={base} r={0.006} />
      <Box size={[0.02, 0.02, d * 0.5]} pos={[0, h * 0.45, -d / 2 + d * 0.25]} mat={base} />
      <Cyl r={w / 2} rTop={w * 0.34} h={h * 0.5} pos={[0, h * 0.7, -d / 2 + d * 0.6]} mat={shade} cast={glow < 0.05} />
      <Glow {...p} pos={[0, h * 0.7, -d / 2 + d * 0.6]} distance={4} />
    </group>
  )
}

function CeilingFlush(p: BuildProps) {
  const { s: [w, h], m, glow } = p
  const base = m('base')
  const shade = useGlowMaterial(m('shade'), glow, p.lightColor)
  const dome = useMemo(() => new THREE.SphereGeometry(w / 2, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), [w])
  return (
    <group>
      <Cyl r={w * 0.48} h={0.02} pos={[0, h - 0.01, 0]} mat={base} seg={36} />
      <mesh geometry={dome} material={shade} position={[0, h - 0.02, 0]} rotation={[Math.PI, 0, 0]} scale={[1, (h - 0.02) / (w / 2), 1]} castShadow={glow < 0.05} />
      <Glow {...p} pos={[0, h * 0.4, 0]} distance={5.5} />
    </group>
  )
}

// ---------------------------------------------------------------- exterior

function GardenBench({ s: [w, h, d], m }: BuildProps) {
  const frame = m('frame'), slats = m('slats')
  const seatH = h * 0.5
  const n = 4
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box size={[0.05, seatH, d]} pos={[s * (w / 2 - 0.06), seatH / 2, 0]} mat={frame} />
          <Box size={[0.05, h - seatH * 0.8, 0.05]} pos={[s * (w / 2 - 0.06), seatH * 0.8 + (h - seatH * 0.8) / 2, -d / 2 + 0.06]} mat={frame} rot={[-0.2, 0, 0]} />
          <Box size={[0.06, 0.04, d]} pos={[s * (w / 2 - 0.06), seatH * 0.95, 0]} mat={frame} />
        </group>
      ))}
      {Array.from({ length: n }, (_, i) => <Box key={`s${i}`} size={[w, 0.03, (d - 0.04) / n - 0.012]} pos={[0, seatH, -d / 2 + 0.1 + (i * (d - 0.12)) / (n - 1)]} mat={slats} r={0.006} />)}
      {Array.from({ length: 3 }, (_, i) => <Box key={`b${i}`} size={[w, 0.08, 0.025]} pos={[0, seatH + 0.18 + i * 0.12, -d / 2 + 0.06 - i * 0.02]} mat={slats} r={0.006} rot={[-0.2, 0, 0]} />)}
    </group>
  )
}

function GardenChair({ s: [w, h, d], m }: BuildProps) {
  const frame = m('frame'), seat = m('seat')
  const seatH = h * 0.5
  return (
    <group>
      {corners(w, d, 0.035).map(([x, z], i) => <Box key={i} size={[0.035, seatH, 0.035]} pos={[x, seatH / 2, z]} mat={frame} />)}
      {[-1, 1].map((s) => <Box key={s} size={[0.04, h - seatH, 0.04]} pos={[s * (w / 2 - 0.035), seatH + (h - seatH) / 2, -d / 2 + 0.05]} mat={frame} rot={[-0.14, 0, 0]} />)}
      <Box size={[w - 0.02, 0.04, d - 0.04]} pos={[0, seatH, 0]} mat={seat} r={0.012} />
      <Box size={[w - 0.1, h * 0.28, 0.035]} pos={[0, h * 0.8, -d / 2 + 0.05]} mat={seat} r={0.012} rot={[-0.14, 0, 0]} />
      {[-1, 1].map((s) => <Box key={s} size={[0.04, 0.035, d - 0.1]} pos={[s * (w / 2 - 0.02), seatH + 0.2, 0]} mat={frame} />)}
    </group>
  )
}

function FirePit({ s: [w, h], m }: BuildProps) {
  const body = m('body')
  const r = w / 2
  const stones = 16
  return (
    <group>
      {Array.from({ length: stones }, (_, i) => {
        const a = (i / stones) * Math.PI * 2
        return <Box key={i} size={[0.2, h * 0.5, 0.16]} pos={[Math.sin(a) * (r - 0.08), h * 0.25, Math.cos(a) * (r - 0.08)]} rot={[0, a, 0]} mat={body} r={0.02} />
      })}
      {Array.from({ length: stones }, (_, i) => {
        const a = ((i + 0.5) / stones) * Math.PI * 2
        return <Box key={`u${i}`} size={[0.2, h * 0.45, 0.16]} pos={[Math.sin(a) * (r - 0.08), h * 0.72, Math.cos(a) * (r - 0.08)]} rot={[0, a, 0]} mat={body} r={0.02} />
      })}
      <Cyl r={r - 0.14} h={0.05} pos={[0, h * 0.4, 0]} mat={simpleMat('ash', { color: '#2a2a2c', roughness: 1 })} seg={32} />
      <Sph r={0.1} scale={[1, 1.5, 1]} pos={[0, h * 0.5, 0]} mat={ember()} cast={false} />
      <Sph r={0.07} scale={[1, 1.8, 1]} pos={[0.12, h * 0.46, 0.05]} mat={ember()} cast={false} />
    </group>
  )
}

function PlanterBox({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), foliage = m('foliage')
  const n = Math.max(2, Math.round(w / 0.4))
  return (
    <group>
      <Box size={[w, h, d]} pos={[0, h / 2, 0]} mat={body} r={0.012} />
      <Box size={[w - 0.1, 0.02, d - 0.1]} pos={[0, h + 0.002, 0]} mat={MATS.soil()} cast={false} />
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + (w * (i + 0.5)) / n
        return <Sph key={i} r={Math.min(0.2, d * 0.55)} scale={[1, 0.85, 1]} pos={[x, h + 0.12, (i % 2 ? 0.04 : -0.04)]} mat={foliage} />
      })}
    </group>
  )
}

function Pergola({ s: [w, h, d], m }: BuildProps) {
  const frame = m('frame')
  const p = 0.12
  const slats = Math.max(5, Math.round(w / 0.3))
  return (
    <group>
      {corners(w, d, p / 2).map(([x, z], i) => <Box key={i} size={[p, h, p]} pos={[x, h / 2, z]} mat={frame} r={0.008} />)}
      {[-1, 1].map((s) => <Box key={s} size={[0.1, 0.18, d]} pos={[s * (w / 2 - p / 2), h - 0.09, 0]} mat={frame} r={0.008} />)}
      {Array.from({ length: slats }, (_, i) => <Box key={i} size={[0.06, 0.08, d + 0.3]} pos={[-w / 2 + 0.05 + (i * (w - 0.1)) / (slats - 1), h + 0.02, 0]} mat={frame} r={0.005} />)}
      {[-1, 1].map((s) => <Box key={`f${s}`} size={[w, 0.1, 0.06]} pos={[0, h - 0.2, s * (d / 2 - p / 2)]} mat={frame} />)}
    </group>
  )
}

function Hammock({ s: [w, h, d], m }: BuildProps) {
  const cloth = m('fabric'), frame = m('frame')
  const sag = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([-1, -0.5, 0, 0.5, 1].map((t) => new THREE.Vector3(t * (w / 2 - 0.15), h * 0.62 - (1 - t * t) * 0.32, 0)))
    return curve
  }, [w, h])
  const sheet = useMemo(() => {
    const pts = sag.getPoints(30)
    const verts: number[] = [], idx: number[] = []
    pts.forEach((p, i) => {
      const k = Math.sin((i / (pts.length - 1)) * Math.PI) * 0.18 + 0.12
      verts.push(p.x, p.y, -d * k, p.x, p.y - 0.02 * Math.sin((i / 30) * Math.PI), d * k)
      if (i < pts.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [sag, d])
  const clothMat = useMemo(() => { const c = cloth.clone(); c.side = THREE.DoubleSide; return c }, [cloth])
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Cyl r={0.035} h={h} pos={[s * (w / 2 - 0.1), h / 2, 0]} mat={frame} seg={14} />
          <Cyl r={0.025} h={d} pos={[s * (w / 2 - 0.1), 0.02, 0]} mat={frame} rot={[Math.PI / 2, 0, 0]} seg={10} />
        </group>
      ))}
      <mesh geometry={sheet} material={clothMat} castShadow receiveShadow scale={[1, 1, 1]} />
      {[-1, 1].map((s) => <Cyl key={`r${s}`} r={0.008} h={0.2} pos={[s * (w / 2 - 0.16), h * 0.62 - 0.02, 0]} mat={rope()} seg={6} rot={[0, 0, s * 1.2]} />)}
    </group>
  )
}

// ---------------------------------------------------------------- plantas

function PlantFern({ s: [w, h], m }: BuildProps) {
  const pot = m('pot'), foliage = m('foliage')
  const ph = h * 0.28
  const frondGeo = useMemo(() => {
    // fronda: lâmina longa e curva
    const g = new THREE.PlaneGeometry(0.1, 1, 1, 8)
    const pos = g.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) + 0.5
      pos.setZ(i, -0.5 * t * t * 0.9)
      pos.setX(i, pos.getX(i) * (1 - Math.abs(t - 0.45) * 1.1))
    }
    g.translate(0, 0.5, 0)
    g.computeVertexNormals()
    return g
  }, [])
  const dbl = useMemo(() => { const c = foliage.clone(); c.side = THREE.DoubleSide; return c }, [foliage])
  const n = 15
  return (
    <group>
      <Cyl r={w * 0.28} rTop={w * 0.34} h={ph} pos={[0, ph / 2, 0]} mat={pot} seg={24} />
      <Cyl r={w * 0.3} h={0.02} pos={[0, ph, 0]} mat={MATS.soil()} seg={24} cast={false} />
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 3) * 0.2
        const tilt = 0.55 + (i % 4) * 0.12
        const len = (h - ph) * (0.8 + (i % 3) * 0.12)
        return <mesh key={i} geometry={frondGeo} material={dbl} position={[0, ph, 0]} rotation={[tilt, a, 0]} scale={[len * 1.4, len, len]} castShadow />
      })}
    </group>
  )
}

function Cactus({ s: [w, h], m }: BuildProps) {
  const pot = m('pot')
  const ph = h * 0.3
  const bh = h - ph
  return (
    <group>
      <Cyl r={w * 0.4} rTop={w * 0.46} h={ph} pos={[0, ph / 2, 0]} mat={pot} seg={24} />
      <Cyl r={w * 0.36} h={0.02} pos={[0, ph, 0]} mat={simpleMat('sand', { color: '#c8b48a', roughness: 1 })} seg={24} cast={false} />
      <Cyl r={w * 0.2} rTop={w * 0.17} h={bh * 0.9} pos={[0, ph + bh * 0.45, 0]} mat={cactusMat()} seg={20} />
      <Sph r={w * 0.17} pos={[0, ph + bh * 0.9, 0]} mat={cactusMat()} />
      {/* braços */}
      <Cyl r={w * 0.09} h={w * 0.35} pos={[w * 0.28, ph + bh * 0.45, 0]} mat={cactusMat()} rot={[0, 0, Math.PI / 2]} seg={14} />
      <Cyl r={w * 0.09} rTop={w * 0.075} h={bh * 0.32} pos={[w * 0.45, ph + bh * 0.58, 0]} mat={cactusMat()} seg={14} />
      <Sph r={w * 0.075} pos={[w * 0.45, ph + bh * 0.74, 0]} mat={cactusMat()} />
      <Cyl r={w * 0.08} h={w * 0.3} pos={[-w * 0.26, ph + bh * 0.3, 0]} mat={cactusMat()} rot={[0, 0, Math.PI / 2]} seg={12} />
      <Cyl r={w * 0.08} rTop={w * 0.065} h={bh * 0.24} pos={[-w * 0.4, ph + bh * 0.42, 0]} mat={cactusMat()} seg={12} />
      <Sph r={w * 0.065} pos={[-w * 0.4, ph + bh * 0.54, 0]} mat={cactusMat()} />
    </group>
  )
}

export const EXTRA_BUILDERS: Record<string, (p: BuildProps) => ReactElement> = {
  'sofa-chaise': SofaChaise,
  ottoman: Ottoman,
  'table-console': TableConsole,
  'desk-l': DeskL,
  'bed-bunk': BedBunk,
  crib: Crib,
  dresser: Dresser,
  'shoe-cabinet': ShoeCabinet,
  'bench-chest': BenchChest,
  'shelf-cube': ShelfCube,
  'wall-cabinet': WallCabinet,
  'kitchen-tall': KitchenTall,
  'kitchen-sink': KitchenSink,
  'range-hood': RangeHood,
  washer: Washer,
  microwave: Microwave,
  'tv-flat': TvFlat,
  'ac-split': AcSplit,
  'pedestal-sink': PedestalSink,
  'towel-rail': TowelRail,
  vase: Vase,
  'wall-clock': WallClock,
  'mirror-round': MirrorRound,
  fireplace: Fireplace,
  chandelier: Chandelier,
  'wall-sconce': WallSconce,
  'ceiling-flush': CeilingFlush,
  'garden-bench': GardenBench,
  'garden-chair': GardenChair,
  'fire-pit': FirePit,
  'planter-box': PlanterBox,
  pergola: Pergola,
  hammock: Hammock,
  'plant-fern': PlantFern,
  cactus: Cactus,
}
