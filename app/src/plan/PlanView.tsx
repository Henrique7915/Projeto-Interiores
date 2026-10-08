import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import {
  allContainers,
  bbox,
  dist,
  findAnnotation,
  findObject,
  findOpening,
  findRoof,
  findSlabOpening,
  findRoom,
  findWall,
  getCatalogItem,
  groupOfObject,
  nameOf,
  objectCorners,
  objectDims,
  objectMaterials,
  pointOnWall,
  polygonArea,
  projectOnSegment,
  resolveMaterial,
  round,
  snap as snapTo,
  wallDir,
  wallLength,
  wallNormalRight,
  type Container,
  type Point2,
  type Scene,
  type Wall,
} from '../core'
import { fmtArea, fmtLen, parseLen } from '../lib/units'
import { activeLevelOf, useEditor, type PlanTool } from '../state/store'
import { Icon, IconButton, toast } from '../ui/common'
import { LevelBar } from '../ui/LevelBar'

/** Estado da câmera 2D: centro do mundo (m) e escala (px por metro). */
interface Cam {
  cx: number
  cz: number
  k: number
}

type Drag =
  | { type: 'pan'; sx: number; sy: number; cam: Cam }
  | { type: 'object'; id: string; off: Point2; moved: boolean }
  | { type: 'rotate'; id: string }
  | { type: 'room'; id: string; start: Point2; applied: Point2; moved: boolean }
  | { type: 'resize'; id: string; handle: Handle; box: ReturnType<typeof bbox> }
  | { type: 'wallEnd'; id: string; end: 'start' | 'end' }
  | { type: 'opening'; id: string }
  | { type: 'draw-room'; a: Point2; b: Point2 }
  | { type: 'measure'; a: Point2; b: Point2 }
  | { type: 'dim'; a: Point2; b: Point2 }

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const HANDLES: { h: Handle; fx: number; fz: number }[] = [
  { h: 'nw', fx: 0, fz: 0 },
  { h: 'n', fx: 0.5, fz: 0 },
  { h: 'ne', fx: 1, fz: 0 },
  { h: 'e', fx: 1, fz: 0.5 },
  { h: 'se', fx: 1, fz: 1 },
  { h: 's', fx: 0.5, fz: 1 },
  { h: 'sw', fx: 0, fz: 1 },
  { h: 'w', fx: 0, fz: 0.5 },
]

const ACCENT = '#f2b45a'
const sceneBounds = (scene: Scene) => {
  const pts: Point2[] = []
  for (const l of scene.levels) for (const r of l.rooms ?? []) pts.push(...r.polygon)
  if (scene.site?.boundary) pts.push(...scene.site.boundary)
  for (const z of scene.site?.zones ?? []) pts.push(...z.polygon)
  for (const { c } of allContainers(scene)) for (const w of c.walls ?? []) pts.push(w.start, w.end)
  for (const { c } of allContainers(scene)) for (const o of c.objects ?? []) pts.push([o.position[0], o.position[2]])
  return pts.length ? bbox(pts) : { minX: 0, minZ: 0, maxX: 6, maxZ: 5, width: 6, depth: 5 }
}

