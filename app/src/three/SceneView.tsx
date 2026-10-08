import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, Line } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import type { View } from '../../../schema/types'
import type { ObjectPatch, ScenePick, RenderScene } from './render/types'
import type { Quality, Selection, SceneViewHandle, SceneViewProps, ViewPreset } from './types'
import { toRenderScene, parseTime } from './adapter/toRender'
import { Architecture } from './Architecture'
import { Site } from './Site'
import { Plinth } from './Plinth'
import { Items } from './interaction/Items'
import { LightBudget, Lighting, useLampLevel } from './lighting/Lighting'
import { TIME_PRESETS } from './lighting/daylight'
import { wallDir, wallLength, wallNormalRight } from './geometry/walls'

export type { ViewPreset, Quality, Selection, SceneViewHandle, SceneViewProps } from './types'

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
  return <Line userData={{ noExport: true }} points={pts} color="#ffb347" lineWidth={2.5} depthTest={false} renderOrder={20} />
}

function Rig({ center, radius, view, handle }: { center: THREE.Vector3; radius: number; view: ViewPreset; handle: React.Ref<SceneViewHandle> | null }) {
  const controls = useRef<CameraControls>(null!)
  const { gl, scene, camera } = useThree()
  const first = useRef(true)

  const applyPreset = (v: ViewPreset, animate: boolean) => {
    const az = v === 'front' ? 0 : THREE.MathUtils.degToRad(40)
    const el = v === 'top' ? 89 : v === 'front' ? 12 : 38
    const e = THREE.MathUtils.degToRad(el)
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(FOV / 2))) * (v === 'top' ? 1.0 : 1.12)
    const pos = new THREE.Vector3(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e)).multiplyScalar(dist).add(center)
    controls.current.setLookAt(pos.x, pos.y, pos.z, center.x, center.y - 0.15 * radius, center.z, animate)
  }

  useEffect(() => {
    applyPreset(view, !first.current)
    first.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, center, radius])

  useImperativeHandle(handle, () => ({
    // preserveDrawingBuffer: o canvas guarda o último quadro já com pós-processamento
    capture: () =>
      new Promise<Blob>((resolve, reject) =>
        gl.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao capturar a vista 3D'))), 'image/png'),
      ),
    exportGLB: async () => {
      const hidden: THREE.Object3D[] = []
      scene.traverse((o) => {
        if (o.userData.noExport || (o as THREE.Light).isLight) { if (o.visible) { o.visible = false; hidden.push(o) } }
      })
      try {
        const buf = (await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, maxTextureSize: 2048 })) as ArrayBuffer
        return new Blob([buf], { type: 'model/gltf-binary' })
      } finally {
        hidden.forEach((o) => (o.visible = true))
      }
    },
    setView: (v: View | ViewPreset) => {
      if (typeof v === 'string') return applyPreset(v, true)
      if (v.fovDeg && v.fovDeg !== (camera as THREE.PerspectiveCamera).fov) {
        ;(camera as THREE.PerspectiveCamera).fov = v.fovDeg
        camera.updateProjectionMatrix()
      }
      controls.current.setLookAt(v.position[0], v.position[1], v.position[2], v.target[0], v.target[1], v.target[2], true)
    },
    getView: () => {
      const p = new THREE.Vector3(), t = new THREE.Vector3()
      controls.current.getPosition(p)
      controls.current.getTarget(t)
      const r = (n: number) => Math.round(n * 100) / 100
      return { position: [r(p.x), r(p.y), r(p.z)], target: [r(t.x), r(t.y), r(t.z)], fovDeg: (camera as THREE.PerspectiveCamera).fov }
    },
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

/** Pede um novo quadro quando algo do React muda (o canvas usa frameloop="demand" para poupar bateria). */
function Invalidate({ deps }: { deps: unknown[] }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), deps) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

/**
 * Mede o tempo dos quadros em trechos contínuos (câmera mexendo, animações) e, se o aparelho não dá conta,
 * pede para descer um nível de qualidade. Quadros isolados depois de ficar parado não contam.
 */
