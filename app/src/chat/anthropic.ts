import { AI_GUIDE, COMMANDS_CHEATSHEET, describeScene } from '../core'
import { useEditor } from '../state/store'
import { CHAT_TOOLS, runChatTool } from './tools'

/** Chat com a API do Claude usando a chave da própria pessoa (guardada só neste navegador; nunca vai para a cena nem para o link). */
export const MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 (equilibrado)' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5 (mais capaz)' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5 (mais rápido)' },
]

type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
interface Msg {
  role: 'user' | 'assistant'
  content: string | Block[]
}

export interface ChatLine {
  role: 'user' | 'ai' | 'tool'
  text: string
}

const SYSTEM = `Você é o assistente de design de interiores e exteriores do app Design 3D. Você edita a cena 3D do usuário através das ferramentas, sempre com medidas reais em metros.\n\n${AI_GUIDE}\n\n${COMMANDS_CHEATSHEET}`

export async function runChatTurn(opts: { apiKey: string; model: string; history: Msg[]; userText: string; onLine: (l: ChatLine) => void; signal?: AbortSignal }): Promise<Msg[]> {
  const st = useEditor.getState()
  const sel = st.selection && 'id' in st.selection ? `Seleção atual do usuário: ${st.selection.kind} "${st.selection.id}".\n` : ''
  const messages: Msg[] = [...opts.history, { role: 'user', content: `[Estado atual da cena]\n${describeScene(st.scene)}\n${sel}\n[Pedido]\n${opts.userText}` }]
  st.beginGesture() // uma mensagem do usuário = um passo de desfazer
  try {
    for (let step = 0; step < 14; step++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: opts.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: 8000,
          system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
          tools: CHAT_TOOLS,
          messages,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = (body as { error?: { message?: string } }).error?.message ?? res.statusText
        throw new Error(res.status === 401 ? 'Chave de API inválida. Confira em "Chave" nas configurações do chat.' : `Erro da API (${res.status}): ${msg}`)
      }
      const data = (await res.json()) as { content: Block[]; stop_reason: string }
      messages.push({ role: 'assistant', content: data.content })
      for (const b of data.content) if (b.type === 'text' && b.text.trim()) opts.onLine({ role: 'ai', text: b.text.trim() })
      const uses = data.content.filter((b): b is Extract<Block, { type: 'tool_use' }> => b.type === 'tool_use')
      if (data.stop_reason !== 'tool_use' || !uses.length) break
      const results: Block[] = []
      for (const u of uses) {
        const r = runChatTool(u.name, u.input)
        if (u.name === 'apply_commands') opts.onLine({ role: 'tool', text: `✎ ${(u.input.commands as unknown[] | undefined)?.length ?? 0} comando(s) aplicados${r.isError ? ' (com erros)' : ''}` })
        results.push({ type: 'tool_result', tool_use_id: u.id, content: r.text, is_error: r.isError })
      }
      messages.push({ role: 'user', content: results })
    }
  } finally {
    st.endGesture()
  }
  // histórico persistente: só texto (a cena é reenviada a cada turno)
  const condensed: Msg[] = [...opts.history, { role: 'user', content: opts.userText }]
  const last = [...messages].reverse().find((m) => m.role === 'assistant' && Array.isArray(m.content) && m.content.some((b) => b.type === 'text'))
  if (last) condensed.push({ role: 'assistant', content: (last.content as Block[]).filter((b) => b.type === 'text') })
  return condensed.slice(-20)
}
