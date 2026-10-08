import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  AI_GUIDE,
  COMMANDS_CHEATSHEET,
  CATEGORY_LABEL,
  TEMPLATES,
  analyzeScene,
  describeScene,
  getCatalog,
  listMaterials,
  nameOf,
  searchCatalog,
} from '../../app/src/core/index.ts'
import { validateScene } from '../../schema/validar.mjs'
import type { ApplyReport, SceneStore } from './store.ts'

const text = (t: string, isError = false) => ({ content: [{ type: 'text' as const, text: t }], ...(isError ? { isError: true } : {}) })
const json = (v: unknown) => JSON.stringify(v, null, 1)

function formatReport(r: ApplyReport): string {
  const out: string[] = []
  if (r.validation.errors.length) {
    out.push('NADA FOI APLICADO: o resultado ficou inválido para o formato da cena. Corrija e envie de novo:')
    out.push(...r.validation.errors.slice(0, 10).map((e) => '  - ' + e))
  } else out.push(r.ok ? `OK (rev ${r.rev}).` : `Aplicado com ${r.errors.length} comando(s) com erro (rev ${r.rev}). Os demais foram aplicados.`)
  if (r.created.length) out.push('ids criados: ' + r.created.join(', '))
  for (const e of r.errors) out.push(`  ✗ comando #${e.index}: ${e.message}`)
  if (r.validation.warnings.length) out.push('avisos: ' + r.validation.warnings.slice(0, 5).join(' | '))
  const issues = analyzeScene(r.scene)
  if (issues.length) out.push('Problemas de layout:\n' + issues.slice(0, 12).map((i) => `  - [${i.severity}] ${i.message}`).join('\n'))
  return out.join('\n')
}

