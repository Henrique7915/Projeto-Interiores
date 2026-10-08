import { useEffect, useRef, useState } from 'react'
import { AI_GUIDE, CATEGORY_LABEL, COMMANDS_CHEATSHEET, applyOpsFromText, describeScene, getCatalog, listMaterials, nameOf, sceneToJson } from '../core'
import { DEFAULT_BRIDGE, connectBridge, disconnectBridge, useBridge } from '../lib/bridge'
import { prefs } from '../lib/storage'
import { useEditor } from '../state/store'
import { Icon, toast } from '../ui/common'
import { MODELS, runChatTurn, type ChatLine } from './anthropic'

type Tab = 'chat' | 'mcp' | 'paste'
const SUGGESTIONS = ['Crie uma sala de estar de 4 × 5 m com sofá azul de frente para a janela', 'Deixe o ambiente mais aconchegante', 'Troque o piso por carvalho claro', 'Adicione uma escrivaninha na parede norte', 'Confira se há móveis sobrepostos']

export function AiPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('chat')
  return (
    <div className="panel ai">
      <div className="ai-head">
        <strong>Design com IA</strong>
        <button className="ibtn" onClick={onClose} aria-label="Fechar">
          <Icon name="close" />
        </button>
      </div>
      <div className="ai-tabs">
        <button className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>Chat</button>
        <button className={tab === 'mcp' ? 'on' : ''} onClick={() => setTab('mcp')}>Minha IA (MCP)</button>
        <button className={tab === 'paste' ? 'on' : ''} onClick={() => setTab('paste')}>Copiar e colar</button>
      </div>
      {tab === 'chat' && <ChatTab />}
      {tab === 'mcp' && <McpTab />}
      {tab === 'paste' && <PasteTab />}
    </div>
  )
}

/* ───── chat dentro do app (chave do próprio usuário) ───── */
function ChatTab() {
  const [key, setKey] = useState(() => prefs.get('anthropicKey', ''))
  const [model, setModel] = useState(() => prefs.get('chatModel', MODELS[0].id))
  const [lines, setLines] = useState<ChatLine[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [showKey, setShowKey] = useState(!prefs.get('anthropicKey', ''))
  const history = useRef<Awaited<ReturnType<typeof runChatTurn>>>([])
  const abort = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [lines, busy])

  const send = async (t = text) => {
    if (!t.trim() || busy) return
    if (!key) return setShowKey(true), toast('Cole sua chave da API do Claude primeiro.', 'err')
    setText('')
    setLines((l) => [...l, { role: 'user', text: t }])
    setBusy(true)
    abort.current = new AbortController()
    try {
      history.current = await runChatTurn({ apiKey: key, model, history: history.current, userText: t, onLine: (ln) => setLines((l) => [...l, ln]), signal: abort.current.signal })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setLines((l) => [...l, { role: 'ai', text: '⚠ ' + (e instanceof Error ? e.message : String(e)) }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="ai-body">
        {showKey && (
          <div className="sec">
            <p className="muted">Para conversar aqui, use sua chave da API do Claude (console.anthropic.com). Ela fica só neste navegador, nunca vai para o projeto nem para links compartilhados. Sem chave? Use a aba “Minha IA (MCP)” ou “Copiar e colar”.</p>
            <input className="txt" type="password" placeholder="sk-ant-..." value={key} onChange={(e) => setKey(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 9, background: '#0004', border: '1px solid var(--line)' }} />
            <div className="row">
              <select value={model} onChange={(e) => (setModel(e.target.value), prefs.set('chatModel', e.target.value))} className="unit">
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <button className="btn" onClick={() => (prefs.set('anthropicKey', key.trim()), setKey(key.trim()), setShowKey(false))}>Salvar</button>
            </div>
          </div>
        )}
        {!lines.length && (
          <>
            <p className="muted">Descreva o que quer criar ou mudar. A IA edita a cena com medidas reais, e você desfaz tudo com Ctrl+Z.</p>
            <div className="sugs">{SUGGESTIONS.map((s) => <button key={s} onClick={() => void send(s)}>{s}</button>)}</div>
          </>
        )}
        {lines.map((l, i) => <div key={i} className={'msg ' + l.role}>{l.text}</div>)}
        {busy && <div className="msg tool">pensando…</div>}
        <div ref={end} />
      </div>
      <div className="ai-input">
        <textarea
          value={text}
          rows={2}
          placeholder="Ex.: quarto de 3,5 × 4 m com cama de casal e guarda-roupa"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) (e.preventDefault(), void send())
          }}
        />
        {busy ? (
          <button className="btn ghost" onClick={() => abort.current?.abort()}>Parar</button>
        ) : (
          <button className="btn" onClick={() => void send()} aria-label="Enviar"><Icon name="send" size={16} /></button>
        )}
        <button className="ibtn" title="Chave e modelo" onClick={() => setShowKey((v) => !v)}><Icon name="menu" /></button>
      </div>
    </>
  )
}

