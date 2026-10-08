import { useCallback, useEffect, useRef, useState } from 'react'
import { SceneView, type SceneViewHandle, type ViewPreset } from '../three'
import { useEditor } from '../state/store'

let handle: SceneViewHandle | null = null

/** PNG da vista 3D atual (usado por Exportar e pelo chat/MCP). `view` muda o ângulo antes de capturar. */
export async function captureView(view?: ViewPreset): Promise<Blob> {
  if (!handle) throw new Error('A vista 3D não está aberta.')
  if (view) {
    handle.setView(view)
    await new Promise((r) => setTimeout(r, 700))
  }
  return handle.capture()
}

/** GLB da cena inteira (Exportar). */
export async function exportGLB(): Promise<Blob> {
  if (!handle) throw new Error('A vista 3D não está aberta.')
  return handle.exportGLB()
}

const isMobile = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/** Único ponto do app que renderiza o motor 3D (frente de Gráficos). Traduz eventos do motor em comandos. */
export function ThreeHost() {
  const scene = useEditor((s) => s.scene)
  const selection = useEditor((s) => s.selection)
  const select = useEditor((s) => s.select)
  const dispatch = useEditor((s) => s.dispatch)
  const snap = useEditor((s) => s.snap)
  const view = useEditor((s) => s.view3d)
  const cutaway = useEditor((s) => s.cutaway)
  const [low] = useState(isMobile)

  const onDragEnd = useCallback(
    (e: { id: string; position: [number, number, number]; rotationDeg?: number }) => {
      const [x, y, z] = e.position
      dispatch([{ op: 'updateObject', id: e.id, patch: { x, y, z, ...(e.rotationDeg !== undefined ? { rotationDeg: e.rotationDeg } : {}) } }])
    },
    [dispatch],
  )
  const onDelete = useCallback((id: string) => dispatch([{ op: 'removeObject', id }]), [dispatch])

  // arrastar o sol gera muitos eventos: agrupa num único passo de desfazer
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(idle.current), [])
  const onTimeChange = useCallback(
    (h: number) => {
      const st = useEditor.getState()
      if (!st.gesture) st.beginGesture()
      const hh = Math.floor(h) % 24
      const mm = Math.round((h - Math.floor(h)) * 60) % 60
      dispatch([{ op: 'setEnvironment', patch: { timeOfDay: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` } }], { gesture: true })
      clearTimeout(idle.current)
      idle.current = setTimeout(() => useEditor.getState().endGesture(), 500)
    },
    [dispatch],
  )

  return (
    <>
    <SceneView
      ref={(h) => {
        handle = h
      }}
      scene={scene}
      selection={selection}
      onPick={select}
      onDragEnd={onDragEnd}
      onDelete={onDelete}
      onTimeChange={onTimeChange}
      view={view}
      cutaway={cutaway}
      quality={low ? 'low' : 'high'}
      snap={snap}
    />
    <ViewControls />
    </>
  )
}

const VIEWS: { id: 'iso' | 'top' | 'front'; label: string }[] = [
  { id: 'iso', label: '3D' },
  { id: 'top', label: 'Topo' },
  { id: 'front', label: 'Frente' },
]
const CUTS: { id: 'auto' | 'none' | 'all'; label: string }[] = [
  { id: 'auto', label: 'Paredes: auto' },
  { id: 'none', label: 'Paredes: todas' },
  { id: 'all', label: 'Paredes: baixas' },
]

function ViewControls() {
  const view = useEditor((s) => s.view3d)
  const setView = useEditor((s) => s.setView3d)
  const cut = useEditor((s) => s.cutaway)
  const setCut = useEditor((s) => s.setCutaway)
  return (
    <div className="view-controls plan-ui">
      <div className="seg">
        {VIEWS.map((v) => (
          <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => (setView(v.id), handle?.setView(v.id))}>
            {v.label}
          </button>
        ))}
      </div>
      <select value={cut} onChange={(e) => setCut(e.target.value as 'auto')} aria-label="Paredes">
        {CUTS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  )
}
