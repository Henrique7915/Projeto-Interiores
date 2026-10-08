import { Component, type ReactNode } from 'react'

/** Evita que um erro num painel derrube a tela inteira: mostra a mensagem e deixa tentar de novo. */
export class ErrorBoundary extends Component<{ children: ReactNode; onClose?: () => void }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="panel ai">
        <div className="ai-body">
          <p>Algo deu errado neste painel: {this.state.error.message}</p>
          <button className="btn" onClick={() => this.setState({ error: undefined })}>Tentar de novo</button>
          {this.props.onClose && <button className="btn ghost" onClick={this.props.onClose}>Fechar</button>}
        </div>
      </div>
    )
  }
}
