import { useCallback, useEffect, useRef, useState } from 'react'
import { SceneView } from '../three'
import { getViewHandle, setViewHandle } from './viewHandle'
import { activeLevelOf, useEditor } from '../state/store'

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
  const roofMode = useEditor((s) => s.roofMode)
  const levelView = useEditor((s) => s.levelView)
  const activeId = useEditor((s) => s.activeLevel)
  const upTo = levelView === 'upto' && scene.levels.length > 1 ? activeLevelOf(scene, activeId)?.id : undefined
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
        setViewHandle(h)
      }}
      scene={scene}
      selection={selection && (selection.kind === 'roof' || selection.kind === 'slab' || selection.kind === 'annotation') ? null : selection}
      onPick={select}
      onDragEnd={onDragEnd}
      onDelete={onDelete}
      onTimeChange={onTimeChange}
      view={view}
      cutaway={cutaway}
      roofs={roofMode}
      upToLevel={upTo}
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
  const scene = useEditor((s) => s.scene)
  const activeId = useEditor((s) => s.activeLevel)
  const setActive = useEditor((s) => s.setActiveLevel)
  const levelView = useEditor((s) => s.levelView)
  const setLevelView = useEditor((s) => s.setLevelView)
  const roofMode = useEditor((s) => s.roofMode)
  const setRoofMode = useEditor((s) => s.setRoofMode)
  const hasRoofs = scene.levels.some((l) => (l.roofs ?? []).length > 0)
  const active = activeLevelOf(scene, activeId)
  const view = useEditor((s) => s.view3d)
  const setView = useEditor((s) => s.setView3d)
  const cut = useEditor((s) => s.cutaway)
  const setCut = useEditor((s) => s.setCutaway)
  return (
    <div className="view-controls plan-ui">
      <div className="seg">
        {VIEWS.map((v) => (
          <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => (setView(v.id), getViewHandle()?.setView(v.id))}>
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
      {scene.levels.length > 1 && (
        <>
          <select value={active?.id} onChange={(e) => setActive(e.target.value)} aria-label="Andar em edição">
            {[...scene.levels].reverse().map((l) => (
              <option key={l.id} value={l.id}>
                Andar: {l.name}
              </option>
            ))}
          </select>
          <select value={levelView} onChange={(e) => setLevelView(e.target.value as 'upto')} aria-label="Andares visíveis">
            <option value="upto">Até este andar</option>
            <option value="all">Todos os andares</option>
          </select>
        </>
      )}
      {(hasRoofs || scene.levels.length > 1) && (
        <select value={roofMode} onChange={(e) => setRoofMode(e.target.value as 'auto')} aria-label="Telhado">
          <option value="auto">Telhado: auto</option>
          <option value="show">Telhado: mostrar</option>
          <option value="hide">Telhado: ocultar</option>
        </select>
      )}
    </div>
  )
}
