import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SceneView, type Selection, type SceneViewHandle } from '../index'
import type { Scene } from '../../../../schema/types'
import studio from '../../../../schema/exemplos/studio-aconchegante.json'
import casa from '../../../../schema/exemplos/casa-dois-andares.json'
import quintal from '../../../../schema/exemplos/quintal-com-piscina.json'

// Visualizador só de desenvolvimento do motor 3D, sem o resto do app:
//   /src/three/dev/viewer.html?scene=studio|quintal|casa&roofs=auto|show|hide&upTo=<id do andar>&cutaway=auto|none|all&terrain=<fator do relevo>&q=low|medium|high&t=18.5&view=iso|top|front
// Expõe window.__vp (handle) e window.__setT (muda a hora) para testes automatizados; adaptive=0 desliga o ajuste automático de qualidade.
const SCENES: Record<string, Scene> = { studio: studio as unknown as Scene, quintal: quintal as unknown as Scene, casa: casa as unknown as Scene }
const q = new URLSearchParams(location.search)

function Viewer() {
  const [scene, setScene] = useState<Scene>(() => {
    let base = SCENES[q.get('scene') ?? 'studio']
    const rk = q.get('roofKind') // gable|hip|shed|flat: troca o tipo do telhado da casa, para conferir cada forma
    if (rk) base = { ...base, levels: base.levels.map((l) => ({ ...l, roofs: l.roofs?.map((r) => ({ ...r, kind: rk as 'gable', ridgeDeg: Number(q.get('ridge') ?? r.ridgeDeg ?? 0) })) })) }
    const k = Number(q.get('terrain') ?? 1) // terrain=3 exagera o relevo, para ver a malha
    if (k === 1 || !base.site?.terrain) return base
    return { ...base, site: { ...base.site, terrain: { ...base.site.terrain, points: base.site.terrain.points.map(([x, z, h]) => [x, z, h * k] as [number, number, number]) } } }
  })
  const [sel, setSel] = useState<Selection>(null)
  const [t, setT] = useState<number | undefined>(q.get('t') ? Number(q.get('t')) : undefined)
  const ref = useRef<SceneViewHandle>(null)
  ;(window as unknown as { __setT: unknown }).__setT = setT
  ;(window as unknown as { __vp: unknown; __scene: unknown }).__vp = ref
  ;(window as unknown as { __scene: unknown }).__scene = scene
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <SceneView
        ref={ref}
        scene={scene}
        selection={sel}
        onPick={setSel}
        // aplica o arraste na cena, como o app faz, para conferir que a câmera não reenquadra
        onDragEnd={(d) => setScene((s) => ({ ...s, levels: s.levels.map((l) => ({ ...l, objects: l.objects?.map((o) => (o.id === d.id ? { ...o, position: d.position } : o)) })) }))}
        quality={(q.get('q') as 'low' | 'medium' | 'high') ?? 'high'}
        adaptive={q.get('adaptive') !== '0'}
        timeOfDay={t}
        onTimeChange={setT}
        roofs={(q.get('roofs') as 'auto' | 'show' | 'hide') ?? undefined}
        cutaway={(q.get('cutaway') as 'auto' | 'none' | 'all') ?? undefined}
        upToLevel={q.get('upTo') ?? undefined}
        view={(q.get('view') as 'iso' | 'top' | 'front') ?? 'iso'}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Viewer />)
