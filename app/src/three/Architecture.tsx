import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Point2 } from '../../../schema/types'
import type { ScenePick, RenderScene, ROpening, RRoom, RWall, RSlabOpening } from './render/types'
import { getThreeMaterial } from './materials/three'
import { resolveMaterial } from './materials/library'
import { isNotch } from './adapter/toRender'
import { buildWallGeometry, pointInPolygon, wallLength, wallNormalRight, wallTransform } from './geometry/walls'
import { floorGeometry, shapesWithHoles, slabGeometry } from './geometry/polygon'
import { Treatment } from './Treatments'
import { Ceiling } from './Ceilings'
import { Roof, SlabRailing } from './Roofs'
import { Box, MATS, simpleMat } from './furniture/parts'
import { useLampLevel } from './lighting/Lighting'

export type Cutaway = 'auto' | 'none' | 'all'

interface CommonProps {
  lowQuality?: boolean
  onPick?: (p: ScenePick) => void
}

const TRIM = resolveMaterial('paint/white-matte')
const NO_HOLES: Point2[][] = []

/* ----------------------------- aberturas ----------------------------- */

function Leaf({ w, h, mat, hingeAt, angle, t }: { w: number; h: number; mat: THREE.Material; hingeAt: number; angle: number; t: number }) {
  // hingeAt: -1 = dobradiça no início (u menor), +1 = no fim
  return (
    <group position={[hingeAt * (w / 2), 0, 0]} rotation={[0, angle, 0]}>
      <mesh material={mat} position={[-hingeAt * (w / 2), h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, Math.min(0.045, t * 0.6)]} />
      </mesh>
      <mesh material={MATS.brass()} position={[-hingeAt * (w - 0.1), h * 0.46, 0.04]}>
        <boxGeometry args={[0.11, 0.022, 0.03]} />
      </mesh>
    </group>
  )
}

