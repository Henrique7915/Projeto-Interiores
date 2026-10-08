import { CATEGORY_LABEL, analyzeScene, describeScene, getCatalog, listMaterials, nameOf, searchCatalog, type OpInput } from '../core'
import { useEditor } from '../state/store'

/** Ferramentas que a IA do chat do app pode chamar (mesma ideia do servidor MCP, direto no estado do editor). */
export const CHAT_TOOLS = [
  {
    name: 'get_scene',
    description: 'Estado atual da cena em texto, com ids e medidas.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'apply_commands',
    description: 'Aplica uma lista de comandos de edição (ver guia). Comandos inválidos são reportados; os demais continuam.',
    input_schema: { type: 'object', properties: { commands: { type: 'array', items: { type: 'object', properties: { op: { type: 'string' } }, required: ['op'], additionalProperties: true } } }, required: ['commands'] },
  },
  {
    name: 'search_catalog',
    description: 'Busca móveis/objetos do catálogo (id, nome, medidas). Sem argumentos, lista as categorias.',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' } } },
  },
  {
    name: 'list_materials',
    description: 'Lista materiais (id, nome, categoria, cor). Filtros opcionais.',
    input_schema: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' } } },
  },
  {
    name: 'check_layout',
    description: 'Detecta sobreposição de móveis e itens fora dos ambientes.',
    input_schema: { type: 'object', properties: {} },
  },
] as const

export function runChatTool(name: string, input: Record<string, unknown>): { text: string; isError?: boolean } {
  const st = useEditor.getState()
  switch (name) {
    case 'get_scene':
      return { text: describeScene(st.scene) }
    case 'apply_commands': {
      const cmds = Array.isArray(input.commands) ? (input.commands as OpInput[]) : []
      if (!cmds.length) return { text: 'Envie "commands" como lista não vazia.', isError: true }
      const r = st.dispatch(cmds)
      const lines: string[] = [r.errors.length ? `Aplicado com ${r.errors.length} erro(s).` : 'OK.']
      if (r.created.length) lines.push('ids criados: ' + r.created.join(', '))
      for (const e of r.errors) lines.push(`✗ comando #${e.index}: ${e.message}`)
      const issues = analyzeScene(useEditor.getState().scene)
      if (issues.length) lines.push('Problemas de layout:\n' + issues.slice(0, 10).map((i) => `- ${i.message}`).join('\n'))
      return { text: lines.join('\n'), isError: r.errors.length === cmds.length }
    }
    case 'search_catalog': {
      const q = typeof input.query === 'string' ? input.query : undefined
      const c = typeof input.category === 'string' ? input.category : undefined
      if (!q && !c) {
        const cats = new Map<string, number>()
        for (const i of getCatalog().items) cats.set(i.category, (cats.get(i.category) ?? 0) + 1)
        return { text: [...cats].map(([k, n]) => `${k} (${CATEGORY_LABEL[k] ?? k}): ${n}`).join('\n') }
      }
      const items = searchCatalog(q, c, 40)
      return { text: items.map((i) => `${i.id} — ${nameOf(i.name)} [${i.category}] ${i.dimensions.width}×${i.dimensions.height}×${i.dimensions.depth} m`).join('\n') || 'Nada encontrado.' }
    }
    case 'list_materials': {
      const q = typeof input.query === 'string' ? input.query.toLowerCase() : ''
      const c = typeof input.category === 'string' ? input.category : ''
      return { text: listMaterials(st.scene).filter((m) => (!c || m.category === c) && (!q || `${m.ref} ${m.name}`.toLowerCase().includes(q))).map((m) => `${m.ref} — ${m.name} [${m.category}]`).join('\n') || 'Nada encontrado.' }
    }
    case 'check_layout': {
      const issues = analyzeScene(st.scene)
      return { text: issues.length ? issues.map((i) => `[${i.severity}] ${i.message}`).join('\n') : 'Nenhum problema encontrado.' }
    }
    default:
      return { text: `Ferramenta desconhecida: ${name}`, isError: true }
  }
}
