import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { CameraControls, Line } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import type { Scene } from '../../../schema/types'
import type { ObjectPatch, ScenePick, RenderScene } from './render/types'
import { toRenderScene, parseTime } from './adapter/toRender'
import { Architecture, type Cutaway } from './Architecture'
import { Site } from './Site'
import { Items } from './interaction/Items'
import { Lighting, useLampLevel } from './lighting/Lighting'
import { TIME_PRESETS, type TimePreset } from './lighting/daylight'
import { wallDir, wallLength, wallNormalRight } from './geometry/walls'

export type ViewPreset = 'iso' | 'top' | 'front'
export type Quality = 'low' | 'high'

export interface SceneViewHandle {
  /** PNG (data URL) do quadro atual, para miniaturas e "snapshot" da IA */
  capture(): string
  setView(v: ViewPreset): void
  /** hora decimal de um preset (Manhã, Meio-dia, Tarde, Noite) */
  timeOfPreset(p: TimePreset): number
}

export interface SceneViewProps {
  scene: Scene
  /** o que está selecionado (destaque no 3D) */
  selection?: ScenePick | null
  /** clique em objeto, parede (lado), piso/cômodo, abertura ou zona do terreno; null = clique no vazio */
  onPick?: (p: ScenePick | null) => void
  /** fim de um arraste ou giro (R/Q/E): o App transforma em comando */
  onDragEnd?: (id: string, patch: ObjectPatch) => void
  /** Delete/Backspace com um objeto selecionado */
  onDelete?: (id: string) => void
  /** hora do dia em horas decimais (18.5 = 18:30) ou "HH:MM"; sem ela usa scene.environment.timeOfDay */
  timeOfDay?: number | string
  /** o usuário arrastou o sol no 3D */
  onTimeChange?: (t: number) => void
  view?: ViewPreset
  /** paredes que escondem a vista ficam baixas: 'auto' pela câmera */
  cutaway?: Cutaway
  quality?: Quality
  /** passo da grade ao arrastar (m); sem valor usa scene.defaults.snap */
  snap?: number
  showSunGizmo?: boolean
  className?: string
  style?: React.CSSProperties
}

const FOV = 28

function sceneBounds(rs: RenderScene) {
  const box = new THREE.Box3()
  const add = (x: number, z: number) => box.expandByPoint(new THREE.Vector3(x, 0, z))
  rs.rooms.forEach((f) => f.polygon.forEach(([x, z]) => add(x, z)))
  rs.walls.forEach((w) => { add(...w.a); add(...w.b) })
  rs.site?.boundary?.forEach(([x, z]) => add(x, z))
  rs.site?.zones.forEach((zn) => zn.polygon.forEach(([x, z]) => add(x, z)))
  if (box.isEmpty()) { add(-3, -3); add(3, 3) }
  const top = Math.max(2.7, ...rs.levels.map((l) => l.elevation + l.height))
  box.max.y = top
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  center.y = top * 0.33
  const radius = Math.max(2.5, Math.hypot(size.x, size.z) / 2)
  return { box, center, radius }
}

function PickOutline({ rs, pick }: { rs: RenderScene; pick: ScenePick }) {
  const pts = useMemo(() => {
    if (pick.type === 'room') {
      const r = rs.rooms.find((x) => x.id === pick.id)
      return r ? [...r.polygon, r.polygon[0]].map(([x, z]) => new THREE.Vector3(x, r.elevation + 0.015, z)) : null
    }
    if (pick.type === 'zone') {
      const z = rs.site?.zones.find((x) => x.id === pick.id)
      return z ? [...z.polygon, z.polygon[0]].map(([x, zz]) => new THREE.Vector3(x, z.elevation + 0.02, zz)) : null
    }
    if (pick.type === 'wall') {
      const w = [...rs.walls, ...(rs.site?.walls ?? [])].find((x) => x.id === pick.id)
      if (!w) return null
      const n = wallNormalRight(w)
      const sgn = pick.side === 'right' ? 1 : -1
      const off = w.thickness / 2 + 0.012
      const d = wallDir(w)
      const L = wallLength(w)
      const q = (u: number, y: number) => new THREE.Vector3(w.a[0] + d[0] * u + n[0] * off * sgn, w.elevation + y, w.a[1] + d[1] * u + n[1] * off * sgn)
      return [q(0, 0.02), q(L, 0.02), q(L, w.heightEnd), q(0, w.height), q(0, 0.02)]
    }
    return null
  }, [rs, pick])
  if (!pts) return null
  return <Line points={pts} color="#ffb347" lineWidth={2.5} depthTest={false} renderOrder={20} />
}

