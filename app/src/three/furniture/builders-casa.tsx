import type { ReactElement } from 'react'
import { useMemo } from 'react'
import * as THREE from 'three'
import { Box, Cyl, MATS, Sph, simpleMat } from './parts'
import type { BuildProps } from './builders'

/** Cozinha, banheiro, decoração de parede e exterior (frente em +Z, origem no centro da base). */

function Torus({ r, t, pos, mat, rot = [Math.PI / 2, 0, 0] }: { r: number; t: number; pos: [number, number, number]; mat: THREE.Material; rot?: [number, number, number] }) {
  const geo = useMemo(() => new THREE.TorusGeometry(r, t, 8, 28), [r, t])
  return <mesh geometry={geo} material={mat} position={pos} rotation={rot} castShadow receiveShadow />
}

const dark = () => simpleMat('darkInset', { color: '#15161a', roughness: 0.7 })

// ---- Cozinha ----

function KitchenCounter({ s: [w, h, d], m, island }: BuildProps & { island?: boolean }) {
  const body = m('body'), top = m('top'), handle = m('handles')
  const plinth = 0.1, topT = 0.04
  const bh = h - plinth - topT
  const n = Math.max(1, Math.round(w / 0.6))
  const dw = w / n
  const over = island ? 0.3 : 0.02
  return (
    <group>
      <Box size={[w - 0.04, plinth, d - 0.06]} pos={[0, plinth / 2, 0]} mat={dark()} />
      <Box size={[w, bh, d]} pos={[0, plinth + bh / 2, 0]} mat={body} r={0.01} />
      <Box size={[w + 0.02, topT, d + over]} pos={[0, h - topT / 2, island ? -over / 2 + 0.015 : 0.015]} mat={top} r={0.008} />
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + dw * (i + 0.5)
        return (
          <group key={i}>
            <Box size={[dw - 0.014, bh - 0.03, 0.02]} pos={[x, plinth + bh / 2, d / 2 + 0.004]} mat={body} r={0.006} />
            <Box size={[0.012, 0.16, 0.014]} pos={[x + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), h - topT - 0.14, d / 2 + 0.022]} mat={handle} />
          </group>
        )
      })}
      {island && <Box size={[w - 0.02, bh - 0.03, 0.02]} pos={[0, plinth + bh / 2, -d / 2 - 0.004]} mat={body} r={0.006} />}
    </group>
  )
}
const KitchenIsland = (p: BuildProps) => <KitchenCounter {...p} island />

function Fridge({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), handle = m('handle')
  const split = h * 0.7
  return (
    <group>
      <Box size={[w, h - 0.03, d - 0.03]} pos={[0, 0.03 + (h - 0.03) / 2, -0.015]} mat={body} r={0.02} />
      <Box size={[w - 0.02, split - 0.04, 0.03]} pos={[0, 0.03 + (split - 0.04) / 2 + 0.01, d / 2 - 0.015]} mat={body} r={0.012} />
      <Box size={[w - 0.02, h - split - 0.05, 0.03]} pos={[0, split + 0.03 + (h - split - 0.05) / 2 + 0.01, d / 2 - 0.015]} mat={body} r={0.012} />
      <Box size={[0.025, 0.7, 0.03]} pos={[w / 2 - 0.07, split * 0.58, d / 2 + 0.03]} mat={handle} r={0.008} />
      <Box size={[0.025, 0.4, 0.03]} pos={[w / 2 - 0.07, split + (h - split) * 0.45, d / 2 + 0.03]} mat={handle} r={0.008} />
    </group>
  )
}

