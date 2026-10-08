import { Component, type ReactNode } from 'react'

/** Esquece o app guardado no aparelho (service worker e caches) e recarrega: resolve versões misturadas depois de uma atualização. */
async function reloadFresh() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations()
    await Promise.all((regs ?? []).map((r) => r.unregister()))
    const keys = (await caches?.keys?.()) ?? []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch {
    /* sem acesso: só recarrega */
  }
  location.reload()
}

const STALE = /dynamically imported module|importing a module script|loading (css )?chunk/i

/** Evita que um erro num painel derrube a tela inteira: mostra o que houve e deixa tentar de novo. */
export class ErrorBoundary extends Component<{ children: ReactNode; onClose?: () => void }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error('[painel]', error)
    // aba aberta antes de uma atualização: o arquivo antigo não existe mais; recarrega sozinho uma vez
    if (STALE.test(error.message) && !sessionStorage.getItem('d3d.reloaded')) {
      sessionStorage.setItem('d3d.reloaded', '1')
      void reloadFresh()
    }
  }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const where = (error.stack ?? '').split('\n').slice(1, 4).map((l) => l.trim().replace(/^at /, '').replace(/\(?https?:\/\/[^/]+\/[^)]*\//, '(')).join(' · ')
    return (
      <div className="panel ai">
        <div className="ai-body">
          <p>Algo deu errado neste painel.</p>
          <p className="muted">{error.message}</p>
          {where && <p className="muted" style={{ fontSize: 11, wordBreak: 'break-all' }}>{where}</p>}
          <button className="btn" onClick={() => this.setState({ error: undefined })}>Tentar de novo</button>
          <button className="btn ghost" onClick={() => void reloadFresh()}>Atualizar o app (limpa o cache)</button>
          {this.props.onClose && <button className="btn ghost" onClick={this.props.onClose}>Fechar</button>}
        </div>
      </div>
    )
  }
}
