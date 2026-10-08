import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SceneView, type Selection, type SceneViewHandle } from '../index'
import type { Scene } from '../../../../schema/types'
import studio from '../../../../schema/exemplos/studio-aconchegante.json'
import quintal from '../../../../schema/exemplos/quintal-com-piscina.json'

// Visualizador só de desenvolvimento do motor 3D, sem o resto do app:
//   /src/three/dev/viewer.html?scene=studio|quintal&q=low|medium|high&t=18.5&view=iso|top|front
// Expõe window.__vp (handle) e window.__setT (muda a hora) para testes automatizados; adaptive=0 desliga o ajuste automático de qualidade.
const SCENES: Record<string, Scene> = { studio: studio as unknown as Scene, quintal: quintal as unknown as Scene }
const q = new URLSearchParams(location.search)

function Viewer() {
  const [scene] = useState<Scene>(SCENES[q.get('scene') ?? 'studio'])
  const [sel, setSel] = useState<Selection>(null)
  const [t, setT] = useState<number | undefined>(q.get('t') ? Number(q.get('t')) : undefined)
  const ref = useRef<SceneViewHandle>(null)
  ;(window as unknown as { __setT: unknown }).__setT = setT
  ;(window as unknown as { __vp: unknown }).__vp = ref
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <SceneView
        ref={ref}
        scene={scene}
        selection={sel}
        onPick={setSel}
        quality={(q.get('q') as 'low' | 'medium' | 'high') ?? 'high'}
        adaptive={q.get('adaptive') !== '0'}
        timeOfDay={t}
        onTimeChange={setT}
        view={(q.get('view') as 'iso' | 'top' | 'front') ?? 'iso'}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Viewer />)