function Stove({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), top = m('top')
  const glass = simpleMat('ovenGlass', { color: '#141619', roughness: 0.12, metalness: 0.3 })
  return (
    <group>
      <Box size={[w, h - 0.03, d]} pos={[0, (h - 0.03) / 2, 0]} mat={body} r={0.012} />
      <Box size={[w + 0.01, 0.03, d + 0.01]} pos={[0, h - 0.015, 0]} mat={top} r={0.006} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <group key={i} position={[sx * w * 0.22, h + 0.004, sz * d * 0.2]}>
          <Cyl r={0.085} h={0.008} mat={MATS.blackMetal()} seg={20} />
          <Cyl r={0.035} h={0.012} pos={[0, 0.008, 0]} mat={MATS.blackMetal()} seg={12} />
        </group>
      ))}
      <Box size={[w - 0.08, h * 0.45, 0.02]} pos={[0, h * 0.34, d / 2 + 0.005]} mat={glass} r={0.01} />
      <Box size={[w - 0.14, 0.022, 0.03]} pos={[0, h * 0.62, d / 2 + 0.035]} mat={MATS.blackMetal()} />
      {[-2, -1, 0, 1, 2].map((i) => (
        <Cyl key={i} r={0.016} h={0.025} pos={[i * w * 0.18, h - 0.09, d / 2 + 0.01]} rot={[Math.PI / 2, 0, 0]} mat={MATS.blackMetal()} seg={12} />
      ))}
    </group>
  )
}

// ---- Banheiro ----

function Toilet({ s: [w, h, d], m }: BuildProps) {
  const c = m('ceramic'), seat = m('seat')
  const tankH = h - 0.42
  return (
    <group>
      <Cyl r={0.1} rTop={0.13} h={0.26} pos={[0, 0.13, d / 2 - d * 0.36]} mat={c} seg={20} />
      <Sph r={1} scale={[w * 0.5, 0.17, d * 0.4]} pos={[0, 0.27, d / 2 - d * 0.4]} mat={c} />
      <Sph r={1} scale={[w * 0.5 + 0.012, 0.024, d * 0.4 + 0.012]} pos={[0, 0.43, d / 2 - d * 0.4]} mat={seat} />
      <Box size={[w, tankH, 0.2]} pos={[0, 0.42 + tankH / 2, -d / 2 + 0.1]} mat={c} r={0.03} />
      <Box size={[w + 0.02, 0.025, 0.22]} pos={[0, h + 0.012, -d / 2 + 0.1]} mat={c} r={0.01} />
      <Cyl r={0.022} h={0.012} pos={[0, h + 0.03, -d / 2 + 0.1]} mat={MATS.brass()} seg={12} />
    </group>
  )
}

function Vanity({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), top = m('top'), basin = m('basin'), tap = m('tap')
  const topT = 0.04, bh = h - topT - 0.08
  return (
    <group>
      <Box size={[w - 0.06, 0.08, d - 0.06]} pos={[0, 0.04, 0]} mat={dark()} />
      <Box size={[w, bh, d]} pos={[0, 0.08 + bh / 2, 0]} mat={body} r={0.01} />
      <Box size={[w + 0.02, topT, d + 0.02]} pos={[0, h - topT / 2, 0.01]} mat={top} r={0.008} />
      {[-1, 1].map((sx) => (
        <Box key={sx} size={[w / 2 - 0.02, bh - 0.04, 0.02]} pos={[sx * (w / 4), 0.08 + bh / 2, d / 2 + 0.004]} mat={body} r={0.006} />
      ))}
      <Sph r={1} scale={[Math.min(0.21, w * 0.26), 0.05, Math.min(0.17, d * 0.36)]} pos={[0, h + 0.005, 0.02]} mat={basin} />
      <Cyl r={0.012} h={0.16} pos={[0, h + 0.08, -d / 2 + 0.07]} mat={tap} seg={10} />
      <Box size={[0.02, 0.02, 0.1]} pos={[0, h + 0.15, -d / 2 + 0.12]} mat={tap} />
    </group>
  )
}

