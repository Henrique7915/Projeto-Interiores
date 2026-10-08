import { useEffect, useRef, useState, type ReactNode } from 'react'
import { TEMPLATES, newScene } from '../core'
import { deleteProject, listProjects, loadProject, type ProjectRecord } from '../lib/storage'
import { importFile } from '../state/actions'
import { useEditor } from '../state/store'
import { Icon, toast } from './common'

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="ibtn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" />
          </button>
        </header>
        <div className="body">{children}</div>
      </div>
    </div>
  )
}

export function ProjectsDialog({ onClose }: { onClose: () => void }) {
  const setScene = useEditor((s) => s.setScene)
  const [saved, setSaved] = useState<ProjectRecord[]>([])
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => void listProjects().then(setSaved), [])
  const open = (s: ReturnType<typeof newScene>) => (setScene(s), onClose())
  return (
    <Modal title="Projetos" onClose={onClose} wide>
      <h4>Começar com um exemplo</h4>
      <div className="cards">
        {TEMPLATES.map((t) => (
          <button key={t.id} className="card" onClick={() => open(t.build())}>
            <strong>{t.name}</strong>
            <small>{t.description}</small>
          </button>
        ))}
      </div>
      <h4>Seus projetos neste aparelho</h4>
      {saved.length === 0 && <p className="muted">Nenhum projeto salvo ainda. O projeto aberto é salvo automaticamente.</p>}
      <ul className="list proj">
        {saved.map((p) => (
          <li key={p.id}>
            <button
              onClick={async () => {
                const s = await loadProject(p.id)
                if (s) open(s)
              }}
            >
              {p.name} <small>{new Date(p.updatedAt).toLocaleString('pt-BR')}</small>
            </button>
            <button
              className="ibtn"
              aria-label="Apagar"
              onClick={async () => {
                if (confirm(`Apagar "${p.name}" deste aparelho?`)) {
                  await deleteProject(p.id)
                  setSaved((x) => x.filter((y) => y.id !== p.id))
                }
              }}
            >
              <Icon name="trash" size={16} />
            </button>
          </li>
        ))}
      </ul>
      <div className="row">
        <button className="btn" onClick={() => file.current?.click()}>
          <Icon name="upload" size={16} /> Abrir arquivo .json
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) {
              await importFile(f)
              onClose()
            }
          }}
        />
      </div>
    </Modal>
  )
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Como usar" onClose={onClose}>
      <ul className="help">
        <li><b>Planta (2D):</b> arraste móveis e ambientes; use as ferramentas para desenhar ambientes e paredes, e para colocar portas e janelas. Digite medidas exatas no painel da direita (aceita 3,2 · 320cm · 10ft).</li>
        <li><b>3D:</b> arraste para girar, role para aproximar, clique numa superfície ou móvel para selecionar.</li>
        <li><b>Materiais:</b> escolha na paleta de baixo e aplique na seleção ou num item do moodboard (à esquerda).</li>
        <li><b>Atalhos:</b> Ctrl/Cmd+Z desfaz · Ctrl/Cmd+Shift+Z refaz · Delete remove · R gira 90° · Ctrl/Cmd+D duplica · setas movem (Shift = 1 m).</li>
        <li><b>IA:</b> use o botão "IA" para conversar com o app ou conectar o Claude Desktop/Claude Code (MCP) ou qualquer outra IA por copiar e colar.</li>
        <li><b>Salvar:</b> automático neste aparelho. Exporte o .json ou copie o link compartilhável (a cena vai dentro da URL).</li>
      </ul>
      <button className="btn" onClick={() => (toast('Bom projeto!'), onClose())}>Entendi</button>
    </Modal>
  )
}