function OpeningDecor({ o, t, lowQuality, onPick }: { o: ROpening; t: number; lowQuality?: boolean; onPick?: (p: ScenePick) => void }) {
  const lamp = useLampLevel((s) => s.lamp)
  const frame = getThreeMaterial(o.frame, lowQuality)
  const trim = getThreeMaterial(TRIM, lowQuality)
  const leaf = getThreeMaterial(o.leaf, lowQuality)
  const glassBase = getThreeMaterial(o.glass, lowQuality)
  const glass = useMemo(() => {
    const g = glassBase.clone()
    g.depthWrite = false
    return g
  }, [glassBase])
  // à noite o vidro escurece (reflete o interior aceso)
  glass.opacity = Math.min(0.85, (glassBase.opacity || 0.2) + lamp * 0.3)
  glass.color.copy(glassBase.color).lerp(new THREE.Color('#1a2448'), lamp * 0.8)

  const { width: w, height: h, sill, kind } = o
  const cy = sill + h / 2
  const fr = 0.05
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return
    e.stopPropagation()
    onPick?.({ type: 'opening', id: o.id })
  }

  const windowLike = kind === 'window' || kind === 'fixed-window' || kind === 'sliding-window'
  if (windowLike) {
    const mull = kind === 'fixed-window' ? 0 : Math.max(0, Math.round(w / 1.1) - 1)
    const slide = kind === 'sliding-window'
    return (
      <group position={[o.offset, cy, 0]} onClick={click}>
        {slide ? (
          <>
            <mesh material={glass}><boxGeometry args={[w / 2 + 0.03, h - 0.04, 0.008]} /></mesh>
            <mesh material={glass} position={[w / 4, 0, 0.025]}><boxGeometry args={[w / 2 + 0.03, h - 0.04, 0.008]} /></mesh>
          </>
        ) : (
          <mesh material={glass}><boxGeometry args={[w - 0.02, h - 0.02, 0.008]} /></mesh>
        )}
        {[-1, 1].map((s) => (
          <mesh key={`v${s}`} material={frame} position={[(s * (w - fr)) / 2, 0, 0]} castShadow><boxGeometry args={[fr, h, t + 0.03]} /></mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`h${s}`} material={frame} position={[0, (s * (h - fr)) / 2, 0]} castShadow><boxGeometry args={[w, fr, t + 0.03]} /></mesh>
        ))}
        {Array.from({ length: mull }, (_, i) => (
          <mesh key={i} material={frame} position={[-w / 2 + ((i + 1) * w) / (mull + 1), 0, 0]}><boxGeometry args={[0.035, h, 0.045]} /></mesh>
        ))}
        {sill > 0.2 && (
          <mesh material={trim} position={[0, -h / 2 - 0.02, 0.03]}><boxGeometry args={[w + 0.08, 0.04, t + 0.08]} /></mesh>
        )}
      </group>
    )
  }

  // portas e passagens: moldura no chão
  // moldura em coordenadas locais da abertura (o grupo pai já está em `offset`)
  const jamb = (
    <>
      {[-1, 1].map((s) => (
        <mesh key={s} material={trim} position={[(s * (w + 0.05)) / 2, sill + h / 2, 0]}><boxGeometry args={[0.05, h, t + 0.04]} /></mesh>
      ))}
      <mesh material={trim} position={[0, sill + h + 0.025, 0]}><boxGeometry args={[w + 0.15, 0.05, t + 0.04]} /></mesh>
    </>
  )

  if (kind === 'passage') return <group position={[o.offset, 0, 0]} onClick={click}>{jamb}</group>

  if (kind === 'sliding-door') {
    return (
      <group position={[o.offset, sill + h / 2, 0]} onClick={click}>
        <mesh material={glass} position={[-w / 4, 0, -0.025]}><boxGeometry args={[w / 2 + 0.02, h - 0.06, 0.008]} /></mesh>
        <mesh material={glass} position={[w / 4, 0, 0.025]}><boxGeometry args={[w / 2 + 0.02, h - 0.06, 0.008]} /></mesh>
        {[-1, 1].map((s) => (
          <mesh key={`v${s}`} material={frame} position={[(s * (w - fr)) / 2, 0, 0]} castShadow><boxGeometry args={[fr, h, t + 0.03]} /></mesh>
        ))}
        <mesh material={frame} position={[0, h / 2 - fr / 2, 0]}><boxGeometry args={[w, fr, t + 0.03]} /></mesh>
        <mesh material={frame} position={[0, 0, 0]}><boxGeometry args={[0.04, h - 0.04, 0.065]} /></mesh>
        <mesh material={frame} position={[-w / 2 + 0.02, 0, 0]}><boxGeometry args={[0.04, h, 0.05]} /></mesh>
      </group>
    )
  }

  if (kind === 'garage-door') {
    const panels = 5
    return (
      <group position={[o.offset, 0, 0]} onClick={click}>
        {Array.from({ length: panels }, (_, i) => (
          <mesh key={i} material={leaf} position={[0, ((i + 0.5) * h) / panels, 0]} castShadow receiveShadow>
            <boxGeometry args={[w - 0.04, h / panels - 0.012, 0.05]} />
          </mesh>
        ))}
        {jamb}
      </group>
    )
  }

  // door / double-door
  const ang = 1.15
  const side = o.opensTo === 'right' ? -1 : 1
  const doubleDoor = kind === 'double-door'
  return (
    <group position={[o.offset, 0, 0]} onClick={click}>
      {doubleDoor ? (
        <>
          <group position={[-w / 2, 0, 0]}><Leaf w={w / 2 - 0.005} h={h - 0.02} mat={leaf} hingeAt={-1} angle={side * ang} t={t} /></group>
          <group position={[w / 2, 0, 0]}><Leaf w={w / 2 - 0.005} h={h - 0.02} mat={leaf} hingeAt={1} angle={-side * ang} t={t} /></group>
        </>
      ) : (
        <group position={[o.hinge === 'start' ? -w / 2 : w / 2, 0, 0]}>
          <Leaf w={w - 0.02} h={h - 0.02} mat={leaf} hingeAt={0} angle={0} t={t} />
        </group>
      )}
      {jamb}
    </group>
  )
}

/* ------------------------------- paredes ------------------------------ */

export type WallMode = 'full' | 'low'

function Baseboard({ w }: { w: RWall }) {
  const bb = w.baseboard
  if (!bb) return null
  const mat = getThreeMaterial(bb.material)
  const L = wallLength(w)
  // trechos entre portas
  const gaps = w.openings.filter(isNotch).map((o) => [o.offset - o.width / 2, o.offset + o.width / 2]).sort((p, q) => p[0] - q[0])
  const segs: [number, number][] = []
  let cur = 0
  for (const [g0, g1] of gaps) {
    if (g0 > cur) segs.push([cur, g0])
    cur = Math.max(cur, g1)
  }
  if (cur < L) segs.push([cur, L])
  const sides: (-1 | 1)[] = bb.sides === 'both' ? [-1, 1] : bb.sides === 'left' ? [-1] : [1]
  return (
    <>
      {segs.flatMap(([u0, u1], i) =>
        sides.map((s) => (
          <Box key={`${i}${s}`} size={[u1 - u0, bb.height, 0.014]} pos={[(u0 + u1) / 2, bb.height / 2, s * (w.thickness / 2 + 0.007)]} mat={mat} />
        )),
      )}
    </>
  )
}

