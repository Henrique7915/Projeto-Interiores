#!/usr/bin/env -S npx tsx
/**
 * Servidor MCP do Design 3D.
 *
 *   tsx src/cli.ts            modo stdio (Claude Desktop, Claude Code…). Sobe também o bridge do app em
 *                             http://127.0.0.1:3737; se outro processo já for o bridge, conecta nele.
 *   tsx src/cli.ts --http     só o bridge + MCP por HTTP em http://127.0.0.1:3737/mcp (clientes com "URL remota")
 *
 * Variáveis: D3D_PORT (3737), D3D_HOME (~/.design3d), D3D_ASSETS (../assets), D3D_ALLOWED_ORIGINS (origens extras do app).
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { DEFAULT_PORT, startBridge } from './bridge.ts'
import { LocalStore, RemoteStore, loadCatalogFromDisk, type SceneStore } from './store.ts'
import { createMcpServer } from './tools.ts'

const log = (...a: unknown[]) => console.error('[design3d]', ...a) // stdout é do protocolo MCP

const httpOnly = process.argv.includes('--http')
if (loadCatalogFromDisk()) log('catálogo oficial carregado de assets/')

let store: SceneStore
const local = new LocalStore()
try {
  await startBridge(local, DEFAULT_PORT)
  store = local
  log(`bridge do app em http://127.0.0.1:${DEFAULT_PORT} (MCP HTTP em /mcp) · cena em ${local.file}`)
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw e
  if (httpOnly) {
    log(`a porta ${DEFAULT_PORT} já está em uso (provavelmente outro Design 3D já rodando).`)
    process.exit(1)
  }
  store = new RemoteStore(`http://127.0.0.1:${DEFAULT_PORT}`)
  log(`usando o bridge que já roda em http://127.0.0.1:${DEFAULT_PORT}`)
}

if (!httpOnly) {
  const server = createMcpServer(store)
  await server.connect(new StdioServerTransport())
  log('MCP stdio pronto')
}