function Rig({ center, radius, view, handle }: { center: THREE.Vector3; radius: number; view: ViewPreset; handle: React.Ref<SceneViewHandle> | null }) {
  const controls = useRef<CameraControls>(null!)
  const { gl, scene, camera } = useThree()
  const first = useRef(true)

  const apply = (v: ViewPreset, animate: boolean) => {
    const az = v === 'front' ? 0 : THREE.MathUtils.degToRad(40)
    const el = v === 'top' ? 89 : v === 'front' ? 12 : 38
    const e = THREE.MathUtils.degToRad(el)
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(FOV / 2))) * (v === 'top' ? 1.0 : 1.12)
    const pos = new THREE.Vector3(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e)).multiplyScalar(dist).add(center)
    controls.current.setLookAt(pos.x, pos.y, pos.z, center.x, center.y - 0.15 * radius, center.z, animate)
  }

  useEffect(() => {
    apply(view, !first.current)
    first.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, center, radius])

  useImperativeHandle(handle, () => ({
    capture() {
      gl.render(scene, camera)
      return gl.domElement.toDataURL('image/png')
    },
    setView: (v) => apply(v, true),
    timeOfPreset: (p) => TIME_PRESETS[p],
  }))

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={radius * 0.9}
      maxDistance={radius * 9}
      minPolarAngle={0.05}
      maxPolarAngle={Math.PI / 2 - 0.04}
      smoothTime={0.18}
      draggingSmoothTime={0.08}
      dollyToCursor
    />
  )
}

function Effects({ lamp }: { lamp: number }) {
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <Bloom intensity={0.15 + lamp * 0.55} luminanceThreshold={0.85} luminanceSmoothing={0.3} mipmapBlur />
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

/**
 * Motor 3D do Design3D. Lê só o `Scene` do schema e nunca o altera:
 * toda mudança sai por `onPick`, `onDragEnd`, `onDelete` e `onTimeChange`.
 */
export const SceneView = forwardRef<SceneViewHandle, SceneViewProps>(function SceneView(props, ref) {
  const { scene, selection = null, onPick, onDragEnd, onDelete, timeOfDay, onTimeChange, view = 'iso', cutaway = 'auto', quality = 'high', showSunGizmo = true, className, style } = props
  const rs = useMemo(() => toRenderScene(scene), [scene])
  const { box, center, radius } = useMemo(() => sceneBounds(rs), [rs])
  const bounds: [number, number, number, number] = [box.min.x + 0.05, box.min.z + 0.05, box.max.x - 0.05, box.max.z - 0.05]
  const lamp = useLampLevel((s) => s.lamp)
  const low = quality === 'low'
  const snap = props.snap ?? scene.defaults?.snap ?? 0.05
  const hours = typeof timeOfDay === 'string' ? parseTime(timeOfDay, rs.env.timeOfDay) : timeOfDay ?? rs.env.timeOfDay
  const objects = useMemo(() => [...rs.objects, ...(rs.site?.objects ?? [])], [rs])
  const walls = useMemo(() => [...rs.walls, ...(rs.site?.walls ?? [])], [rs])

  // atalhos: R/Shift+R gira 90°, Q/E gira 15°, Delete remove
  const selObj = selection?.type === 'object' ? objects.find((o) => o.id === selection.id) ?? null : null
  const sel = useRef(selObj)
  sel.current = selObj
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      const o = sel.current
      if (!o || o.locked || e.ctrlKey || e.metaKey) return
      const cur = (o.rotationY * 180) / Math.PI
      const rot = (d: number) => onDragEnd?.(o.id, { rotationDeg: Math.round((cur + d) * 100) / 100 })
      const k = e.key.toLowerCase()
      if (k === 'r') rot(e.shiftKey ? -90 : 90)
      else if (k === 'q') rot(-15)
      else if (k === 'e') rot(15)
      else if (k === 'delete' || k === 'backspace') onDelete?.(o.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDragEnd, onDelete])

  return (
    <Canvas
      className={className}
      style={{ touchAction: 'none', ...style }}
      shadows={low ? false : 'soft'}
      dpr={low ? 1 : [1, 2]}
      camera={{ fov: FOV, near: 0.1, far: 500, position: [10, 10, 10] }}
      gl={{ antialias: low, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: true }}
      onPointerMissed={() => onPick?.(null)}
    >
      <Rig center={center} radius={radius} view={view} handle={ref} />
      <Lighting time={hours} center={center} radius={radius} shadows={!low} onTimeChange={onTimeChange} showGizmo={showSunGizmo} northDeg={rs.env.northDeg} sky={rs.env.sky} exposure={rs.env.exposure} />
      {rs.site && <Site site={rs.site} lowQuality={low} onPick={onPick} />}
      <Architecture scene={rs} cutaway={cutaway} lowQuality={low} onPick={onPick} />
      <Items objects={objects} walls={walls} bounds={bounds} selectedId={selObj?.id ?? null} interiorLights={rs.env.interiorLights} onPick={onPick} onDragEnd={onDragEnd} snap={snap} lowQuality={low} />
      {selection && selection.type !== 'object' && selection.type !== 'opening' && <PickOutline rs={rs} pick={selection} />}
      {!low && <Effects lamp={rs.env.interiorLights === 'on' ? 1 : rs.env.interiorLights === 'off' ? 0 : lamp} />}
    </Canvas>
  )
})