function Governor({ onDecline }: { onDecline: () => void }) {
  const st = useRef({ last: 0, sum: 0, n: 0, skip: 120, bad: 0 })
  useFrame(() => {
    const s = st.current
    const now = performance.now()
    const gap = now - s.last
    s.last = now
    if (gap > 500) { s.sum = 0; s.n = 0; return } // veio de uma pausa: não é medida
    if (s.skip > 0) { s.skip--; return } // aquecimento (compilação de shaders, texturas)
    s.sum += gap
    s.n++
    if (s.n < 90) return
    const avg = s.sum / s.n
    s.sum = 0
    s.n = 0
    s.bad = avg > 30 ? s.bad + 1 : 0 // pior que ~33 quadros/s
    if (s.bad >= 2) { s.bad = 0; s.skip = 120; onDecline() }
  })
  return null
}

const SETTINGS: Record<Quality, { shadows: false | 'percentage' | 'soft'; shadowSize: number; dpr: [number, number]; post: boolean; ao: boolean; lights: boolean }> = {
  low: { shadows: false, shadowSize: 1024, dpr: [1, 1], post: false, ao: false, lights: false },
  medium: { shadows: 'percentage', shadowSize: 1024, dpr: [1, 1.5], post: true, ao: false, lights: true },
  high: { shadows: 'soft', shadowSize: 2048, dpr: [1, 2], post: true, ao: true, lights: true },
}
const NEXT_DOWN: Record<Quality, Quality> = { high: 'medium', medium: 'low', low: 'low' }