function ShowerBox({ s: [w, h, d], m }: BuildProps) {
  const tray = m('tray'), frame = m('frame'), glass = m('glass')
  const f = 0.03
  return (
    <group>
      <Box size={[w, 0.06, d]} pos={[0, 0.03, 0]} mat={tray} r={0.01} />
      <Box size={[w - 0.04, h - 0.1, 0.008]} pos={[0, 0.06 + (h - 0.06) / 2 - 0.02, d / 2 - 0.02]} mat={glass} cast={false} />
      <Box size={[0.008, h - 0.1, d - 0.04]} pos={[w / 2 - 0.02, 0.06 + (h - 0.06) / 2 - 0.02, 0]} mat={glass} cast={false} />
      {[[w / 2 - 0.02, d / 2 - 0.02], [-w / 2 + 0.02, d / 2 - 0.02], [w / 2 - 0.02, -d / 2 + 0.02]].map(([x, z], i) => (
        <Box key={i} size={[f, h - 0.06, f]} pos={[x, 0.06 + (h - 0.06) / 2, z]} mat={frame} />
      ))}
      <Box size={[w, f, f]} pos={[0, h - f / 2, d / 2 - 0.02]} mat={frame} />
      <Box size={[f, f, d]} pos={[w / 2 - 0.02, h - f / 2, 0]} mat={frame} />
      <Cyl r={0.012} h={0.35} pos={[-w / 2 + 0.1, h - 0.35, -d / 2 + 0.05]} mat={MATS.blackMetal()} seg={8} />
      <Cyl r={0.09} rTop={0.06} h={0.03} pos={[-w / 2 + 0.1, h - 0.45, -d / 2 + 0.2]} rot={[0.5, 0, 0]} mat={MATS.blackMetal()} seg={20} />
    </group>
  )
}

function Bathtub({ s: [w, h, d], m }: BuildProps) {
  const shell = m('shell'), tap = m('tap')
  const t = 0.08
  return (
    <group>
      <Box size={[t, h, d]} pos={[-w / 2 + t / 2, h / 2, 0]} mat={shell} r={0.035} />
      <Box size={[t, h, d]} pos={[w / 2 - t / 2, h / 2, 0]} mat={shell} r={0.035} />
      <Box size={[w - t * 2 + 0.02, h, t]} pos={[0, h / 2, -d / 2 + t / 2]} mat={shell} r={0.035} />
      <Box size={[w - t * 2 + 0.02, h, t]} pos={[0, h / 2, d / 2 - t / 2]} mat={shell} r={0.035} />
      <Box size={[w - t * 2, 0.14, d - t * 2]} pos={[0, 0.09, 0]} mat={shell} r={0.04} />
      <Cyl r={0.014} h={0.2} pos={[-w / 2 + 0.16, h + 0.1, -d / 2 + 0.01]} mat={tap} seg={10} />
      <Box size={[0.02, 0.02, 0.12]} pos={[-w / 2 + 0.16, h + 0.2, -d / 2 + 0.07]} mat={tap} />
    </group>
  )
}

// ---- Mesas e bancos ----

function TableDiningRound({ s: [w, h], m }: BuildProps) {
  const top = m('top'), legs = m('legs')
  return (
    <group>
      <Cyl r={w / 2} h={0.04} pos={[0, h - 0.02, 0]} mat={top} seg={40} />
      <Cyl r={0.06} rTop={0.05} h={h - 0.07} pos={[0, 0.03 + (h - 0.07) / 2, 0]} mat={legs} seg={16} />
      <Cyl r={w * 0.22} rTop={0.07} h={0.03} pos={[0, 0.015, 0]} mat={legs} seg={32} />
    </group>
  )
}

function BarStool({ s: [w, h], m }: BuildProps) {
  const seat = m('seat'), frame = m('frame')
  const r = w * 0.38
  return (
    <group>
      <Cyl r={w / 2} rTop={w / 2 - 0.01} h={0.06} pos={[0, h - 0.03, 0]} mat={seat} seg={28} />
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return <Cyl key={i} r={0.014} h={h - 0.06} pos={[Math.cos(a) * r * 0.9, (h - 0.06) / 2, Math.sin(a) * r * 0.9]} mat={frame} seg={8} />
      })}
      <Torus r={r * 0.9} t={0.01} pos={[0, h * 0.35, 0]} mat={frame} />
    </group>
  )
}

// ---- Decoração e têxtil ----

function Mirror({ s: [w, h, d], m }: BuildProps) {
  const frame = m('frame')
  const glass = simpleMat('mirror', { color: '#cfdde6', metalness: 0.35, roughness: 0.06 })
  return (
    <group>
      <Box size={[w, h, d]} pos={[0, h / 2, 0]} mat={frame} r={0.012} />
      <Box size={[w - 0.06, h - 0.06, 0.006]} pos={[0, h / 2, d / 2 + 0.001]} mat={glass} cast={false} />
    </group>
  )
}