export function createMcpServer(store: SceneStore) {
  const server = new McpServer(
    { name: 'design3d', version: '0.1.0' },
    {
      instructions:
        'Servidor do Design 3D: crie e edite ambientes internos e externos 3D com medidas reais. Comece com get_guide (convenções de eixos/rotação) e get_scene. Edite SEMPRE por apply_commands. Use check_layout ao terminar e snapshot (se o app estiver aberto) para ver o resultado.',
    },
  )

  server.registerTool(
    'get_guide',
    { title: 'Guia de uso', description: 'Convenções de eixos, rotação, paredes, medidas de referência e fluxo recomendado. Leia antes de editar.', annotations: { readOnlyHint: true } },
    async () => text(AI_GUIDE + '\n\n' + COMMANDS_CHEATSHEET),
  )

  server.registerTool(
    'get_scene',
    {
      title: 'Ver a cena',
      description: 'Estado atual da cena. detail="summary" (padrão): texto com ambientes, paredes, aberturas e objetos com ids e medidas; "json": a cena completa no formato oficial; "both".',
      inputSchema: { detail: z.enum(['summary', 'json', 'both']).default('summary') },
      annotations: { readOnlyHint: true },
    },
    async ({ detail }) => {
      const { scene, rev } = await store.getScene()
      const app = await store.appConnected().catch(() => false)
      const head = `(rev ${rev}; app ${app ? 'conectado' : 'não conectado'})\n`
      if (detail === 'json') return text(JSON.stringify(scene))
      if (detail === 'both') return text(head + describeScene(scene) + '\n\n--- JSON ---\n' + JSON.stringify(scene))
      return text(head + describeScene(scene))
    },
  )

  server.registerTool(
    'apply_commands',
    {
      title: 'Aplicar comandos',
      description:
        'Aplica uma lista de comandos de edição na cena (em ordem). Comandos inválidos são reportados e os demais continuam. O resultado é validado contra o schema; se ficar inválido, nada é aplicado.\n\n' + COMMANDS_CHEATSHEET,
      inputSchema: { commands: z.array(z.record(z.string(), z.unknown())).min(1).describe('lista de comandos {op: "...", ...}') },
    },
    async ({ commands }) => {
      const r = await store.applyOps(commands)
      return text(formatReport(r), !r.ok && r.validation.errors.length > 0)
    },
  )

  server.registerTool(
    'create_scene',
    {
      title: 'Criar nova cena',
      description: 'Substitui a cena atual por uma nova: vazia ou a partir de um exemplo (studio, quarto, jardim). O app aberto recebe a nova cena.',
      inputSchema: { name: z.string().optional(), template: z.enum(['vazio', 'studio', 'quarto', 'jardim']).default('vazio') },
    },
    async ({ name, template }) => {
      const t = TEMPLATES.find((x) => x.id === template)!
      const scene = t.build()
      if (name) scene.name = name
      const r = await store.replaceScene(scene)
      return text(`Cena "${r.scene.name}" criada (rev ${r.rev}).\n\n` + describeScene(r.scene))
    },
  )

  server.registerTool(
    'load_scene_json',
    {
      title: 'Carregar cena em JSON',
      description: 'Substitui a cena atual por um JSON completo no formato design3d.scene v0.1 (validado). Use para importar uma cena pronta; para pequenas mudanças prefira apply_commands.',
      inputSchema: { scene: z.record(z.string(), z.unknown()) },
    },
    async ({ scene }) => {
      try {
        const r = await store.replaceScene(scene)
        return text(`Cena carregada (rev ${r.rev}).\n\n` + describeScene(r.scene))
      } catch (e) {
        return text(e instanceof Error ? e.message : String(e), true)
      }
    },
  )

  server.registerTool(
    'validate_scene',
    {
      title: 'Validar cena',
      description: 'Valida (schema + regras de consistência) a cena atual, ou um JSON passado em "scene".',
      inputSchema: { scene: z.record(z.string(), z.unknown()).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ scene }) => {
      const target = scene ?? (await store.getScene()).scene
      const v = validateScene(target, { catalog: getCatalog() })
      return text(v.valid ? `Válida.${v.warnings.length ? '\nAvisos:\n' + v.warnings.join('\n') : ''}` : 'Inválida:\n' + v.errors.join('\n'), !v.valid)
    },
  )

  server.registerTool(
    'check_layout',
    {
      title: 'Conferir layout',
      description: 'Procura sobreposição de móveis e itens fora dos ambientes na cena atual.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      const { scene } = await store.getScene()
      const issues = analyzeScene(scene)
      return text(issues.length ? issues.map((i) => `[${i.severity}] ${i.message} (${i.ids.join(', ')})`).join('\n') : 'Nenhum problema encontrado.')
    },
  )

  server.registerTool(
    'search_catalog',
    {
      title: 'Buscar móveis e objetos',
      description: 'Lista itens do catálogo (id, nome, categoria, medidas L×A×P em metros, slots de material). Sem filtros, devolve um resumo por categoria.',
      inputSchema: { query: z.string().optional(), category: z.string().optional().describe('ex.: sofa, bed, table, plant, outdoor, lighting…'), limit: z.number().int().min(1).max(100).default(30) },
      annotations: { readOnlyHint: true },
    },
    async ({ query, category, limit }) => {
      if (!query && !category) {
        const cats = new Map<string, number>()
        for (const i of getCatalog().items) cats.set(i.category, (cats.get(i.category) ?? 0) + 1)
        return text('Categorias (use "category" ou "query"):\n' + [...cats].map(([c, n]) => `- ${c} (${CATEGORY_LABEL[c] ?? c}): ${n}`).join('\n'))
      }
      const items = searchCatalog(query, category, limit)
      if (!items.length) return text('Nada encontrado.')
      return text(
        items
          .map((i) => `${i.id} — ${nameOf(i.name)} [${i.category}] ${i.dimensions.width}×${i.dimensions.height}×${i.dimensions.depth} m; slots: ${Object.entries(i.materialSlots ?? {}).map(([k, v]) => `${k}=${v.default}`).join(', ') || '—'}${i.mount && i.mount !== 'floor' ? `; montagem: ${i.mount}` : ''}`)
          .join('\n'),
      )
    },
  )

  server.registerTool(
    'list_materials',
    {
      title: 'Listar materiais',
      description: 'Materiais disponíveis (id, nome, categoria, cor). Use os ids em setMaterial, floorMaterial, wallMaterial, materials{}.',
      inputSchema: { query: z.string().optional(), category: z.string().optional().describe('wood, stone, fabric, leather, paint, metal, glass, ground, water, ceramic, concrete…') },
      annotations: { readOnlyHint: true },
    },
    async ({ query, category }) => {
      const { scene } = await store.getScene()
      const q = query?.toLowerCase()
      const list = listMaterials(scene).filter((m) => (!category || m.category === category) && (!q || `${m.ref} ${m.name}`.toLowerCase().includes(q)))
      return text(list.map((m) => `${m.ref} — ${m.name} [${m.category}] ${m.color}`).join('\n') || 'Nada encontrado.')
    },
  )

  server.registerTool(
    'snapshot',
    {
      title: 'Imagem da vista 3D',
      description: 'Captura a vista 3D do app aberto no navegador (PNG). Requer o app conectado. Útil para conferir o resultado visualmente.',
      inputSchema: { view: z.enum(['current', 'iso', 'top', 'front']).default('current').describe('câmera (se o motor 3D suportar); "current" mantém a do usuário') },
      annotations: { readOnlyHint: true },
    },
    async ({ view }) => {
      try {
        const png = await store.snapshot({ view })
        return { content: [{ type: 'image' as const, data: png, mimeType: 'image/png' }] }
      } catch (e) {
        return text(e instanceof Error ? e.message : String(e), true)
      }
    },
  )

  server.registerResource('guia', 'design3d://guia', { title: 'Guia de uso do Design 3D', mimeType: 'text/markdown' }, async (uri) => ({
    contents: [{ uri: uri.href, text: AI_GUIDE + '\n\n' + COMMANDS_CHEATSHEET }],
  }))

  server.registerPrompt(
    'projetar_ambiente',
    { title: 'Projetar um ambiente', description: 'Pede à IA para criar um ambiente a partir de uma descrição em linguagem natural.', argsSchema: { descricao: z.string().describe('ex.: sala de 4 x 5 m com sofá azul de frente para a janela') } },
    ({ descricao }) => ({
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Use o servidor design3d para criar este ambiente: ${descricao}\n\nComece com get_guide e get_scene, monte tudo com apply_commands em medidas reais, confira com check_layout e, se possível, snapshot.` } }],
    }),
  )

  void json
  return server
}