function Effects({ lamp, ao }: { lamp: number; ao: boolean }) {
  const bloom = <Bloom intensity={0.15 + lamp * 0.55} luminanceThreshold={0.85} luminanceSmoothing={0.3} mipmapBlur />
  return ao ? (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={0.55} intensity={2.2} distanceFalloff={0.8} aoSamples={14} denoiseSamples={6} denoiseRadius={10} quality="medium" halfRes />
      {bloom}
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {bloom}
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

const toPick = (s: Selection): ScenePick | null => {
  if (!s || s.kind === 'site') return null
  if (s.kind === 'wall') return { type: 'wall', id: s.id, side: s.side ?? 'left' }
  return { type: s.kind, id: s.id }
}
const toSelection = (p: ScenePick | null): Selection => (!p ? null : p.type === 'wall' ? { kind: 'wall', id: p.id, side: p.side } : { kind: p.type, id: p.id })

/**
 * Motor 3D do Design3D. Lê só o `Scene` do schema e nunca o altera:
 * toda mudança sai por `onPick`, `onDragEnd`, `onDelete` e `onTimeChange`.
 */
export const SceneView = forwardRef<SceneViewHandle, SceneViewProps>(function SceneView(props, ref) {
  const { scene, selection = null, onPick, onDragEnd, onDelete, timeOfDay, onTimeChange, view = 'iso', cutaway = 'auto', quality = 'high', showSunGizmo = true, className, style } = props
  const rs = useMemo(() => toRenderScene(scene, { upToLevel: props.upToLevel }), [scene, props.upToLevel])
  const { box, center, radius } = useMemo(() => sceneBounds(rs), [rs])
  const bounds: [number, number, number, number] = [box.min.x + 0.05, box.min.z + 0.05, box.max.x - 0.05, box.max.z - 0.05]
  const lamp = useLampLevel((s) => s.lamp)
  // o nível pedido é o teto; se o aparelho não acompanhar, desce sozinho (adaptive, padrão ligado)
  const [tier, setTier] = useState<Quality>(quality)
  useEffect(() => setTier(quality), [quality])
  const cfg = SETTINGS[tier]
  const low = tier === 'low'
  const snap = props.snap ?? scene.defaults?.snap ?? 0.05
  const hours = typeof timeOfDay === 'string' ? parseTime(timeOfDay, rs.env.timeOfDay) : timeOfDay ?? rs.env.timeOfDay
  const objects = useMemo(() => [...rs.objects, ...(rs.site?.objects ?? [])], [rs])
  const walls = useMemo(() => [...rs.walls, ...(rs.site?.walls ?? [])], [rs])
  const pick = toPick(selection)

  // eventos para o App: posição volta ao espaço da cena (sem a elevação do andar)
  const objectsRef = useRef(objects)
  objectsRef.current = objects
  const dragEnd = useMemo(
    () => (id: string, patch: ObjectPatch) => {
      const o = objectsRef.current.find((x) => x.id === id)
      if (!o) return
      const p = patch.position ?? o.position
      const r = (n: number) => Math.round(n * 1000) / 1000
      onDragEnd?.({ id, position: [r(p[0]), r(p[1] - o.elevation), r(p[2])], ...(patch.rotationDeg !== undefined ? { rotationDeg: ((patch.rotationDeg % 360) + 360) % 360 } : {}) })
    },
    [onDragEnd],
  )
  const picked = useMemo(() => (p: ScenePick | null) => onPick?.(toSelection(p)), [onPick])

  // atalhos: R/Shift+R gira 90°, Q/E gira 15°, Delete remove
  const selObj = pick?.type === 'object' ? objects.find((o) => o.id === pick.id) ?? null : null
  const sel = useRef(selObj)
  sel.current = selObj
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      const o = sel.current
      if (!o || o.locked || e.ctrlKey || e.metaKey) return
      const cur = (o.rotationY * 180) / Math.PI
      const rot = (d: number) => dragEnd(o.id, { rotationDeg: Math.round((cur + d) * 100) / 100 })
      const k = e.key.toLowerCase()
      if (k === 'r') rot(e.shiftKey ? -90 : 90)
      else if (k === 'q') rot(-15)
      else if (k === 'e') rot(15)
      else if (k === 'delete' || k === 'backspace') onDelete?.(o.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dragEnd, onDelete])

  return (
    <Canvas
      className={className}
      style={{ touchAction: 'none', width: '100%', height: '100%', ...style }}
      frameloop="demand"
      shadows={cfg.shadows}
      dpr={cfg.dpr}
      camera={{ fov: FOV, near: 0.1, far: 500, position: [10, 10, 10] }}
      gl={{ antialias: !cfg.post, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: true }}
      onPointerMissed={() => picked(null)}
    >
      <Rig center={center} radius={radius} view={view} handle={ref} />
      <Lighting time={hours} center={center} radius={radius} shadows={!!cfg.shadows} shadowSize={cfg.shadowSize} onTimeChange={onTimeChange} showGizmo={showSunGizmo} northDeg={rs.env.northDeg} sky={rs.env.sky} exposure={rs.env.exposure} />
      {rs.site ? <Site site={rs.site} lowQuality={low} onPick={picked} /> : <Plinth box={box} />}
      <Architecture scene={rs} cutaway={cutaway} roofs={props.roofs} lowQuality={low} onPick={picked} />
      <LightBudget.Provider value={cfg.lights}>
      <Items objects={objects} walls={walls} bounds={bounds} selectedId={selObj?.id ?? null} interiorLights={rs.env.interiorLights} onPick={picked} onDragEnd={dragEnd} snap={snap} lowQuality={low} />
      </LightBudget.Provider>
      {pick && pick.type !== 'object' && pick.type !== 'opening' && <PickOutline rs={rs} pick={pick} />}
      {cfg.post && <Effects lamp={rs.env.interiorLights === 'on' ? 1 : rs.env.interiorLights === 'off' ? 0 : lamp} ao={cfg.ao} />}
      {props.adaptive !== false && tier !== 'low' && <Governor onDecline={() => setTier((t) => NEXT_DOWN[t])} />}
      <Invalidate deps={[rs, pick, hours, cutaway, props.roofs, tier, view, snap, showSunGizmo]} />
    </Canvas>
  )
})
