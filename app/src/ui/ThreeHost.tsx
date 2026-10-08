import { useCallback, useEffect, useRef, useState } from 'react'
import { SceneView, type SceneViewHandle, type ScenePick, type ObjectPatch, type ViewPreset } from '../three'
import { useEditor } from '../state/store'
import type { Selection } from '../core'

let handle: SceneViewHandle | null = null

/** PNG da vista 3D atual (usado por Exportar e pelo chat/MCP). `view` muda o ângulo antes de capturar. */
export async function captureView(view?: ViewPreset): Promise<Blob> {
  if (!handle) throw new Error('A vista 3D não está aberta.')
  if (view) {
    handle.setView(view)
    await new Promise((r) => setTimeout(r, 700))
  }
  const url = handle.capture()
  return await (await fetch(url)).blob()
}

const toPick = (s: Selection): ScenePick | null => {
  if (!s || s.kind === 'site') return null
  if (s.kind === 'wall') return { type: 'wall', id: s.id, side: s.side ?? 'right' }
  return { type: s.kind, id: s.id }
}
const fromPick = (p: ScenePick | null): Selection => (p ? (p.type === 'wall' ? { kind: 'wall', id: p.id, side: p.side } : { kind: p.type, id: p.id }) : null)

/**
 * O motor seleciona o móvel em pointerdown, mas o piso/parede atrás dele também recebe o `click` logo depois
 * e trocaria a seleção para o cômodo. Ignoramos esse clique "fantasma" (pedido de correção enviado à Gráficos).
 */
let lastObjectPick = 0
const onPickFiltered = (p: ScenePick | null, select: (s: Selection) => void) => {
  const now = performance.now()
  if (p?.type === 'object') lastObjectPick = now
  else if (p && now - lastObjectPick < 400) return
  select(fromPick(p))
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
    (id: string, p: ObjectPatch) => {
      const patch: Record<string, number> = {}
      if (p.position) [patch.x, patch.y, patch.z] = p.position
      if (p.rotationDeg !== undefined) patch.rotationDeg = p.rotationDeg
      dispatch([{ op: 'updateObject', id, patch }])
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
      selection={toPick(selection)}
      onPick={(p) => onPickFiltered(p, select)}
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
