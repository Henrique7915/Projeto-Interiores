import { create } from 'zustand'
import { applyOps, newScene, TEMPLATES, type ApplyResult, type OpInput, type Scene, type Selection } from '../core'
import { prefs, saveProject } from '../lib/storage'

export type ViewMode = '3d' | 'plan' | 'split'
export type View3D = 'iso' | 'top' | 'front'
export type Cutaway = 'auto' | 'none' | 'all'
export type PlanTool = 'select' | 'room' | 'wall' | 'door' | 'window' | 'measure'
export type DisplayUnit = 'm' | 'cm' | 'ft'

/** Alvo de aplicação da paleta quando nada está selecionado (itens do moodboard). */
export type PaintTarget = 'floors' | 'wallsInside' | 'wallsOutside' | 'ground' | 'furnitureMain' | 'furnitureAccent' | null

interface EditorState {
  scene: Scene
  past: Scene[]
  future: Scene[]
  selection: Selection
  viewMode: ViewMode
  tool: PlanTool
  view3d: View3D
  cutaway: Cutaway
  unit: DisplayUnit
  snap: number
  paintTarget: PaintTarget
  /** Acabou de ser carregado/alterado por fora (IA/MCP) — usado para avisos na UI. */
  lastRemoteChange?: number
  gesture: Scene | null
  /** slot de material do objeto selecionado que a paleta altera ('' = primeiro) */
  objectSlot: string

  dispatch: (ops: OpInput[], opts?: { gesture?: boolean }) => ApplyResult
  beginGesture: () => void
  endGesture: () => void
  undo: () => void
  redo: () => void
  setScene: (scene: Scene, opts?: { keepHistory?: boolean; remote?: boolean }) => void
  select: (s: Selection) => void
  setViewMode: (m: ViewMode) => void
  setTool: (t: PlanTool) => void
  setView3d: (v: View3D) => void
  setCutaway: (c: Cutaway) => void
  setUnit: (u: DisplayUnit) => void
  setSnap: (s: number) => void
  setPaintTarget: (t: PaintTarget) => void
  setObjectSlot: (s: string) => void
}

const HISTORY_LIMIT = 200

export const useEditor = create<EditorState>((set, get) => ({
  scene: TEMPLATES[0].build(),
  past: [],
  future: [],
  selection: null,
  viewMode: prefs.get<ViewMode>('viewMode', 'split'),
  tool: 'select',
  view3d: 'iso',
  cutaway: 'auto',
  unit: prefs.get<DisplayUnit>('unit', 'm'),
  snap: prefs.get<number>('snap', 0.05),
  paintTarget: null,
  gesture: null,
  objectSlot: '',

  dispatch: (ops, opts) => {
    const { scene, past, gesture } = get()
    const r = applyOps(scene, ops)
    if (r.scene === scene) return r
    if (opts?.gesture || gesture) set({ scene: r.scene, future: [] })
    else set({ scene: r.scene, past: [...past, scene].slice(-HISTORY_LIMIT), future: [] })
    // a seleção segue o último item criado
    const sel = get().selection
    if (r.created.length && !opts?.gesture) {
      const id = r.created[r.created.length - 1]
      const op = ops[ops.length - 1]
      if (op && 'op' in op) {
        if (op.op === 'addObject' || op.op === 'addObjectAtWall' || op.op === 'duplicateObject') set({ selection: { kind: 'object', id } })
        else if (op.op === 'addRoom') set({ selection: { kind: 'room', id } })
        else if (op.op === 'addZone') set({ selection: { kind: 'zone', id } })
        else if (op.op === 'addOpening') set({ selection: { kind: 'opening', id } })
        else if (op.op === 'addWall') set({ selection: { kind: 'wall', id } })
      }
    } else if (sel && 'id' in sel && ops.some((o) => 'op' in o && (o.op.startsWith('remove') || o.op === 'clear'))) {
      // limpa seleção de coisas removidas
      const json = JSON.stringify(r.scene)
      if (!json.includes(`"id":"${sel.id}"`)) set({ selection: null })
    }
    return r
  },
  beginGesture: () => set({ gesture: get().scene }),
  endGesture: () => {
    const { gesture, scene, past } = get()
    if (gesture && gesture !== scene) set({ past: [...past, gesture].slice(-HISTORY_LIMIT), future: [], gesture: null })
    else set({ gesture: null })
  },
  undo: () => {
    const { past, future, scene } = get()
    if (!past.length) return
    set({ scene: past[past.length - 1], past: past.slice(0, -1), future: [scene, ...future] })
  },
  redo: () => {
    const { past, future, scene } = get()
    if (!future.length) return
    set({ scene: future[0], past: [...past, scene], future: future.slice(1) })
  },
  setScene: (scene, opts) => {
    const cur = get().scene
    if (opts?.keepHistory) set({ scene, past: [...get().past, cur].slice(-HISTORY_LIMIT), future: [], lastRemoteChange: opts.remote ? Date.now() : get().lastRemoteChange })
    else set({ scene, past: [], future: [], selection: null })
  },
  select: (selection) => set({ selection, objectSlot: '', paintTarget: selection ? null : get().paintTarget }),
  setViewMode: (viewMode) => (prefs.set('viewMode', viewMode), set({ viewMode })),
  setTool: (tool) => set({ tool }),
  setView3d: (view3d) => set({ view3d }),
  setCutaway: (cutaway) => set({ cutaway }),
  setUnit: (unit) => (prefs.set('unit', unit), set({ unit })),
  setSnap: (snap) => (prefs.set('snap', snap), set({ snap })),
  setObjectSlot: (objectSlot) => set({ objectSlot }),
  setPaintTarget: (paintTarget) => set({ paintTarget, selection: paintTarget ? null : get().selection }),
}))

/** Autosave com debounce. */
let timer: ReturnType<typeof setTimeout> | undefined
useEditor.subscribe((s, prev) => {
  if (s.scene === prev.scene) return
  clearTimeout(timer)
  timer = setTimeout(() => void saveProject(useEditor.getState().scene), 600)
})

export const resetToBlank = () => useEditor.getState().setScene(newScene())