function ArtFrame({ s: [w, h, d], m }: BuildProps) {
  const frame = m('frame'), art = m('art'), accent = m('accent')
  const paper = MATS.paper()
  const iw = w - 0.1, ih = h - 0.1
  return (
    <group>
      <Box size={[w, h, d]} pos={[0, h / 2, 0]} mat={frame} r={0.008} />
      <Box size={[w - 0.05, h - 0.05, 0.008]} pos={[0, h / 2, d / 2 + 0.001]} mat={paper} cast={false} />
      <Box size={[iw * 0.62, ih * 0.7, 0.008]} pos={[-iw * 0.12, h / 2 + ih * 0.04, d / 2 + 0.006]} mat={art} cast={false} />
      <Cyl r={ih * 0.22} h={0.008} pos={[iw * 0.2, h / 2 - ih * 0.1, d / 2 + 0.01]} rot={[Math.PI / 2, 0, 0]} mat={accent} seg={32} cast={false} />
      <Box size={[iw * 0.5, ih * 0.05, 0.008]} pos={[0, h / 2 - ih * 0.36, d / 2 + 0.006]} mat={accent} cast={false} />
    </group>
  )
}

function Curtain({ s: [w, h, d], m }: BuildProps) {
  const fab = m('fabric'), rod = m('rod')
  const n = Math.max(4, Math.round(w / 0.1))
  const fw = w / n
  return (
    <group>
      <Cyl r={0.014} h={w + 0.16} pos={[0, h - 0.04, 0]} rot={[0, 0, Math.PI / 2]} mat={rod} seg={10} />
      {[-1, 1].map((s) => <Sph key={s} r={0.026} pos={[s * (w / 2 + 0.08), h - 0.04, 0]} mat={rod} />)}
      {Array.from({ length: n }, (_, i) => (
        <Box key={i} size={[fw * 0.95, h - 0.08, 0.035]} pos={[-w / 2 + fw * (i + 0.5), (h - 0.08) / 2, (i % 2 ? 1 : -1) * d * 0.28]} mat={fab} r={0.012} />
      ))}
    </group>
  )
}

// ---- Plantas ----

function Shrub({ s: [w, h, d], m }: BuildProps) {
  const leaf = m('foliage')
  const blobs: [number, number, number, number, number][] = [
    [0, 0.45, 0, 0.5, 0.46], [0.28, 0.35, 0.1, 0.32, 0.34], [-0.28, 0.36, -0.08, 0.34, 0.34], [0.05, 0.3, 0.3, 0.3, 0.3], [-0.1, 0.34, -0.3, 0.3, 0.3], [0.1, 0.72, 0.04, 0.3, 0.26],
  ]
  return (
    <group>
      <Cyl r={0.05} h={0.12} pos={[0, 0.06, 0]} mat={simpleMat('shrubTrunk', { color: '#5a4332', roughness: 0.95 })} seg={8} />
      {blobs.map(([x, y, z, rx, ry], i) => (
        <Sph key={i} r={1} scale={[rx * w * 0.9, ry * h * 0.85, rx * d * 0.9]} pos={[x * w, y * h, z * d]} mat={leaf} />
      ))}
    </group>
  )
}

function PlantPot({ s: [w, h], m }: BuildProps) {
  const pot = m('pot'), leaf = m('foliage')
  const potH = h * 0.38
  return (
    <group>
      <Cyl r={w * 0.28} rTop={w * 0.36} h={potH} pos={[0, potH / 2, 0]} mat={pot} seg={24} />
      <Cyl r={w * 0.33} h={0.01} pos={[0, potH - 0.004, 0]} mat={MATS.soil()} seg={20} cast={false} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        const tilt = 0.35 + (i % 3) * 0.12
        const len = (h - potH) * (0.75 + (i % 2) * 0.25)
        return (
          <Sph key={i} r={1} scale={[w * 0.1, len * 0.5, w * 0.05]} pos={[Math.cos(a) * w * 0.14, potH + len * 0.45, Math.sin(a) * w * 0.14]} rot={[Math.sin(a) * tilt, a, -Math.cos(a) * tilt]} mat={leaf} />
        )
      })}
    </group>
  )
}

// ---- Exterior ----

