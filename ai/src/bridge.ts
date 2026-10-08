import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Scene } from '../../app/src/core/index.ts'
import { createMcpServer } from './tools.ts'
import { LocalStore, type BridgeEvent } from './store.ts'

export const DEFAULT_PORT = Number(process.env.D3D_PORT ?? 3737)

/** App publicado do projeto (GitHub Pages): também pode falar com o bridge local. */
export const PUBLISHED_APP_ORIGIN = 'https://henrique7915.github.io'

/** Origens que podem falar com o bridge: o app local (dev/preview), o app publicado e as listadas em D3D_ALLOWED_ORIGINS. */
export function originAllowed(origin: string | undefined): boolean {
  if (!origin) return true // curl, clientes MCP
  try {
    const u = new URL(origin)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]') return true
  } catch {
    return false
  }
  if (origin === PUBLISHED_APP_ORIGIN) return true
  return (process.env.D3D_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean).includes(origin)
}

async function readBody(req: IncomingMessage, limit = 25 * 1024 * 1024): Promise<unknown> {
  const chunks: Buffer[] = []
  let n = 0
  for await (const c of req) {
    n += (c as Buffer).length
    if (n > limit) throw new Error('Corpo grande demais')
    chunks.push(c as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : undefined
}

/**
 * Bridge HTTP local (127.0.0.1): o app conecta por SSE e sincroniza a cena; o endpoint /mcp expõe as
 * mesmas ferramentas por MCP "streamable HTTP"; /api/* é usado por outros processos MCP (stdio).
 */
export function startBridge(store: LocalStore, port = DEFAULT_PORT): Promise<Server> {
  const sendJson = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  const server = createServer(async (req, res) => {
    const origin = req.headers.origin as string | undefined
    if (!originAllowed(origin)) return sendJson(res, 403, { error: 'Origem não permitida. Defina D3D_ALLOWED_ORIGINS para liberar.' })
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'content-type, mcp-session-id, mcp-protocol-version, accept')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Private-Network', 'true')
    }
    if (req.method === 'OPTIONS') return void res.writeHead(204).end()

    const url = new URL(req.url ?? '/', 'http://localhost')
    try {
      if (url.pathname === '/api/health') return sendJson(res, 200, { ok: true, app: await store.appConnected(), file: store.file })

      if (url.pathname === '/api/scene' && req.method === 'GET') return sendJson(res, 200, await store.getScene())
      if (url.pathname === '/api/scene' && req.method === 'PUT') {
        const b = (await readBody(req)) as { scene: Scene; source?: string; adopt?: boolean }
        const r = b.adopt ? await store.adoptFromApp(b.scene, b.source ?? 'app') : await store.replaceScene(b.scene, b.source ?? 'app')
        return sendJson(res, 200, r)
      }
      if (url.pathname === '/api/ops' && req.method === 'POST') {
        const b = (await readBody(req)) as { ops: unknown[]; source?: string }
        return sendJson(res, 200, await store.applyOps(b.ops, b.source ?? 'ai'))
      }
      if (url.pathname === '/api/snapshot' && req.method === 'POST') {
        const b = ((await readBody(req)) ?? {}) as { view?: string }
        return sendJson(res, 200, { png: await store.snapshot({ view: b.view }) })
      }
      const sm = /^\/api\/snapshot\/([\w-]+)$/.exec(url.pathname)
      if (sm && req.method === 'POST') {
        const b = (await readBody(req)) as { png: string }
        return sendJson(res, store.resolveSnapshot(sm[1], b.png) ? 200 : 404, { ok: true })
      }
      if (url.pathname === '/api/events' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
        const send = (e: BridgeEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`)
        const { scene, rev } = await store.getScene()
        send({ type: 'scene', rev, source: 'hello', scene })
        const unsub = store.subscribe(send)
        const ping = setInterval(() => res.write(': ping\n\n'), 20000)
        req.on('close', () => (clearInterval(ping), unsub()))
        return
      }

      if (url.pathname === '/mcp') {
        if (req.method !== 'POST') return sendJson(res, 405, { jsonrpc: '2.0', error: { code: -32000, message: 'Use POST' }, id: null })
        // sem sessão: um servidor MCP novo por requisição (todo o estado vive no store)
        const mcp = createMcpServer(store)
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
        res.on('close', () => void (transport.close(), mcp.close()))
        await mcp.connect(transport)
        return void (await transport.handleRequest(req as IncomingMessage & { auth?: never }, res, await readBody(req)))
      }

      sendJson(res, 404, { error: 'Não encontrado' })
    } catch (e) {
      console.error('[design3d] erro', e instanceof Error ? e.message : e)
      if (!res.headersSent) sendJson(res, 400, { error: e instanceof Error ? e.message : String(e) })
      else res.end()
    }
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

export { randomUUID }