/* ───── conectar a IA do usuário por MCP ───── */
function McpTab() {
  const { status, url, error } = useBridge()
  const [u, setU] = useState(url)
  const repo = '/CAMINHO/PARA/Projeto-Interiores'
  const desktop = JSON.stringify({ mcpServers: { design3d: { command: 'npx', args: ['tsx', `${repo}/ai/src/cli.ts`] } } }, null, 2)
  const code = `claude mcp add design3d -- npx tsx ${repo}/ai/src/cli.ts`
  const codeHttp = `claude mcp add --transport http design3d ${DEFAULT_BRIDGE}/mcp`
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast('Copiado'), () => toast('Não consegui copiar', 'err'))
  return (
    <div className="ai-body">
      <p>
        Conecte a IA que você já usa (Claude Desktop, Claude Code ou qualquer cliente MCP). Ela enxerga a mesma cena que você e cria/edita ambientes por medidas. O servidor roda no seu computador.
      </p>
      <h4>1. Estado do app</h4>
      <p><span className={'status-dot' + (status === 'on' ? ' on' : '')} />{status === 'on' ? 'App conectado ao servidor MCP: mudanças da IA aparecem aqui ao vivo.' : status === 'connecting' ? 'Conectando…' : 'Não conectado.'}</p>
      {error && status !== 'on' && <p className="muted">{error}</p>}
      <div className="row">
        <input className="txt" value={u} onChange={(e) => setU(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 9, background: '#0004', border: '1px solid var(--line)' }} />
        {status === 'off' ? <button className="btn" onClick={() => connectBridge(u)}>Conectar</button> : <button className="btn ghost" onClick={disconnectBridge}>Desconectar</button>}
      </div>
      <h4>2. Claude Desktop</h4>
      <p className="muted">Em Configurações → Desenvolvedor → Editar config, adicione (troque o caminho do repositório) e reinicie:</p>
      <div className="codebox">{desktop}</div>
      <button className="btn ghost" onClick={() => copy(desktop)}>Copiar</button>
      <h4>3. Claude Code</h4>
      <div className="codebox">{code}</div>
      <button className="btn ghost" onClick={() => copy(code)}>Copiar</button>
      <p className="muted">Ou, com o servidor HTTP rodando (<code>npm run mcp:http</code>):</p>
      <div className="codebox">{codeHttp}</div>
      <button className="btn ghost" onClick={() => copy(codeHttp)}>Copiar</button>
      <h4>Como usar</h4>
      <p>Abra o app (esta tela) e peça à sua IA: “use o design3d para criar uma sala de 4 × 5 m com sofá azul”. Use <code>/design3d:projetar_ambiente</code> se o seu cliente listar prompts.</p>
    </div>
  )
}

/* ───── copiar e colar com qualquer IA ───── */
function PasteTab() {
  const scene = useEditor((s) => s.scene)
  const [ask, setAsk] = useState('')
  const [reply, setReply] = useState('')
  const [result, setResult] = useState('')

  const build = () => {
    const cats = new Map<string, string[]>()
    for (const i of getCatalog().items) cats.set(i.category, [...(cats.get(i.category) ?? []), `${i.id} (${nameOf(i.name)} ${i.dimensions.width}×${i.dimensions.height}×${i.dimensions.depth})`])
    const catalog = [...cats].map(([c, l]) => `${CATEGORY_LABEL[c] ?? c}: ${l.join('; ')}`).join('\n')
    const materials = listMaterials(scene).map((m) => `${m.ref} (${m.name})`).join('; ')
    return `${AI_GUIDE}\n\n${COMMANDS_CHEATSHEET}\n\n## Catálogo (ids de catalogId)\n${catalog}\n\n## Materiais (ids)\n${materials}\n\n## Cena atual (resumo)\n${describeScene(scene)}\n\n## Cena atual (JSON)\n${sceneToJson(scene).replace(/\n\s*/g, '')}\n\n## Pedido do usuário\n${ask || '(descreva aqui o que deseja)'}\n\n## Formato da resposta\nResponda SOMENTE com um bloco de código JSON no formato {"commands":[ ... ]} usando os comandos acima (ids novos devem ser únicos e legíveis; preserve ids existentes). Antes do bloco, no máximo 2 frases explicando o que muda.`
  }
  const copyPrompt = () => navigator.clipboard.writeText(build()).then(() => toast('Instruções copiadas: cole no seu chatbot'), () => toast('Não consegui copiar', 'err'))
  const apply = () => {
    const r = applyOpsFromText(reply, useEditor.getState().dispatch)
    setResult(r)
  }
  return (
    <div className="ai-body">
      <p>Funciona com qualquer IA (ChatGPT, Gemini, Claude.ai…), sem configurar nada.</p>
      <h4>1. O que você quer?</h4>
      <textarea className="codebox" style={{ whiteSpace: 'pre-wrap', width: '100%' }} rows={3} value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ex.: transforme em um quarto de bebê com tons suaves" />
      <button className="btn" onClick={copyPrompt}>Copiar instruções + cena</button>
      <h4>2. Cole a resposta da IA</h4>
      <textarea className="codebox" style={{ whiteSpace: 'pre-wrap', width: '100%' }} rows={6} value={reply} onChange={(e) => setReply(e.target.value)} placeholder='{"commands":[...]}' />
      <button className="btn" disabled={!reply.trim()} onClick={apply}>Aplicar na cena</button>
      {result && <p>{result}</p>}
    </div>
  )
}