function Bbq({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), side = m('side')
  const metal = MATS.blackMetal()
  const gh = h * 0.62 // altura da base da grelha
  const bw = w * 0.62
  const bx = -w * 0.16
  return (
    <group>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <Cyl key={i} r={0.022} h={gh - 0.1} pos={[bx + sx * (bw / 2 - 0.05), (gh - 0.1) / 2, sz * (d / 2 - 0.05)]} mat={metal} seg={8} />
      ))}
      <Box size={[bw - 0.06, 0.02, d - 0.1]} pos={[bx, 0.28, 0]} mat={metal} />
      <Box size={[bw, 0.26, d]} pos={[bx, gh - 0.03, 0]} mat={body} r={0.04} />
      <Box size={[bw - 0.08, 0.012, d - 0.1]} pos={[bx, gh + 0.1, 0]} mat={metal} />
      <group position={[bx, gh + 0.1, -d / 2 + 0.02]} rotation={[-0.75, 0, 0]}>
        <Box size={[bw, 0.06, d]} pos={[0, 0.03, d / 2]} mat={body} r={0.025} />
        <Box size={[0.03, 0.03, 0.2]} pos={[0, 0.06, d + 0.04]} mat={metal} />
      </group>
      {[-0.2, 0, 0.2].map((o, i) => <Cyl key={i} r={0.02} h={0.03} pos={[bx + o * bw, gh - 0.03, d / 2 + 0.012]} rot={[Math.PI / 2, 0, 0]} mat={MATS.brass()} seg={10} />)}
      <Box size={[w * 0.34, 0.04, d]} pos={[w * 0.33, gh - 0.02, 0]} mat={side} r={0.01} />
      {[-1, 1].map((sz) => <Cyl key={sz} r={0.022} h={gh - 0.04} pos={[w * 0.46, (gh - 0.04) / 2, sz * (d / 2 - 0.05)]} mat={metal} seg={8} />)}
      <Cyl r={0.05} h={0.16} pos={[bx - bw * 0.4, h - 0.07, -d / 2 + 0.1]} mat={metal} seg={10} />
    </group>
  )
}

function Mailbox({ s: [w, h, d], m }: BuildProps) {
  const post = m('post'), box = m('box')
  const bh = 0.22
  return (
    <group>
      <Box size={[0.08, h - bh, 0.08]} pos={[0, (h - bh) / 2, -d / 2 + 0.06]} mat={post} />
      <Box size={[0.06, 0.06, d * 0.8]} pos={[0, h - bh - 0.02, -d * 0.1]} mat={post} />
      <Box size={[w, bh, d]} pos={[0, h - bh / 2, 0]} mat={box} r={0.07} />
      <Box size={[0.012, 0.15, 0.03]} pos={[w / 2 + 0.008, h - bh / 2 + 0.07, d * 0.18]} mat={simpleMat('flagRed', { color: '#b32a22', roughness: 0.6 })} />
      <Box size={[w * 0.8, 0.012, 0.01]} pos={[0, h - bh * 0.5, d / 2 + 0.003]} mat={MATS.blackMetal()} cast={false} />
    </group>
  )
}

function Car({ s: [w, h, d], m }: BuildProps) {
  const body = m('body')
  const glass = simpleMat('carGlass', { color: '#1b232d', roughness: 0.08, metalness: 0.4 })
  const tyre = simpleMat('tyre', { color: '#17181a', roughness: 0.9 })
  const rim = simpleMat('rim', { color: '#c9ccd1', roughness: 0.25, metalness: 1 })
  const lamp = simpleMat('carHead', { color: '#fff3d6', roughness: 0.2, emissive: '#fff3d6', emissiveIntensity: 0.15 })
  const tail = simpleMat('carTail', { color: '#a01818', roughness: 0.3, emissive: '#a01818', emissiveIntensity: 0.1 })
  const wr = 0.33
  const lowH = h * 0.4
  const cabH = h * 0.36
  return (
    <group>
      <Box size={[w, lowH, d]} pos={[0, wr * 0.7 + lowH / 2, 0]} mat={body} r={0.14} />
      <Box size={[w - 0.14, cabH, d * 0.5]} pos={[0, wr * 0.7 + lowH + cabH / 2 - 0.02, -d * 0.06]} mat={glass} r={0.12} />
      <Box size={[w - 0.2, 0.06, d * 0.44]} pos={[0, wr * 0.7 + lowH + cabH - 0.01, -d * 0.06]} mat={body} r={0.03} />
      {[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz], i) => (
        <group key={i} position={[sx * (w / 2 - 0.12), wr, sz * d * 0.31]}>
          <Cyl r={wr} h={0.24} rot={[0, 0, Math.PI / 2]} mat={tyre} seg={24} />
          <Cyl r={wr * 0.62} h={0.25} rot={[0, 0, Math.PI / 2]} mat={rim} seg={16} />
        </group>
      ))}
      {[-1, 1].map((s) => <Box key={s} size={[0.28, 0.1, 0.03]} pos={[s * (w / 2 - 0.3), wr * 0.7 + lowH * 0.75, d / 2 + 0.005]} mat={lamp} cast={false} />)}
      {[-1, 1].map((s) => <Box key={s} size={[0.28, 0.1, 0.03]} pos={[s * (w / 2 - 0.3), wr * 0.7 + lowH * 0.75, -d / 2 - 0.005]} mat={tail} cast={false} />)}
    </group>
  )
}

