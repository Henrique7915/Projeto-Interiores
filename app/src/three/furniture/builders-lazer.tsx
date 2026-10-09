import type { ReactElement } from 'react'
import { useMemo } from 'react'
import * as THREE from 'three'
import { Box, Cyl, metersUV, simpleMat } from './parts'
import type { BuildProps } from './builders'

/**
 * Terceira leva: área de lazer e serviço (spa, sauna, tanque, casinha de cachorro).
 * Mesmas regras dos outros desenhistas: metros, origem no centro da base, frente em +Z, um material por slot.
 */

const water = () => simpleMat('spaWater', { color: '#4fb3c8', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85 })
const steel = () => simpleMat('steel', { color: '#b9bcc2', metalness: 0.85, roughness: 0.35 })
const darkInset = () => simpleMat('darkInset', { color: '#15161a', roughness: 0.7 })
const bowl = () => simpleMat('tubBowl', { color: '#c9ccd1', roughness: 0.4 })

function HotTub({ s: [w, h, d], m }: BuildProps) {
  const shell = m('shell'), skirt = m('skirt')
  const rim = 0.16 // largura da borda
  const iw = w - rim * 2, id = d - rim * 2
  const floorY = 0.12
  const waterTop = h - 0.12
  return (
    <group>
      {/* saia externa (quatro lados) e fundo */}
      {[-1, 1].map((s) => <Box key={`sx${s}`} size={[0.1, h - 0.06, d]} pos={[s * (w / 2 - 0.05), (h - 0.06) / 2, 0]} mat={skirt} r={0.03} />)}
      {[-1, 1].map((s) => <Box key={`sz${s}`} size={[w - 0.2, h - 0.06, 0.1]} pos={[0, (h - 0.06) / 2, s * (d / 2 - 0.05)]} mat={skirt} r={0.03} />)}
      <Box size={[w - 0.2, floorY, d - 0.2]} pos={[0, floorY / 2, 0]} mat={shell} />
      {/* borda */}
      {[-1, 1].map((s) => <Box key={`x${s}`} size={[rim, 0.06, d]} pos={[s * (w / 2 - rim / 2), h - 0.03, 0]} mat={shell} r={0.025} />)}
      {[-1, 1].map((s) => <Box key={`z${s}`} size={[iw, 0.06, rim]} pos={[0, h - 0.03, s * (d / 2 - rim / 2)]} mat={shell} r={0.025} />)}
      {/* paredes internas e bancos em dois lados */}
      {[-1, 1].map((s) => <Box key={`ix${s}`} size={[0.04, h - floorY - 0.06, id]} pos={[s * (iw / 2 - 0.02), floorY + (h - floorY - 0.06) / 2, 0]} mat={shell} />)}
      {[-1, 1].map((s) => <Box key={`iz${s}`} size={[iw, h - floorY - 0.06, 0.04]} pos={[0, floorY + (h - floorY - 0.06) / 2, s * (id / 2 - 0.02)]} mat={shell} />)}
      {[-1, 1].map((s) => <Box key={`b${s}`} size={[0.45, h * 0.45, id - 0.08]} pos={[s * (iw / 2 - 0.265), floorY + (h * 0.45) / 2, 0]} mat={shell} r={0.04} />)}
      {/* água */}
      <Box size={[iw - 0.08, waterTop - floorY, id - 0.08]} pos={[0, floorY + (waterTop - floorY) / 2, 0]} mat={water()} cast={false} />
      {/* jatos e painel */}
      {[-0.25, 0, 0.25].map((t, i) => <Cyl key={i} r={0.03} h={0.012} pos={[t * iw, h * 0.55, -id / 2 + 0.046]} mat={steel()} rot={[Math.PI / 2, 0, 0]} seg={14} />)}
      <Box size={[0.22, 0.012, 0.1]} pos={[iw * 0.3, h + 0.006, d / 2 - rim / 2]} mat={darkInset()} />
    </group>
  )
}