export function PlanView() {
  const scene = useEditor((s) => s.scene)
  const selection = useEditor((s) => s.selection)
  const tool = useEditor((s) => s.tool)
  const unit = useEditor((s) => s.unit)
  const snapStep = useEditor((s) => s.snap)
  const activeLevelId = useEditor((s) => s.activeLevel)
  const { select, setTool, dispatch, beginGesture, endGesture } = useEditor.getState()

  const wrap = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [cam, setCam] = useState<Cam>({ cx: 3, cz: 2.5, k: 60 })
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const [hover, setHover] = useState<Point2 | null>(null)
  const [wallStart, setWallStart] = useState<Point2 | null>(null)
  const [lenText, setLenText] = useState('')
  const [labelAt, setLabelAt] = useState<Point2 | null>(null)
  const [labelText, setLabelText] = useState('')
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; cam: Cam } | null>(null)
  const fitted = useRef<string>('')

  const setD = (d: Drag | null) => {
    dragRef.current = d
    setDrag(d)
  }

  /* tamanho do contêiner */
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 800, h: el.clientHeight || 600 }))
    ro.observe(el)
    setSize({ w: el.clientWidth || 800, h: el.clientHeight || 600 })
    return () => ro.disconnect()
  }, [])

  const fit = useCallback(() => {
    const b = sceneBounds(scene)
    const pad = 90
    const k = Math.max(8, Math.min(140, Math.min((size.w - pad * 2) / Math.max(b.width, 1), (size.h - pad * 2 - 150) / Math.max(b.depth, 1))))
    setCam({ cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2 + 60 / k, k })
  }, [scene, size.w, size.h])

  useEffect(() => {
    if (fitted.current !== scene.id && size.w > 0) {
      fitted.current = scene.id
      fit()
    }
  }, [scene.id, size.w, fit])

  /* conversões mundo ↔ tela */
  const S = useCallback((p: Point2): Point2 => [(p[0] - cam.cx) * cam.k + size.w / 2, (p[1] - cam.cz) * cam.k + size.h / 2], [cam, size])
  const W = useCallback((sx: number, sy: number): Point2 => [(sx - size.w / 2) / cam.k + cam.cx, (sy - size.h / 2) / cam.k + cam.cz], [cam, size])
  const evWorld = (e: { clientX: number; clientY: number }): Point2 => {
    const r = wrap.current!.getBoundingClientRect()
    return W(e.clientX - r.left, e.clientY - r.top)
  }
  const sn = (v: number, alt = false) => (alt || !snapStep ? v : snapTo(v, snapStep))
  const snapPt = (p: Point2, alt = false): Point2 => [sn(p[0], alt), sn(p[1], alt)]

  /* ───── coletas: só o andar em edição (e o terreno); o de baixo aparece como sombra ───── */
  const active = activeLevelOf(scene, activeLevelId)
  const activeIdx = active ? scene.levels.indexOf(active) : -1
  const below = activeIdx > 0 ? scene.levels[activeIdx - 1] : undefined
  const shown: { key: string; c: Container }[] = [...(active ? [{ key: active.id, c: active as Container }] : []), ...(scene.site ? [{ key: 'site', c: scene.site as Container }] : [])]
  const rooms = (active?.rooms ?? []).map((r) => ({ r, l: active! }))
  const zones = scene.site?.zones ?? []
  const wallsAll = shown.flatMap(({ c }) => (c.walls ?? []).map((w) => ({ w, c })))
  const objs = shown.flatMap(({ c }) => (c.objects ?? []).filter((o) => !o.hidden).map((o) => ({ o, c })))
  const annots = shown.flatMap(({ c }) => c.annotations ?? [])

  /* ───── pontos de encaixe de paredes ───── */
  const wallSnap = (p: Point2, alt: boolean): Point2 => {
    if (!alt) {
      for (const { w } of wallsAll) for (const e of [w.start, w.end]) if (dist(e, p) < 0.18) return e
    }
    return snapPt(p, alt)
  }

  /* ───── eventos ───── */
  const onBgDown = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest('.plan-ui')) return
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    const r = wrap.current!.getBoundingClientRect()
    pointers.current.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), cam }
      setD(null)
      return
    }
    const w = evWorld(e)
    if (tool === 'room') return setD({ type: 'draw-room', a: snapPt(w, e.altKey), b: snapPt(w, e.altKey) })
    if (tool === 'measure') return setD({ type: 'measure', a: snapPt(w, e.altKey), b: snapPt(w, e.altKey) })
    if (tool === 'dim') return setD({ type: 'dim', a: wallSnap(w, e.altKey), b: wallSnap(w, e.altKey) })
    if (tool === 'text') return setLabelAt(snapPt(w, e.altKey)), setLabelText('')
    if (tool === 'wall') {
      const p = wallSnap(w, e.altKey)
      if (!wallStart) return setWallStart(p), setLenText('')
      return commitWall(wallStart, p)
    }
    select(null)
    setD({ type: 'pan', sx: e.clientX, sy: e.clientY, cam })
  }

  function commitWall(a: Point2, b: Point2) {
    if (dist(a, b) < 0.05) return
    const r = dispatch([{ op: 'addWall', start: a, end: b, container: active ? active.id : 'site' }])
    if (r.errors.length) toast(r.errors[0].message, 'err')
    setWallStart(b)
    setLenText('')
    select(null)
  }

  const onMove = (e: RPointerEvent) => {
    const r = wrap.current!.getBoundingClientRect()
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top })
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const k = Math.max(6, Math.min(400, pinch.current.cam.k * (d / pinch.current.d)))
      setCam({ ...pinch.current.cam, k })
      return
    }
    const w = evWorld(e)
    setHover(w)
    const d = dragRef.current
    if (!d) return
    if (d.type === 'pan') {
      setCam({ ...d.cam, cx: d.cam.cx - (e.clientX - d.sx) / d.cam.k, cz: d.cam.cz - (e.clientY - d.sy) / d.cam.k })
    } else if (d.type === 'draw-room' || d.type === 'measure') {
      setD({ ...d, b: snapPt(w, e.altKey) })
    } else if (d.type === 'dim') {
      setD({ ...d, b: wallSnap(w, e.altKey) })
    } else if (d.type === 'object') {
      const p = snapPt([w[0] - d.off[0], w[1] - d.off[1]], e.altKey)
      if (!d.moved) {
        beginGesture()
        d.moved = true
      }
      const ob = findObject(useEditor.getState().scene, d.id)?.entity
      if (ob && (round(ob.position[0], 3) !== round(p[0], 3) || round(ob.position[2], 3) !== round(p[1], 3))) dispatch([{ op: 'updateObject', id: d.id, patch: { x: p[0], z: p[1] } }], { gesture: true })
    } else if (d.type === 'rotate') {
      const ob = findObject(useEditor.getState().scene, d.id)?.entity
      if (!ob) return
      let a = (Math.atan2(w[0] - ob.position[0], w[1] - ob.position[2]) * 180) / Math.PI
      if (!e.altKey) a = Math.round(a / 5) * 5
      dispatch([{ op: 'updateObject', id: d.id, patch: { rotationDeg: a } }], { gesture: true })
    } else if (d.type === 'room') {
      const dx = sn(w[0] - d.start[0], e.altKey) - d.applied[0]
      const dz = sn(w[1] - d.start[1], e.altKey) - d.applied[1]
      if (!dx && !dz) return
      if (!d.moved) {
        beginGesture()
        d.moved = true
      }
      dispatch([{ op: 'moveRoom', id: d.id, dx, dz }], { gesture: true })
      d.applied = [d.applied[0] + dx, d.applied[1] + dz]
    } else if (d.type === 'resize') {
      const p = snapPt(w, e.altKey)
      let { minX, minZ, maxX, maxZ } = d.box
      if (d.handle.includes('w')) minX = Math.min(p[0], maxX - 0.3)
      if (d.handle.includes('e')) maxX = Math.max(p[0], minX + 0.3)
      if (d.handle.includes('n')) minZ = Math.min(p[1], maxZ - 0.3)
      if (d.handle.includes('s')) maxZ = Math.max(p[1], minZ + 0.3)
      dispatch([{ op: 'resizeRoom', id: d.id, x: minX, z: minZ, width: maxX - minX, depth: maxZ - minZ }], { gesture: true })
    } else if (d.type === 'wallEnd') {
      const p = wallSnap(w, e.altKey)
      dispatch([{ op: 'updateWall', id: d.id, patch: { [d.end]: p } }], { gesture: true })
    } else if (d.type === 'opening') {
      const sc = useEditor.getState().scene
      const o = findOpening(sc, d.id)
      const wl = o && findWall(sc, o.entity.wallId)
      if (!o || !wl) return
      const pr = projectOnSegment(w, wl.entity.start, wl.entity.end)
      const off = sn(pr.t * wallLength(wl.entity), e.altKey)
      dispatch([{ op: 'updateOpening', id: d.id, patch: { offset: off } }], { gesture: true })
    }
  }

  const onUp = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    const d = dragRef.current
    if (!d) return
    if (d.type === 'draw-room') {
      const w = Math.abs(d.b[0] - d.a[0])
      const h = Math.abs(d.b[1] - d.a[1])
      if (w >= 0.5 && h >= 0.5) {
        const n = scene.levels.flatMap((l) => l.rooms ?? []).length + 1
        dispatch([{ op: 'addRoom', name: `Ambiente ${n}`, x: Math.min(d.a[0], d.b[0]), z: Math.min(d.a[1], d.b[1]), width: w, depth: h, ...(active ? { container: active.id } : {}) }])
        setTool('select')
      }
    } else if (d.type === 'dim') {
      if (dist(d.a, d.b) >= 0.05) {
        const r = dispatch([{ op: 'addDimension', start: d.a, end: d.b, offset: 0.4, ...(active ? { container: active.id } : {}) }])
        if (r.errors.length) toast(r.errors[0].message, 'err')
        else setTool('select')
      }
    } else if (d.type !== 'pan' && d.type !== 'measure') {
      endGesture()
    }
    if (d.type !== 'measure') setD(null)
  }

  const onWheel = (e: React.WheelEvent) => {
    const r = wrap.current!.getBoundingClientRect()
    const sx = e.clientX - r.left
    const sy = e.clientY - r.top
    const before = W(sx, sy)
    const k = Math.max(6, Math.min(400, cam.k * Math.exp(-e.deltaY * 0.0015)))
    setCam({ k, cx: before[0] - (sx - size.w / 2) / k, cz: before[1] - (sy - size.h / 2) / k })
  }

  /* teclado local: Esc cancela, Enter confirma comprimento digitado */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
      if (e.key === 'Escape') {
        setWallStart(null)
        setLabelAt(null)
        setD(null)
        if (useEditor.getState().tool !== 'select') setTool('select')
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [setTool])

  useEffect(() => {
    if (tool !== 'wall') setWallStart(null)
    if (tool !== 'text') setLabelAt(null)
  }, [tool])

  /* prévia da parede em desenho */
  const wallPreview = useMemo(() => {
    if (tool !== 'wall' || !wallStart || !hover) return null
    let end = wallSnap(hover, false)
    // ortogonal quando perto de 0°/90°
    const dx = end[0] - wallStart[0]
    const dz = end[1] - wallStart[1]
    if (Math.abs(dx) > 0.01 && Math.abs(dz) / Math.abs(dx) < 0.06) end = [end[0], wallStart[1]]
    else if (Math.abs(dz) > 0.01 && Math.abs(dx) / Math.abs(dz) < 0.06) end = [wallStart[0], end[1]]
    const typed = parseLen(lenText, unit)
    if (typed && typed > 0) {
      const L = dist(wallStart, end) || 1
      end = [wallStart[0] + ((end[0] - wallStart[0]) / L) * typed, wallStart[1] + ((end[1] - wallStart[1]) / L) * typed]
    }
    return end
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, wallStart, hover, lenText, unit, snapStep])

  /* ───── helpers de desenho ───── */
  const polyPath = (pts: Point2[]) => 'M' + pts.map((p) => S(p).join(',')).join('L') + 'Z'
  const wallQuad = (w: Wall): Point2[] => {
    const n = wallNormalRight(w)
    const t = (w.thickness ?? 0.15) / 2
    return [
      [w.start[0] + n[0] * t, w.start[1] + n[1] * t],
      [w.end[0] + n[0] * t, w.end[1] + n[1] * t],
      [w.end[0] - n[0] * t, w.end[1] - n[1] * t],
      [w.start[0] - n[0] * t, w.start[1] - n[1] * t],
    ]
  }

  const gridLines = useMemo(() => {
    const step = cam.k > 90 ? 0.5 : cam.k > 28 ? 1 : cam.k > 12 ? 5 : 10
    const a = W(0, 0)
    const b = W(size.w, size.h)
    const out: ReactNode[] = []
    for (let x = Math.floor(a[0] / step) * step; x <= b[0]; x += step) {
      const sx = (x - cam.cx) * cam.k + size.w / 2
      out.push(<line key={'x' + x} x1={sx} y1={0} x2={sx} y2={size.h} stroke={Math.abs(x % 5) < 1e-6 ? '#26304a' : '#1b2338'} strokeWidth={1} />)
    }
    for (let z = Math.floor(a[1] / step) * step; z <= b[1]; z += step) {
      const sy = (z - cam.cz) * cam.k + size.h / 2
      out.push(<line key={'z' + z} x1={0} y1={sy} x2={size.w} y2={sy} stroke={Math.abs(z % 5) < 1e-6 ? '#26304a' : '#1b2338'} strokeWidth={1} />)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam, size])

  const dimLine = (a: Point2, b: Point2, label: string, offset = 22, key?: string, color?: string) => {
    const [x1, y1] = S(a)
    const [x2, y2] = S(b)
    const dx = x2 - x1
    const dy = y2 - y1
    const L = Math.hypot(dx, dy) || 1
    const nx = -dy / L
    const ny = dx / L
    const ox = nx * offset
    const oy = ny * offset
    const mx = (x1 + x2) / 2 + ox
    const my = (y1 + y2) / 2 + oy
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI
    if (ang > 90 || ang < -90) ang += 180
    return (
      <g key={key} pointerEvents="none">
        <line x1={x1 + ox} y1={y1 + oy} x2={x2 + ox} y2={y2 + oy} stroke={color ?? "#7e8aab"} strokeWidth={color ? 1.6 : 1} />
        <line x1={x1} y1={y1} x2={x1 + ox * 1.1} y2={y1 + oy * 1.1} stroke="#4c5877" strokeWidth={1} />
        <line x1={x2} y1={y2} x2={x2 + ox * 1.1} y2={y2 + oy * 1.1} stroke="#4c5877" strokeWidth={1} />
        <g transform={`translate(${mx},${my}) rotate(${ang})`}>
          <rect x={-label.length * 3.6 - 4} y={-9} width={label.length * 7.2 + 8} height={16} rx={5} fill="#0f1320" opacity={0.92} />
          <text textAnchor="middle" y={3.5} fontSize={11.5} fill="#cfd8f2" fontWeight={600}>
            {label}
          </text>
        </g>
      </g>
    )
  }

  const selRoom = selection?.kind === 'room' ? findRoom(scene, selection.id) : undefined
  const selWall = selection?.kind === 'wall' ? findWall(scene, selection.id) : undefined
  const selObj = selection?.kind === 'object' ? findObject(scene, selection.id) : undefined

  const down = (e: RPointerEvent, fn: () => void, wallOnly = false) => {
    if (tool === 'door' || tool === 'window') {
      if (!wallOnly) return // só paredes reagem aos cliques de porta/janela
    } else if (tool !== 'select') return // ferramentas de desenho tratam no fundo
    e.stopPropagation()
    ;(wrap.current as HTMLElement).setPointerCapture?.(e.pointerId)
    fn()
  }

  const cursor = tool === 'select' ? (drag?.type === 'pan' ? 'grabbing' : 'default') : 'crosshair'

  /* hover em parede para porta/janela */
  const wallHover = useMemo(() => {
    if ((tool !== 'door' && tool !== 'window') || !hover) return null
    let best: { w: Wall; t: number; d: number } | null = null
    for (const { w } of wallsAll) {
      const p = projectOnSegment(hover, w.start, w.end)
      if (p.distance < 0.5 && (!best || p.distance < best.d)) best = { w, t: p.t, d: p.distance }
    }
    return best
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, hover, scene])

  const addOpeningAt = (w: Wall, t: number) => {
    const kind = tool === 'door' ? 'door' : 'window'
    const off = sn(t * wallLength(w))
    const r = dispatch([{ op: 'addOpening', wallId: w.id, kind, offset: off }])
    if (r.errors.length) toast(r.errors[0].message, 'err')
    else setTool('select')
  }

  const hint: Record<PlanTool, string> = {
    select: 'Arraste móveis e ambientes. Arraste o fundo para mover a vista; role para dar zoom.',
    room: 'Arraste na planta para desenhar um ambiente (as medidas aparecem ao vivo).',
    wall: wallStart ? 'Clique para terminar a parede (continua em cadeia). Digite o comprimento e Enter · Esc termina.' : 'Clique para começar uma parede.',
    door: 'Clique em uma parede para colocar uma porta.',
    window: 'Clique em uma parede para colocar uma janela.',
    measure: 'Arraste para medir uma distância.',
    dim: 'Arraste entre dois pontos para fixar uma cota na planta (ela fica no projeto).',
    text: 'Clique onde quer escrever um texto na planta.',
  }

  const tools: { id: PlanTool; icon: string; label: string }[] = [
    { id: 'select', icon: 'cursor', label: 'Selecionar e mover' },
    { id: 'room', icon: 'room', label: 'Desenhar ambiente' },
    { id: 'wall', icon: 'wall', label: 'Desenhar parede' },
    { id: 'door', icon: 'door', label: 'Porta' },
    { id: 'window', icon: 'window', label: 'Janela' },
    { id: 'measure', icon: 'ruler', label: 'Medir' },
    { id: 'dim', icon: 'dim', label: 'Cota fixa' },
    { id: 'text', icon: 'text', label: 'Texto' },
  ]

  return (
    <div
      ref={wrap}
      className="plan-wrap"
      style={{ cursor }}
      onPointerDown={onBgDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={onWheel}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={() => tool === 'wall' && setWallStart(null)}
    >
      <svg width={size.w} height={size.h}>
        <defs>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#1a2033" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#e0b37a" strokeWidth="2" opacity="0.7" />
          </pattern>
        </defs>
        <rect width={size.w} height={size.h} fill="#0f1320" />
        {gridLines}

        {/* terreno */}
        {scene.site?.boundary && (
          <path d={polyPath(scene.site.boundary)} fill={resolveMaterial(scene.site.groundMaterial, scene).color} fillOpacity={0.22} stroke="#6f7ca3" strokeDasharray="7 5" strokeWidth={1.4} pointerEvents="none" />
        )}
        {zones.map((z) => {
          const c = S([bbox(z.polygon).minX + bbox(z.polygon).width / 2, bbox(z.polygon).minZ + bbox(z.polygon).depth / 2])
          const sel = selection?.kind === 'zone' && selection.id === z.id
          return (
            <g key={z.id}>
              <path d={polyPath(z.polygon)} fill={resolveMaterial(z.material, scene).color} fillOpacity={0.75} stroke={sel ? ACCENT : '#00000055'} strokeWidth={sel ? 2.5 : 1} onPointerDown={(e) => down(e, () => select({ kind: 'zone', id: z.id }))} />
              <text x={c[0]} y={c[1]} textAnchor="middle" fontSize={12} fill="#fff" opacity={0.9} pointerEvents="none">
                {z.name ?? z.kind}
              </text>
            </g>
          )
        })}

        {/* sombra do andar de baixo, para alinhar paredes e escada */}
        {below && (
          <g pointerEvents="none" opacity={0.28}>
            {(below.rooms ?? []).map((r) => (
              <path key={'g' + r.id} d={polyPath(r.polygon)} fill="#8d97b8" fillOpacity={0.25} />
            ))}
            {(below.walls ?? []).map((w) => (
              <path key={'gw' + w.id} d={polyPath(wallQuad(w))} fill="#d9deee" />
            ))}
            {(below.objects ?? [])
              .filter((o) => getCatalogItem(o.catalogId)?.category === 'stairs' || o.catalogId.startsWith('stairs/'))
              .map((o) => {
                const d = objectDims(o)
                const [cx, cy] = S([o.position[0], o.position[2]])
                return <rect key={'gs' + o.id} transform={`translate(${cx},${cy}) rotate(${-(o.rotationDeg ?? 0)})`} x={(-d.width * cam.k) / 2} y={(-d.depth * cam.k) / 2} width={d.width * cam.k} height={d.depth * cam.k} fill="none" stroke="#f2b45a" strokeDasharray="5 3" />
              })}
          </g>
        )}

        {/* ambientes */}
        {rooms.map(({ r }) => {
          const b = bbox(r.polygon)
          const c = S([b.minX + b.width / 2, b.minZ + b.depth / 2])
          const sel = selection?.kind === 'room' && selection.id === r.id
          const col = resolveMaterial(r.floor?.material, scene).color
          return (
            <g key={r.id}>
              <path
                d={polyPath(r.polygon)}
                fill={col}
                fillOpacity={0.9}
                stroke={sel ? ACCENT : 'none'}
                strokeWidth={2.5}
                onPointerDown={(e) =>
                  down(e, () => {
                    select({ kind: 'room', id: r.id })
                    const w = evWorld(e)
                    setD({ type: 'room', id: r.id, start: snapPt(w, e.altKey), applied: [0, 0], moved: false })
                  })
                }
              />
              <text x={c[0]} y={c[1] - 8} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1c2233" opacity={0.85} pointerEvents="none">
                {r.name}
              </text>
              <text x={c[0]} y={c[1] + 8} textAnchor="middle" fontSize={11.5} fill="#1c2233" opacity={0.7} pointerEvents="none">
                {fmtArea(polygonArea(r.polygon))}
              </text>
            </g>
          )
        })}

        {/* vãos no piso (escada) */}
        {(active?.slabOpenings ?? []).map((so) => {
          const sel = selection?.kind === 'slab' && selection.id === so.id
          return (
            <path
              key={so.id}
              d={polyPath(so.polygon)}
              fill="url(#hatch)"
              stroke={sel ? ACCENT : '#e0b37a'}
              strokeWidth={sel ? 2.5 : 1.6}
              onPointerDown={(e) => down(e, () => select({ kind: 'slab', id: so.id }))}
            />
          )
        })}

        {/* paredes */}
        {wallsAll.map(({ w }) => {
          const sel = selection?.kind === 'wall' && selection.id === w.id
          const q = wallQuad(w)
          const thin = w.kind === 'fence' || w.kind === 'railing'
          return (
            <path
              key={w.id}
              d={polyPath(q)}
              fill={sel ? ACCENT : thin ? '#8b7355' : w.kind === 'glass' ? '#8fd3e6' : w.kind === 'half' ? '#9aa3bd' : '#d9deee'}
              stroke="#10131c"
              strokeWidth={0.8}
              onPointerDown={(e) =>
                down(e, () => {
                  if (tool === 'door' || tool === 'window') {
                    const p = projectOnSegment(evWorld(e), w.start, w.end)
                    return addOpeningAt(w, p.t)
                  }
                  const p = evWorld(e)
                  const n = wallNormalRight(w)
                  const side = (p[0] - w.start[0]) * n[0] + (p[1] - w.start[1]) * n[1] > 0 ? 'right' : 'left'
                  select({ kind: 'wall', id: w.id, side })
                }, true)
              }
            />
          )
        })}

        {/* aberturas */}
        {wallsAll.flatMap(({ w, c }) =>
          (c.openings ?? [])
            .filter((o) => o.wallId === w.id)
            .map((o) => {
              const t = (w.thickness ?? 0.15) + 0.04
              const a = pointOnWall(w, o.offset - o.width / 2)
              const b = pointOnWall(w, o.offset + o.width / 2)
              const n = wallNormalRight(w)
              const q: Point2[] = [
                [a[0] + (n[0] * t) / 2, a[1] + (n[1] * t) / 2],
                [b[0] + (n[0] * t) / 2, b[1] + (n[1] * t) / 2],
                [b[0] - (n[0] * t) / 2, b[1] - (n[1] * t) / 2],
                [a[0] - (n[0] * t) / 2, a[1] - (n[1] * t) / 2],
              ]
              const sel = selection?.kind === 'opening' && selection.id === o.id
              const isWin = o.kind.includes('window')
              const [sa, sb] = [S(a), S(b)]
              const hingeA = o.hinge !== 'end'
              const hp = hingeA ? sa : sb
              const op = hingeA ? sb : sa
              const swingSign = o.opensTo === 'left' ? -1 : 1
              const dirx = op[0] - hp[0]
              const diry = op[1] - hp[1]
              const px = -diry * swingSign
              const py = dirx * swingSign
              const L = Math.hypot(dirx, diry) || 1
              return (
                <g key={o.id} onPointerDown={(e) => down(e, () => (select({ kind: 'opening', id: o.id }), setD({ type: 'opening', id: o.id })))}>
                  <path d={polyPath(q)} fill={isWin ? '#9fd8f0' : '#0f1320'} stroke={sel ? ACCENT : isWin ? '#5fa7c8' : '#6f7ca3'} strokeWidth={sel ? 2.5 : 1.2} />
                  {!isWin && !o.kind.includes('sliding') && o.kind !== 'passage' && o.kind !== 'garage-door' && (
                    <path d={`M${hp[0]},${hp[1]} L${hp[0] + px},${hp[1] + py} A${L},${L} 0 0 ${swingSign > 0 ? 0 : 1} ${op[0]},${op[1]}`} fill="none" stroke="#7e8aab" strokeWidth={1.1} pointerEvents="none" />
                  )}
                  {isWin && <line x1={sa[0]} y1={sa[1]} x2={sb[0]} y2={sb[1]} stroke="#e9f7ff" strokeWidth={1.6} pointerEvents="none" />}
                </g>
              )
            }),
        )}

        {/* objetos */}
        {objs.map(({ o }) => {
          const d = objectDims(o)
          const [cx, cy] = S([o.position[0], o.position[2]])
          const sel = selection?.kind === 'object' && selection.id === o.id
          const w = d.width * cam.k
          const h = d.depth * cam.k
          const col = resolveMaterial(Object.values(objectMaterials(o))[0], scene).color
          const cat = getCatalogItem(o.catalogId)
          const label = o.name ?? (cat ? nameOf(cat.name) : o.catalogId)
          const flat = cat?.category === 'rug'
          return (
            <g key={o.id} transform={`translate(${cx},${cy}) rotate(${-(o.rotationDeg ?? 0)})`} onPointerDown={(e) => down(e, () => {
              select({ kind: 'object', id: o.id })
              if (o.locked) return
              const wp = evWorld(e)
              setD({ type: 'object', id: o.id, off: [wp[0] - o.position[0], wp[1] - o.position[2]], moved: false })
            })}>
              <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={Math.min(6, w / 6)} fill={col} fillOpacity={flat ? 0.55 : 0.92} stroke={sel ? ACCENT : '#0b0e16'} strokeWidth={sel ? 2.5 : 1} strokeDasharray={flat ? '4 3' : undefined} />
              {/* frente (+Z) */}
              <path d={`M${-Math.min(w, 26) / 4},${h / 2 - 2} L${Math.min(w, 26) / 4},${h / 2 - 2} L0,${h / 2 - 2 - Math.min(10, h / 3)}Z`} fill="#0b0e1666" pointerEvents="none" />
              {w > 46 && h > 22 && (
                <text transform={`rotate(${o.rotationDeg ?? 0})`} textAnchor="middle" y={4} fontSize={Math.min(11.5, w / 7)} fill="#0b0e16" fontWeight={600} pointerEvents="none">
                  {label.length > w / 7 ? label.slice(0, Math.max(3, Math.floor(w / 7))) + '…' : label}
                </text>
              )}
            </g>
          )
        })}

        {/* telhados do andar (tracejado; clique na linha) */}
        {(active?.roofs ?? []).map((r) => {
          const sel = selection?.kind === 'roof' && selection.id === r.id
          const b = bbox(r.polygon)
          const lab = S([b.minX, b.minZ])
          const name = { flat: 'Laje plana', shed: 'Telhado de uma água', gable: 'Telhado de duas águas', hip: 'Telhado de quatro águas' }[r.kind]
          return (
            <g key={r.id}>
              <path d={polyPath(r.polygon)} fill="none" stroke={sel ? ACCENT : '#c97b5a'} strokeWidth={sel ? 2.5 : 1.6} strokeDasharray="9 5" pointerEvents="none" />
              <path d={polyPath(r.polygon)} fill="none" stroke="transparent" strokeWidth={14} pointerEvents="stroke" style={{ cursor: 'pointer' }} onPointerDown={(e) => down(e, () => select({ kind: 'roof', id: r.id }))} />
              {(sel || cam.k >= 30) && (
                <text x={lab[0] + 6} y={lab[1] + 14} fontSize={11} fill={sel ? ACCENT : '#e0a58a'} pointerEvents="none">
                  {name}
                  {r.pitchDeg ? ` · ${r.pitchDeg}°` : ''}
                </text>
              )}
            </g>
          )
        })}

        {/* cotas fixas e textos */}
        {annots.map((a) => {
          const sel = selection?.kind === 'annotation' && selection.id === a.id
          if (a.kind === 'dimension') {
            const off = (a.offset ?? 0.4) * cam.k
            const [x1, y1] = S(a.start)
            const [x2, y2] = S(a.end)
            const L = Math.hypot(x2 - x1, y2 - y1) || 1
            const ox = (-(y2 - y1) / L) * off
            const oy = ((x2 - x1) / L) * off
            return (
              <g key={a.id}>
                {dimLine(a.start, a.end, a.text ?? fmtLen(dist(a.start, a.end), unit), off, 'ad' + a.id, sel ? ACCENT : '#6fcf97')}
                <line x1={x1 + ox} y1={y1 + oy} x2={x2 + ox} y2={y2 + oy} stroke="transparent" strokeWidth={16} pointerEvents="stroke" style={{ cursor: 'pointer' }} onPointerDown={(e) => down(e, () => select({ kind: 'annotation', id: a.id }))} />
              </g>
            )
          }
          const [tx, ty] = S(a.start)
          return (
            <g key={a.id} style={{ cursor: 'pointer' }} onPointerDown={(e) => down(e, () => select({ kind: 'annotation', id: a.id }))}>
              <rect x={tx - 4} y={ty - 14} width={a.text.length * 7 + 10} height={20} rx={6} fill="#0f1320" opacity={0.9} stroke={sel ? ACCENT : '#6fcf97'} strokeWidth={sel ? 2 : 1} />
              <text x={tx + 1} y={ty} fontSize={12.5} fill="#e8eaf0">
                {a.text}
              </text>
            </g>
          )
        })}

        {/* grupo do objeto selecionado */}
        {selObj &&
          (() => {
            const g = groupOfObject(selObj.container, selObj.entity.id)
            if (!g) return null
            const pts = g.objectIds.flatMap((id) => {
              const m = (selObj.container.objects ?? []).find((q) => q.id === id)
              return m ? objectCorners(m) : []
            })
            if (!pts.length) return null
            const b = bbox(pts)
            const [x0, y0] = S([b.minX, b.minZ])
            return (
              <g pointerEvents="none">
                <rect x={x0 - 6} y={y0 - 6} width={b.width * cam.k + 12} height={b.depth * cam.k + 12} rx={8} fill="none" stroke={ACCENT} strokeWidth={1.4} strokeDasharray="3 4" />
                <text x={x0 - 2} y={y0 - 12} fontSize={11} fill={ACCENT}>
                  Grupo{g.name ? ` “${g.name}”` : ''} · move junto
                </text>
              </g>
            )
          })()}

        {/* cotas dos ambientes */}
        {rooms.map(({ r }) => {
          const b = bbox(r.polygon)
          const sel = selection?.kind === 'room' && selection.id === r.id
          if (cam.k < 22 && !sel) return null
          return (
            <g key={'dim' + r.id}>
              {dimLine([b.minX, b.minZ], [b.maxX, b.minZ], fmtLen(b.width, unit), -24, 'w')}
              {dimLine([b.minX, b.minZ], [b.minX, b.maxZ], fmtLen(b.depth, unit), 24, 'd')}
            </g>
          )
        })}
        {selWall && dimLine(selWall.entity.start, selWall.entity.end, fmtLen(wallLength(selWall.entity), unit), 30, 'wl')}
        {selWall &&
          (selWall.container.openings ?? [])
            .filter((o) => o.wallId === selWall.entity.id)
            .map((o) => {
              const a = pointOnWall(selWall.entity, o.offset - o.width / 2)
              const b = pointOnWall(selWall.entity, o.offset + o.width / 2)
              return dimLine(a, b, fmtLen(o.width, unit), -22, 'ow' + o.id)
            })}
        {selection?.kind === 'opening' &&
          (() => {
            const o = findOpening(scene, selection.id)
            const w = o && findWall(scene, o.entity.wallId)
            if (!o || !w) return null
            const a = pointOnWall(w.entity, o.entity.offset - o.entity.width / 2)
            const b = pointOnWall(w.entity, o.entity.offset + o.entity.width / 2)
            return (
              <>
                {dimLine(w.entity.start, a, fmtLen(o.entity.offset - o.entity.width / 2, unit), -26, 'e1')}
                {dimLine(b, w.entity.end, fmtLen(wallLength(w.entity) - o.entity.offset - o.entity.width / 2, unit), -26, 'e2')}
                {dimLine(a, b, fmtLen(o.entity.width, unit), 26, 'e3')}
              </>
            )
          })()}

        {/* objeto selecionado: cotas e alça de rotação */}
        {selObj &&
          (() => {
            const o = selObj.entity
            const d = objectDims(o)
            const cs = objectCorners(o)
            const c0 = S([o.position[0], o.position[2]])
            const fr = (o.rotationDeg ?? 0) * (Math.PI / 180)
            const hx = o.position[0] + Math.sin(fr) * (d.depth / 2) + Math.sin(fr) * (36 / cam.k)
            const hz = o.position[2] + Math.cos(fr) * (d.depth / 2) + Math.cos(fr) * (36 / cam.k)
            const hs = S([hx, hz])
            const fs = S([o.position[0] + Math.sin(fr) * (d.depth / 2), o.position[2] + Math.cos(fr) * (d.depth / 2)])
            return (
              <g>
                {dimLine(cs[0], cs[1], fmtLen(d.width, unit), -18, 'ow')}
                {dimLine(cs[1], cs[2], fmtLen(d.depth, unit), -18, 'od')}
                <line x1={fs[0]} y1={fs[1]} x2={hs[0]} y2={hs[1]} stroke={ACCENT} strokeWidth={1.4} pointerEvents="none" />
                <circle cx={hs[0]} cy={hs[1]} r={8} fill="#0f1320" stroke={ACCENT} strokeWidth={2} style={{ cursor: 'grab' }} onPointerDown={(e) => down(e, () => (beginGesture(), setD({ type: 'rotate', id: o.id })))} />
                <circle cx={c0[0]} cy={c0[1]} r={2.5} fill={ACCENT} pointerEvents="none" />
              </g>
            )
          })()}

        {/* alças de redimensionar do ambiente retangular */}
        {selRoom && selRoom.entity.polygon.length === 4 &&
          (() => {
            const b = bbox(selRoom.entity.polygon)
            return HANDLES.map((h) => {
              const p = S([b.minX + b.width * h.fx, b.minZ + b.depth * h.fz])
              return (
                <rect
                  key={h.h}
                  x={p[0] - 6}
                  y={p[1] - 6}
                  width={12}
                  height={12}
                  rx={3}
                  fill="#0f1320"
                  stroke={ACCENT}
                  strokeWidth={2}
                  style={{ cursor: h.h.length === 2 ? (h.h === 'nw' || h.h === 'se' ? 'nwse-resize' : 'nesw-resize') : h.h === 'n' || h.h === 's' ? 'ns-resize' : 'ew-resize' }}
                  onPointerDown={(e) => down(e, () => (beginGesture(), setD({ type: 'resize', id: selRoom.entity.id, handle: h.h, box: b })))}
                />
              )
            })
          })()}

        {/* pontas da parede selecionada */}
        {selWall &&
          (['start', 'end'] as const).map((end) => {
            const p = S(selWall.entity[end])
            return <circle key={end} cx={p[0]} cy={p[1]} r={7} fill="#0f1320" stroke={ACCENT} strokeWidth={2} style={{ cursor: 'move' }} onPointerDown={(e) => down(e, () => (beginGesture(), setD({ type: 'wallEnd', id: selWall.entity.id, end })))} />
          })}

        {/* ferramentas em ação */}
        {drag?.type === 'draw-room' && (() => {
          const x = Math.min(drag.a[0], drag.b[0])
          const z = Math.min(drag.a[1], drag.b[1])
          const w = Math.abs(drag.b[0] - drag.a[0])
          const h = Math.abs(drag.b[1] - drag.a[1])
          const [sx, sy] = S([x, z])
          return (
            <g pointerEvents="none">
              <rect x={sx} y={sy} width={w * cam.k} height={h * cam.k} fill={ACCENT} fillOpacity={0.18} stroke={ACCENT} strokeWidth={2} strokeDasharray="6 4" />
              {w > 0.1 && dimLine([x, z], [x + w, z], fmtLen(w, unit), -22, 'pw')}
              {h > 0.1 && dimLine([x, z], [x, z + h], fmtLen(h, unit), 22, 'ph')}
            </g>
          )
        })()}
        {wallStart && wallPreview && (
          <g pointerEvents="none">
            <path d={polyPath(wallQuad({ id: 'p', start: wallStart, end: wallPreview, thickness: 0.15 } as Wall))} fill={ACCENT} fillOpacity={0.5} stroke={ACCENT} />
            {dimLine(wallStart, wallPreview, fmtLen(dist(wallStart, wallPreview), unit), 26, 'pv')}
            <circle cx={S(wallStart)[0]} cy={S(wallStart)[1]} r={5} fill={ACCENT} />
          </g>
        )}
        {drag?.type === 'dim' && (
          <g pointerEvents="none">
            <line x1={S(drag.a)[0]} y1={S(drag.a)[1]} x2={S(drag.b)[0]} y2={S(drag.b)[1]} stroke="#6fcf97" strokeWidth={2} />
            {dist(drag.a, drag.b) > 0.02 && dimLine(drag.a, drag.b, fmtLen(dist(drag.a, drag.b), unit), 0.4 * cam.k, 'dm', '#6fcf97')}
          </g>
        )}
        {drag?.type === 'measure' && (
          <g pointerEvents="none">
            <line x1={S(drag.a)[0]} y1={S(drag.a)[1]} x2={S(drag.b)[0]} y2={S(drag.b)[1]} stroke="#6fcf97" strokeWidth={2} strokeDasharray="6 4" />
            {dist(drag.a, drag.b) > 0.02 && dimLine(drag.a, drag.b, fmtLen(dist(drag.a, drag.b), unit), 18, 'ms')}
          </g>
        )}
        {wallHover && (() => {
          const p = pointOnWall(wallHover.w, wallHover.t * wallLength(wallHover.w))
          const s = S(p)
          return <circle cx={s[0]} cy={s[1]} r={9} fill="none" stroke={ACCENT} strokeWidth={2.5} pointerEvents="none" />
        })()}

        {/* rosa dos ventos */}
        <g transform={`translate(${size.w - 40},${96})`} pointerEvents="none" opacity={0.75}>
          <circle r={17} fill="#0f1320" stroke="#4c5877" />
          <path d="M0,-12 L4,3 L0,0 L-4,3Z" fill={ACCENT} />
          <text y={-21} textAnchor="middle" fontSize={10} fill="#9aa5c6">N</text>
        </g>
      </svg>

      <div className="plan-left plan-ui">
        <div className="plan-tools">
          {tools.map((t) => (
            <IconButton key={t.id} icon={t.icon} label={t.label} active={tool === t.id} onClick={() => setTool(t.id)} />
          ))}
        </div>
        <LevelBar />
      </div>
      <div className="plan-hint plan-ui">
        {hint[tool]}
        {tool === 'text' && labelAt && (
          <input
            className="lenbox"
            autoFocus
            value={labelText}
            placeholder="texto"
            onChange={(e) => setLabelText(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter' && labelText.trim()) {
                const r = dispatch([{ op: 'addLabel', start: labelAt, text: labelText.trim(), ...(active ? { container: active.id } : {}) }])
                if (r.errors.length) toast(r.errors[0].message, 'err')
                setLabelAt(null)
                setTool('select')
              }
              if (e.key === 'Escape') setLabelAt(null)
            }}
          />
        )}
        {tool === 'wall' && wallStart && (
          <input
            className="lenbox"
            autoFocus
            value={lenText}
            placeholder="comprimento"
            onChange={(e) => setLenText(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter' && wallPreview) commitWall(wallStart, wallPreview)
              if (e.key === 'Escape') setWallStart(null)
            }}
          />
        )}
      </div>
      <div className="plan-zoom plan-ui">
        <IconButton icon="plus" label="Aproximar" onClick={() => setCam((c) => ({ ...c, k: Math.min(400, c.k * 1.25) }))} />
        <button className="btn ghost" onClick={fit}><Icon name="grid" size={15} /> Ajustar</button>
        <select className="unit" value={snapStep} onChange={(e) => useEditor.getState().setSnap(Number(e.target.value))} aria-label="Encaixe">
          <option value={0}>Sem encaixe</option>
          <option value={0.01}>1 cm</option>
          <option value={0.05}>5 cm</option>
          <option value={0.1}>10 cm</option>
          <option value={0.25}>25 cm</option>
          <option value={0.5}>50 cm</option>
        </select>
      </div>
    </div>
  )
}

export type { Container }