// ---- Escadas ----

/** Degraus maciços (cada degrau é um bloco do piso até a sua altura). O topo chega exatamente em `h`. */
function stepCount(h: number) {
  return Math.max(3, Math.round(h / 0.18))
}

/** Escada reta: embaixo em +Z (frente), sobe em direção a -Z; a altura total é `h`. */
function StairsStraight({ s: [w, h, d], m }: BuildProps) {
  const steps = m('steps')
  const n = stepCount(h)
  const rise = h / n
  const run = d / n
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <Box key={i} size={[w, (i + 1) * rise, run]} pos={[0, ((i + 1) * rise) / 2, d / 2 - run * (i + 0.5)]} mat={steps} r={0.008} />
      ))}
    </group>
  )
}

/**
 * Escada em L com patamar: o primeiro lance sobe pela coluna da esquerda (-X) de +Z para -Z, o patamar fica no
 * canto do fundo e o segundo lance segue para +X. O topo fica na extremidade +X do fundo.
 */
function StairsL({ s: [w, h, d], m }: BuildProps) {
  const steps = m('steps')
  const n = stepCount(h)
  const rise = h / n
  const fw = Math.min(w, d) / 2 // largura de cada lance
  const n1 = Math.max(1, Math.floor((n - 1) / 2)) // degraus do primeiro lance (antes do patamar)
  const n2 = Math.max(1, n - 1 - n1) // degraus do segundo lance
  const run1 = (d - fw) / n1
  const run2 = (w - fw) / n2
  const x0 = -w / 2, z0 = -d / 2
  return (
    <group>
      {Array.from({ length: n1 }, (_, i) => (
        <Box key={`a${i}`} size={[fw, (i + 1) * rise, run1]} pos={[x0 + fw / 2, ((i + 1) * rise) / 2, d / 2 - run1 * (i + 0.5)]} mat={steps} r={0.008} />
      ))}
      <Box size={[fw, (n1 + 1) * rise, fw]} pos={[x0 + fw / 2, ((n1 + 1) * rise) / 2, z0 + fw / 2]} mat={steps} r={0.008} />
      {Array.from({ length: n2 }, (_, i) => (
        <Box key={`b${i}`} size={[run2, (n1 + 2 + i) * rise, fw]} pos={[x0 + fw + run2 * (i + 0.5), ((n1 + 2 + i) * rise) / 2, z0 + fw / 2]} mat={steps} r={0.008} />
      ))}
    </group>
  )
}

export const CASA_BUILDERS: Record<string, (p: BuildProps) => ReactElement> = {
  'kitchen-counter': KitchenCounter,
  'kitchen-island': KitchenIsland,
  fridge: Fridge,
  stove: Stove,
  toilet: Toilet,
  vanity: Vanity,
  'shower-box': ShowerBox,
  bathtub: Bathtub,
  'table-dining-round': TableDiningRound,
  'bar-stool': BarStool,
  mirror: Mirror,
  'art-frame': ArtFrame,
  curtain: Curtain,
  shrub: Shrub,
  'plant-pot': PlantPot,
  bbq: Bbq,
  mailbox: Mailbox,
  car: Car,
  'stairs-straight': StairsStraight,
  'stairs-l': StairsL,
}