export function Wall({ wall, all, mode, perimeter, inside = 'right', lowQuality, onPick }: { wall: RWall; all: RWall[]; mode: WallMode; perimeter: boolean; /** face voltada para dentro da casa (onde ficam cortinas) */ inside?: 'left' | 'right' } & CommonProps) {
  const geo = useMemo(() => buildWallGeometry(wall, all), [wall, all])
  const tf = wallTransform(wall)
  const group = useRef<THREE.Group>(null!)
  const target = mode === 'low' ? (perimeter ? 0.1 : 0.4) : 1
  const mats = useMemo(
    () => [getThreeMaterial(wall.left, lowQuality), getThreeMaterial(wall.right, lowQuality), getThreeMaterial(wall.top, lowQuality)],
    [wall.left, wall.right, wall.top, lowQuality],
  )
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), [target, invalidate])
  useFrame((_, dt) => {
    const s = group.current.scale.y
    if (s === target) return
    const n = THREE.MathUtils.damp(s, target, 8, dt)
    group.current.scale.y = Math.abs(n - target) < 0.002 ? target : n
    if (group.current.scale.y !== target) invalidate()
  })

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return
    e.stopPropagation()
    const mi = e.face?.materialIndex
    if (mi === undefined || mi === 2) return
    onPick?.({ type: 'wall', id: wall.id, side: mi === 0 ? 'left' : 'right' })
  }

  return (
    <group ref={group} position={[tf.position[0], tf.position[1] + wall.elevation, tf.position[2]]} rotation={[0, tf.rotationY, 0]}>
      <mesh geometry={geo} material={mats} castShadow={wall.kind !== 'glass'} receiveShadow onClick={click} />
      <Baseboard w={wall} />
      {wall.openings.map((o) => (
        <OpeningDecor key={o.id} o={o} t={wall.thickness} lowQuality={lowQuality} onPick={onPick} />
      ))}
      {wall.openings.map((o) =>
        o.treatment ? (
          <Treatment key={`tr-${o.id}`} o={o} t={o.treatment} thickness={wall.thickness} wallHeight={wall.height} side={(o.treatment.side ?? inside) === 'right' ? 1 : -1} lowQuality={lowQuality} onPick={onPick} />
        ) : null,
      )}
    </group>
  )
}

/* -------------------------------- pisos ------------------------------- */

function Room({ room, holes, upper, lowQuality, onPick }: { room: RRoom; holes: Point2[][]; upper: boolean } & CommonProps) {
  const shapes = useMemo(() => shapesWithHoles(room.polygon, holes), [room.polygon, holes])
  const geo = useMemo(() => floorGeometry(shapes), [shapes])
  const slab = useMemo(() => slabGeometry(shapes, 0.18), [shapes])
  const mat = getThreeMaterial(room.material, lowQuality)
  return (
    <group position={[0, room.elevation, 0]}>
      <mesh geometry={geo} material={mat} receiveShadow onClick={(e) => { if (e.delta > 4) return; e.stopPropagation(); onPick?.({ type: 'room', id: room.id }) }} />
      {/* a laje dos andares de cima faz sombra no de baixo */}
      <mesh geometry={slab} material={simpleMat('slab', { color: '#22252b', roughness: 0.8 })} receiveShadow castShadow={upper} />
    </group>
  )
}

/** Classifica cada parede: no perímetro (um lado sem piso) ou interna; devolve a normal externa. Cada andar separado. */
export function classifyWalls(scene: Pick<RenderScene, 'walls' | 'rooms'>) {
  const byLevel = new Map<string, Point2[][]>()
  for (const r of scene.rooms) byLevel.set(r.levelId, [...(byLevel.get(r.levelId) ?? []), r.polygon])
  const info = new Map<string, { perimeter: boolean; outward: Point2; inside: 'left' | 'right' }>()
  for (const w of scene.walls) {
    const polys = byLevel.get(w.levelId) ?? []
    const n = wallNormalRight(w)
    const mid: Point2 = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2]
    const off = w.thickness / 2 + 0.15
    const right = polys.some((p) => pointInPolygon([mid[0] + n[0] * off, mid[1] + n[1] * off], p))
    const left = polys.some((p) => pointInPolygon([mid[0] - n[0] * off, mid[1] - n[1] * off], p))
    if (right && left) info.set(w.id, { perimeter: false, outward: n, inside: 'right' })
    else if (right) info.set(w.id, { perimeter: true, outward: [-n[0], -n[1]], inside: 'right' })
    else info.set(w.id, { perimeter: true, outward: n, inside: left ? 'left' : 'right' })
  }
  return info
}

export type RoofMode = 'auto' | 'show' | 'hide'

