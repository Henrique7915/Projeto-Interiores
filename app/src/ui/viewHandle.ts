import type { SceneViewHandle, ViewPreset } from '../three'

// Fica fora do ThreeHost para o motor 3D (pesado) carregar só quando a vista 3D abre.
let handle: SceneViewHandle | null = null
export const setViewHandle = (h: SceneViewHandle | null) => {
  handle = h
}
export const getViewHandle = () => handle

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
