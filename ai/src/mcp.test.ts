import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const PORT = 38000 + Math.floor(Math.random() * 1000)
let client: Client
let transport: StdioClientTransport

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = (await client.callTool({ name, arguments: args })) as { content: { type: string; text?: string }[]; isError?: boolean }
  return { text: r.content.map((c) => c.text ?? '').join('\n'), isError: !!r.isError }
}

describe('servidor MCP do Design 3D (stdio)', () => {
  before(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', join(import.meta.dirname, 'cli.ts')],
      env: { ...(process.env as Record<string, string>), D3D_PORT: String(PORT), D3D_HOME: mkdtempSync(join(tmpdir(), 'd3d-')) },
      stderr: 'pipe',
    })
    client = new Client({ name: 'teste', version: '0.0.0' })
    await client.connect(transport)
  })
  after(async () => {
    await client.close()
  })

  it('lista as ferramentas esperadas', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    for (const n of ['get_guide', 'get_scene', 'apply_commands', 'create_scene', 'search_catalog', 'list_materials', 'check_layout', 'snapshot']) assert.ok(names.includes(n), n)
  })

  it('cria um ambiente por medidas e mobilia', async () => {
    const r = await call('apply_commands', {
      commands: [
        { op: 'addRoom', id: 'sala', name: 'Sala', x: 0, z: 0, width: 4, depth: 5, floorMaterial: 'wood/walnut' },
        { op: 'addOpening', roomId: 'sala', roomSide: 'north', kind: 'window', offset: 2, width: 1.6 },
        { op: 'addObjectAtWall', id: 'sofa', catalogId: 'sofa/modern-3-seat', roomId: 'sala', roomSide: 'south', offset: 2 },
        { op: 'addObject', catalogId: 'nao/existe', x: 1, z: 1 },
      ],
    })
    assert.match(r.text, /ids criados: sala, .*sofa/)
    assert.match(r.text, /comando #3/)
    const s = await call('get_scene')
    assert.match(s.text, /ambiente "Sala" \[sala\]: 4 × 5 m/)
    assert.match(s.text, /Sofá de 3 lugares \[sofa\]/)
  })

  it('rejeita resultado inválido sem aplicar nada', async () => {
    const before = (await call('get_scene')).text
    const r = await call('apply_commands', { commands: [{ op: 'addRoom', id: 'Sala Inválida!!', name: 'x', x: 0, z: 0, width: 1, depth: 1 }] })
    assert.match(r.text, /id inválido|#0/)
    assert.equal((await call('get_scene')).text.replace(/rev \d+/, ''), before.replace(/rev \d+/, ''))
  })

  it('valida, procura catálogo e materiais', async () => {
    assert.match((await call('validate_scene')).text, /Válida/)
    assert.match((await call('search_catalog', { query: 'sofá' })).text, /sofa\/modern-3-seat/)
    assert.match((await call('list_materials', { category: 'wood' })).text, /wood\/walnut/)
  })

  it('snapshot sem app conectado explica o que fazer', async () => {
    const r = await call('snapshot')
    assert.ok(r.isError)
    assert.match(r.text, /app/i)
  })

  it('o endpoint /mcp por HTTP responde e compartilha a cena', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_scene', arguments: {} } }),
    })
    const body = (await res.json()) as { result?: { content: { text: string }[] } }
    assert.match(body.result!.content[0].text, /Sala/)
  })
})