export function Architecture({ scene, cutaway = 'auto', roofs = 'auto', lowQuality, onPick }: { scene: Pick<RenderScene, 'walls' | 'rooms' | 'objects' | 'roofs' | 'slabOpenings'> & { levels: RenderScene['levels'] }; cutaway?: Cutaway; roofs?: RoofMode } & CommonProps) {
  const info = useMemo(() => classifyWalls(scene), [scene])
  const camera = useThree((s) => s.camera)
  const modes = useRef(new Map<string, WallMode>())
  const [, setTick] = useState(0)
  // auto: o telhado só aparece com a câmera baixa (de cima ele esconderia a casa); histerese para não piscar
  const [roofsOn, setRoofsOn] = useState(roofs === 'show')
  const roofsOnRef = useRef(roofsOn)
  roofsOnRef.current = roofsOn
  const levelTop = useMemo(() => scene.levels.reduce((m, l) => Math.max(m, l.elevation + l.height), 0), [scene.levels])
  // vãos de escada: cortam o piso do próprio andar e o forro do andar de baixo
  const holesOf = useMemo(() => {
    const m: Record<string, Point2[][]> = {}
    for (const o of scene.slabOpenings) (m[o.levelId] ??= []).push(o.polygon)
    return m
  }, [scene.slabOpenings])
  const ceilingHoles = useMemo(() => {
    const m = new Map<string, Point2[][]>()
    for (const r of scene.rooms) {
      if (!r.ceiling) continue
      const top = r.elevation + r.ceiling.height
      m.set(r.id, scene.slabOpenings.filter((o: RSlabOpening) => o.elevation > top - 0.6 && o.elevation < top + 1.2).map((o) => o.polygon))
    }
    return m
  }, [scene.rooms, scene.slabOpenings])
  const center = useMemo(() => {
    const c = new THREE.Vector2()
    let n = 0
    scene.rooms.forEach((f) => f.polygon.forEach(([x, z]) => { c.x += x; c.y += z; n++ }))
    return n ? c.divideScalar(n) : c
  }, [scene.rooms])

  // Decide a cada quadro, mas só re-renderiza quando algum modo muda.
  useFrame(() => {
    let changed = false
    const toCam = new THREE.Vector2(camera.position.x - center.x, camera.position.z - center.y).normalize()
    for (const w of scene.walls) {
      const i = info.get(w.id)
      if (!i) continue
      const prev = modes.current.get(w.id)
      let mode: WallMode = 'full'
      if (w.kind === 'half' || w.kind === 'fence' || w.kind === 'railing') mode = 'full'
      else if (cutaway === 'all') mode = 'low'
      else if (cutaway === 'auto') {
        if (i.perimeter) mode = i.outward[0] * toCam.x + i.outward[1] * toCam.y > (prev === 'low' ? 0.1 : 0.25) ? 'low' : 'full'
        else mode = Math.abs(i.outward[0] * toCam.x + i.outward[1] * toCam.y) > (prev === 'low' ? 0.45 : 0.6) ? 'low' : 'full'
      }
      if (prev !== mode) { modes.current.set(w.id, mode); changed = true }
    }
    if (changed) setTick((n) => n + 1)

    const want = roofs === 'show' ? true : roofs === 'hide' ? false : (() => {
      const dy = camera.position.y - levelTop * 0.5
      const elev = (Math.atan2(dy, Math.hypot(camera.position.x - center.x, camera.position.z - center.y)) * 180) / Math.PI
      return elev < (roofsOnRef.current ? 33 : 27)
    })()
    if (want !== roofsOnRef.current) setRoofsOn(want)
  })

  return (
    <group>
      {scene.rooms.map((r) => (
        <Room key={r.id} room={r} holes={holesOf[r.levelId] ?? NO_HOLES} upper={r.elevation > 0.5} lowQuality={lowQuality} onPick={onPick} />
      ))}
      {roofsOn && scene.rooms.map((r) => r.ceiling && <Ceiling key={`ce-${r.id}`} room={r} holes={ceilingHoles.get(r.id) ?? NO_HOLES} lowQuality={lowQuality} />)}
      {scene.walls.map((w) => (
        <Wall key={w.id} wall={w} all={scene.walls} mode={modes.current.get(w.id) ?? 'full'} perimeter={info.get(w.id)?.perimeter ?? true} inside={info.get(w.id)?.inside} lowQuality={lowQuality} onPick={onPick} />
      ))}
      {scene.slabOpenings.map((o) => <SlabRailing key={o.id} opening={o} walls={scene.walls} objects={scene.objects} lowQuality={lowQuality} />)}
      {roofsOn && scene.roofs.map((r) => <Roof key={r.id} roof={r} lowQuality={lowQuality} />)}
    </group>
  )
}
