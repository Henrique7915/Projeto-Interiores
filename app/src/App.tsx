import { lazy, Suspense, useEffect, useState } from 'react'
import { decodeShare, loadCatalog } from './core'
import { loadProject } from './lib/storage'
import { lastProjectId } from './lib/storage'
import { useEditor } from './state/store'
import { useShortcuts } from './state/shortcuts'
import { BottomPalette } from './ui/BottomPalette'
import { Toaster, toast } from './ui/common'
import { LeftPanel } from './ui/LeftPanel'
import { RightPanel } from './ui/RightPanel'
import { ThreeHost } from './ui/ThreeHost'
import { TopBar } from './ui/TopBar'
import { PlanView } from './plan/PlanView'

const AiPanel = lazy(() => import('./chat/AiPanel').then((m) => ({ default: m.AiPanel })))

export function App() {
  const viewMode = useEditor((s) => s.viewMode)
  const setScene = useEditor((s) => s.setScene)
  const [ai, setAi] = useState(false)
  useShortcuts()

  useEffect(() => {
    void loadCatalog('./assets/')
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
    <div className="app">
      <TopBar onAi={() => setAi((v) => !v)} />
      <div className="main">
        <LeftPanel />
        <div className={'stage ' + viewMode}>
          {viewMode !== 'plan' && (
            <div className="view v3d">
              <ThreeHost />
            </div>
          )}
          {viewMode !== '3d' && (
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
      <Toaster />
    </div>
  )
}
