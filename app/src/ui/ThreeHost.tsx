import { useRef } from 'react'
import { SceneView, type SceneViewHandle } from '../three'
import { useEditor } from '../state/store'

let handle: SceneViewHandle | null = null
/** PNG da vista 3D atual (usado por Exportar e pelo chat/MCP). */
export const captureView = () => handle?.capture() ?? Promise.reject(new Error('A vista 3D não está aberta.'))
export const exportGLB = () => handle?.exportGLB?.() ?? Promise.reject(new Error('Exportar GLB ainda não está disponível.'))

/** Único ponto do app que renderiza o motor 3D (frente de Gráficos). */
export function ThreeHost() {
  const scene = useEditor((s) => s.scene)
  const selection = useEditor((s) => s.selection)
  const select = useEditor((s) => s.select)
  const dispatch = useEditor((s) => s.dispatch)
  const ref = useRef<SceneViewHandle | null>(null)
  return (
    <SceneView
      ref={(h) => {
        ref.current = h
        handle = h
      }}
      scene={scene}
      selection={selection}
      onPick={select}
      onDragEnd={(e) => dispatch([{ op: 'updateObject', id: e.id, patch: { x: e.position[0], y: e.position[1], z: e.position[2], ...(e.rotationDeg !== undefined ? { rotationDeg: e.rotationDeg } : {}) } }])}
    />
  )
}
