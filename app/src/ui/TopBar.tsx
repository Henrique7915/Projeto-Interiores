import { useState } from 'react'
import { copyShareLink, exportJson } from '../state/actions'
import { useEditor, type ViewMode } from '../state/store'
import { download, Icon, IconButton, toast } from './common'
import { captureView } from './ThreeHost'
import { HelpDialog, ProjectsDialog } from './Dialogs'

export function TopBar({ onAi }: { onAi: () => void }) {
  const { undo, redo, past, future, viewMode, setViewMode, unit, setUnit, scene } = useEditor()
  const [dlg, setDlg] = useState<'projects' | 'help' | null>(null)
  const [menu, setMenu] = useState(false)
  const modes: { id: ViewMode; label: string; icon: string }[] = [
    { id: '3d', label: '3D', icon: 'cube' },
    { id: 'split', label: 'Dividido', icon: 'split' },
    { id: 'plan', label: 'Planta', icon: 'grid' },
  ]
  return (
    <header className="topbar">
      <div className="brand">
        <button className="logo" onClick={() => setDlg('projects')} title="Projetos e exemplos">
          <svg width="26" height="26" viewBox="0 0 512 512" aria-hidden>
            <path d="M96 300 256 210 416 300 256 390Z" fill="#f2b45a" />
            <path d="M96 300v-70l160-90 160 90v70L256 210Z" fill="#e8884a" />
            <path d="M256 210v180L96 300v-70Z" fill="#5a7dbf" />
            <path d="M256 210v180l160-90v-70Z" fill="#2f4a82" />
          </svg>
          <span>Design&nbsp;3D</span>
        </button>
        <span className="pname" title={scene.name}>{scene.name}</span>
      </div>
      <div className="seg" role="tablist" aria-label="Vista">
        {modes.map((m) => (
          <button key={m.id} className={viewMode === m.id ? 'on' : ''} onClick={() => setViewMode(m.id)}>
            <Icon name={m.icon} size={16} /> <span>{m.label}</span>
          </button>
        ))}
      </div>
      <div className="actions">
        <IconButton icon="undo" label="Desfazer (Ctrl+Z)" onClick={undo} disabled={!past.length} />
        <IconButton icon="redo" label="Refazer (Ctrl+Shift+Z)" onClick={redo} disabled={!future.length} />
        <select className="unit" value={unit} onChange={(e) => setUnit(e.target.value as 'm')} aria-label="Unidade">
          <option value="m">m</option>
          <option value="cm">cm</option>
          <option value="ft">pés</option>
        </select>
        <div className="menuwrap">
          <IconButton icon="download" label="Exportar" onClick={() => setMenu((v) => !v)} active={menu} />
          {menu && (
            <div className="menu" onMouseLeave={() => setMenu(false)}>
              <button onClick={() => (exportJson(), setMenu(false))}>Projeto (.json)</button>
              <button
                onClick={async () => {
                  setMenu(false)
                  try {
                    download(`${scene.name || 'projeto'}.png`, await captureView(), 'image/png')
                  } catch (e) {
                    toast(e instanceof Error ? e.message : 'Falha ao capturar', 'err')
                  }
                }}
              >
                Imagem 3D (.png)
              </button>
            </div>
          )}
        </div>
        <IconButton icon="link" label="Copiar link compartilhável" onClick={() => void copyShareLink()} />
        <button className="btn ai" onClick={onAi}>
          <Icon name="sparkle" size={16} /> IA
        </button>
        <IconButton icon="help" label="Ajuda" onClick={() => setDlg('help')} />
      </div>
      {dlg === 'projects' && <ProjectsDialog onClose={() => setDlg(null)} />}
      {dlg === 'help' && <HelpDialog onClose={() => setDlg(null)} />}
    </header>
  )
}
