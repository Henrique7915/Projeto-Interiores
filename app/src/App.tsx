import { lazy, Suspense, useEffect, useState } from 'react'
import { decodeShare } from './core'
import { autoConnectBridge } from './lib/bridge'
import { loadProject } from './lib/storage'
import { lastProjectId } from './lib/storage'
import { useEditor } from './state/store'
import { useShortcuts } from './state/shortcuts'
import { useIsMobile } from './state/hooks'
import { Icon } from './ui/common'
import { BottomPalette } from './ui/BottomPalette'
import { Toaster, toast } from './ui/common'
import { LeftPanel } from './ui/LeftPanel'
import { RightPanel } from './ui/RightPanel'
const ThreeHost = lazy(() => import('./ui/ThreeHost').then((m) => ({ default: m.ThreeHost })))
import { TopBar } from './ui/TopBar'
import { PlanView } from './plan/PlanView'

const AiPanel = lazy(() => import('./chat/AiPanel').then((m) => ({ default: m.AiPanel })))

type Sheet = 'estilo' | 'materiais' | 'detalhes' | null

export function App() {
  const viewMode = useEditor((s) => s.viewMode)
  const setScene = useEditor((s) => s.setScene)
  const [ai, setAi] = useState(false)
  const mobile = useIsMobile()
  const [sheet, setSheet] = useState<Sheet>(null)
  const mode = mobile && viewMode === 'split' ? '3d' : viewMode
  const toggle = (s: Exclude<Sheet, null>) => {
    setAi(false)
    setSheet((cur) => (cur === s ? null : s))
  }
  useShortcuts()

  useEffect(() => {
    autoConnectBridge()
    ;(async () => {
      const m = /#s=([\w-]+)/.exec(location.hash)
      if (m) {
        try {
          setScene(await decodeShare(m[1]))
          toast('Projeto aberto pelo link')
          return
        } catch (e) {
          toast('Link inválido: ' + (e instanceof Error ? e.message.split('\n')[0] : ''), 'err')
        }
      }
      const id = lastProjectId()
      const s = id ? await loadProject(id) : undefined
      if (s) setScene(s)
    })()
  }, [setScene])

  return (
    <div className={'app' + (mobile ? ' mobile' : '') + (sheet ? ' sheet-' + sheet : '')}>
      <TopBar onAi={() => (setSheet(null), setAi((v) => !v))} />
      <div className="main">
        <LeftPanel />
        <div className={'stage ' + mode}>
          {mode !== 'plan' && (
            <div className="view v3d">
              <Suspense fallback={<p className="muted pad">Carregando o 3D…</p>}>
                <ThreeHost />
              </Suspense>
            </div>
          )}
          {mode !== '3d' && (
            <div className="view vplan">
              <PlanView />
            </div>
          )}
          <BottomPalette />
        </div>
        <RightPanel />
        {ai && (
          <Suspense fallback={null}>
            <AiPanel onClose={() => setAi(false)} />
          </Suspense>
        )}
      </div>
      {mobile && (
        <nav className="mnav" aria-label="Painéis">
          <button className={sheet === 'estilo' ? 'on' : ''} onClick={() => toggle('estilo')}>
            <Icon name="sparkle" size={20} />
            <span>Estilo</span>
          </button>
          <button className={sheet === 'materiais' ? 'on' : ''} onClick={() => toggle('materiais')}>
            <Icon name="grid" size={20} />
            <span>Materiais</span>
          </button>
          <button className={sheet === 'detalhes' ? 'on' : ''} onClick={() => toggle('detalhes')}>
            <Icon name="cube" size={20} />
            <span>Detalhes</span>
          </button>
        </nav>
      )}
      <Toaster />
    </div>
  )
}