function SaunaBench({ s: [w, h, d], m }: BuildProps) {
  const wood = m('wood')
  // dois degraus: o de baixo na frente, o de cima encostado na parede (fundo, -Z)
  const lowH = h * 0.5, lowD = d * 0.45
  const slat = (len: number, y: number, z: number, depth: number, key: string) => {
    const n = Math.max(3, Math.round(depth / 0.1))
    return Array.from({ length: n }, (_, i) => (
      <Box key={`${key}${i}`} size={[len, 0.03, depth / n - 0.012]} pos={[0, y, z - depth / 2 + (depth / n) * (i + 0.5)]} mat={wood} r={0.005} />
    ))
  }
  const highD = d - lowD
  return (
    <group>
      {/* estrutura */}
      <Box size={[w - 0.04, h - 0.03, 0.04]} pos={[0, (h - 0.03) / 2, -d / 2 + 0.02]} mat={wood} />
      <Box size={[w - 0.04, h - 0.03, 0.03]} pos={[0, (h - 0.03) / 2, d / 2 - lowD - 0.015]} mat={wood} />
      <Box size={[w - 0.04, lowH - 0.03, 0.03]} pos={[0, (lowH - 0.03) / 2, d / 2 - 0.015]} mat={wood} />
      {slat(w, h - 0.015, -d / 2 + highD / 2, highD, 'a')}
      {slat(w, lowH - 0.015, d / 2 - lowD / 2, lowD, 'b')}
    </group>
  )
}

function LaundryTub({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), tap = m('tap')
  const bowlW = w * 0.55
  return (
    <group>
      {/* coluna */}
      <Box size={[w * 0.5, h - 0.28, d * 0.55]} pos={[0, (h - 0.28) / 2, -d * 0.12]} mat={body} r={0.03} />
      {/* cuba à esquerda e esfregador à direita */}
      <Box size={[w, 0.28, d]} pos={[0, h - 0.14, 0]} mat={body} r={0.025} />
      <Box size={[bowlW - 0.06, 0.02, d - 0.12]} pos={[-w / 2 + bowlW / 2, h + 0.0005, 0.02]} mat={bowl()} cast={false} />
      {Array.from({ length: 6 }, (_, i) => (
        <Box key={i} size={[0.015, 0.012, d - 0.16]} pos={[w / 2 - (w - bowlW) / 2 - ((w - bowlW) * 0.35) + i * ((w - bowlW) * 0.7) / 5, h + 0.006, 0.02]} mat={body} />
      ))}
      {/* torneira na parede */}
      <Cyl r={0.012} h={0.14} pos={[-w / 2 + bowlW / 2, h + 0.2, -d / 2 + 0.03]} mat={tap} rot={[Math.PI / 2, 0, 0]} seg={12} />
      <Cyl r={0.02} h={0.04} pos={[-w / 2 + bowlW / 2, h + 0.2, -d / 2 + 0.01]} mat={tap} rot={[Math.PI / 2, 0, 0]} seg={14} />
    </group>
  )
}

function DogHouse({ s: [w, h, d], m }: BuildProps) {
  const body = m('body'), roof = m('roof')
  const wallH = h * 0.6
  const rise = h - wallH
  const half = w / 2 + 0.06
  const slope = Math.hypot(half, rise)
  const ang = Math.atan2(rise, half)
  const doorW = Math.min(0.4, w * 0.45), doorH = Math.min(wallH * 0.85, 0.5)
  const gable = useMemo(() => {
    const t = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rise)])
    return metersUV(new THREE.ExtrudeGeometry(t, { depth: 0.03, bevelEnabled: false }))
  }, [w, rise])
  return (
    <group>
      <Box size={[w, 0.06, d]} pos={[0, 0.03, 0]} mat={body} />
      {/* paredes, com a porta na frente (+Z) */}
      <Box size={[w, wallH, 0.03]} pos={[0, wallH / 2, -d / 2 + 0.015]} mat={body} />
      {[-1, 1].map((s) => <Box key={s} size={[0.03, wallH, d]} pos={[s * (w / 2 - 0.015), wallH / 2, 0]} mat={body} />)}
      {[-1, 1].map((s) => <Box key={`f${s}`} size={[(w - doorW) / 2, wallH, 0.03]} pos={[s * (doorW / 2 + (w - doorW) / 4), wallH / 2, d / 2 - 0.015]} mat={body} />)}
      <Box size={[doorW, wallH - doorH, 0.03]} pos={[0, doorH + (wallH - doorH) / 2, d / 2 - 0.015]} mat={body} />
      {/* empena na frente e no fundo */}
      {[-1, 1].map((s) => (
        <mesh key={`g${s}`} geometry={gable} material={body} position={[0, wallH, s * (d / 2 - 0.015) - 0.015]} castShadow receiveShadow />
      ))}
      {/* telhado de duas águas */}
      {[-1, 1].map((s) => (
        <Box key={`t${s}`} size={[slope, 0.03, d + 0.12]} pos={[s * half / 2, wallH + rise / 2 + 0.015, 0]} rot={[0, 0, -s * ang]} mat={roof} />
      ))}
    </group>
  )
}

export const LAZER_BUILDERS: Record<string, (p: BuildProps) => ReactElement> = {
  'hot-tub': HotTub,
  'sauna-bench': SaunaBench,
  'laundry-tub': LaundryTub,
  'dog-house': DogHouse,
}
