import { useEffect } from 'react'
import { findObject } from '../core'
import { useEditor } from './store'

/** Atalhos de teclado do editor (ignora quando o foco está num campo de texto). */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return
      const st = useEditor.getState()
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') return e.preventDefault(), e.shiftKey ? st.redo() : st.undo()
      if (mod && e.key.toLowerCase() === 'y') return e.preventDefault(), st.redo()
      const sel = st.selection
      if (!sel) return
      if (e.key === 'Escape') return st.select(null)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        const op = ({ room: 'removeRoom', wall: 'removeWall', opening: 'removeOpening', object: 'removeObject', zone: 'removeZone' } as const)[sel.kind as 'room']
        if (op && 'id' in sel) st.dispatch([{ op, id: sel.id } as never]), st.select(null)
        return
      }
      if (sel.kind === 'object') {
        const o = findObject(st.scene, sel.id)?.entity
        if (!o) return
        if (mod && e.key.toLowerCase() === 'd') return e.preventDefault(), void st.dispatch([{ op: 'duplicateObject', id: o.id }])
        if (e.key.toLowerCase() === 'r') return void st.dispatch([{ op: 'updateObject', id: o.id, patch: { rotationDeg: (o.rotationDeg ?? 0) + (e.shiftKey ? -90 : 90) } }])
        const step = e.shiftKey ? 1 : st.snap || 0.05
        const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
        if (d[e.key]) {
          e.preventDefault()
          st.dispatch([{ op: 'updateObject', id: o.id, patch: { x: o.position[0] + d[e.key][0], z: o.position[2] + d[e.key][1] } }])
        }
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])
}
