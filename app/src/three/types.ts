import type { Scene, View } from '../../../schema/types'
import type { Cutaway } from './Architecture'
import type { TimePreset } from './lighting/daylight'

/** Referência a algo selecionável (mesma forma que o App usa em `core/schema.ts`). */
export type Selection =
  | { kind: 'room'; id: string }
  | { kind: 'wall'; id: string; side?: 'left' | 'right' }
  | { kind: 'opening'; id: string }
  | { kind: 'object'; id: string }
  | { kind: 'zone'; id: string }
  | { kind: 'site' }
  | null

export type ViewPreset = 'iso' | 'top' | 'front'
export type Quality = 'low' | 'medium' | 'high'

/** Contrato entre o App (dono do estado) e o motor 3D (dono de app/src/three/). Veja CONTRATO.md. */
export interface SceneViewProps {
  scene: Scene
  selection?: Selection
  /** Clique em algo (ou null para o vazio). side só para paredes (face clicada). */
  onPick?: (sel: Selection) => void
  /** Fim de um arrasto/giro de objeto (o App transforma em comando updateObject). position está no espaço da cena (sem a elevação do andar). */
  onDragEnd?: (e: { id: string; position: [number, number, number]; rotationDeg?: number }) => void
  /** Delete/Backspace com um objeto selecionado. */
  onDelete?: (id: string) => void
  /** low: sem sombras nem pós-processamento; medium: sombras + brilho; high: tudo (oclusão ambiente). */
  quality?: Quality
  /** Se o aparelho não acompanhar, desce de nível sozinho (high → medium → low). Padrão: ligado. */
  adaptive?: boolean
  className?: string
  style?: React.CSSProperties

  // ---- opcionais (valores padrão vêm da cena) ----
  /** Hora do dia (18.5 ou "18:30"); sem ela usa scene.environment.timeOfDay. */
  timeOfDay?: number | string
  /** O usuário arrastou o sol no 3D (horas decimais). */
  onTimeChange?: (hours: number) => void
  /** Preset de câmera; use o handle.setView(view) para vistas salvas. */
  view?: ViewPreset
  /** Paredes que escondem a vista ficam baixas: 'auto' pela câmera. */
  cutaway?: Cutaway
  /** Passo da grade ao arrastar (m); sem valor usa scene.defaults.snap. */
  snap?: number
  showSunGizmo?: boolean
}

export interface SceneViewHandle {
  /** PNG da vista atual. */
  capture(): Promise<Blob>
  /** GLB da cena inteira (sem luzes/gizmos de edição). */
  exportGLB(): Promise<Blob>
  /** Move a câmera para uma vista salva (schema View) ou um preset ('iso' | 'top' | 'front'). */
  setView(view: View | ViewPreset): void
  /** Vista atual da câmera, no formato do schema (para salvar uma vista). */
  getView(): Pick<View, 'position' | 'target' | 'fovDeg'>
  /** Hora decimal de um preset (Manhã, Meio-dia, Tarde, Noite). */
  timeOfPreset(p: TimePreset): number
}
