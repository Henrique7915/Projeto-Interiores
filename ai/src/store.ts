import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { applyOps, getCatalog, newScene, setCatalog, type Catalog, type OpInput, type Scene } from '../../app/src/core/index.ts'
import { validateScene } from '../../schema/validar.mjs'

export interface ApplyReport {
  ok: boolean
  created: string[]
  errors: { index: number; message: string }[]
  validation: { errors: string[]; warnings: string[] }
  scene: Scene
  rev: number
}

/** Interface única usada pelas ferramentas MCP, seja a cena local (dono do bridge) ou remota (outro processo já é o dono). */
export interface SceneStore {
  getScene(): Promise<{ scene: Scene; rev: number }>
  applyOps(ops: unknown[]): Promise<ApplyReport>
  replaceScene(scene: unknown, source?: string): Promise<{ scene: Scene; rev: number }>
  /** PNG em base64 da vista 3D do app aberto. */
  snapshot(opts?: { view?: string }): Promise<string>
  appConnected(): Promise<boolean>
}

export interface BridgeEvent {
  type: 'scene' | 'snapshot-request'
  rev?: number
  source?: string
  scene?: Scene
  id?: string
  view?: string
}

export const dataDir = () => process.env.D3D_HOME ?? join(homedir(), '.design3d')

/** Carrega o catálogo oficial do repositório (assets/catalog.json + materials.json) se existir. */
export function loadCatalogFromDisk(assetsDir = process.env.D3D_ASSETS ?? join(import.meta.dirname, '../../assets')) {
  try {
    const f = join(assetsDir, 'catalog.json')
    if (!existsSync(f)) return false
    const cat = JSON.parse(readFileSync(f, 'utf8')) as Catalog
    const m = join(assetsDir, 'materials.json')
    if (existsSync(m)) {
      const mj = JSON.parse(readFileSync(m, 'utf8'))
      cat.materials = { ...(mj.materials ?? mj), ...(cat.materials ?? {}) }
    }
    setCatalog(cat)
    return true
  } catch (e) {
    console.error('[design3d] catálogo inválido em', assetsDir, e instanceof Error ? e.message : e)
    return false
  }
}

type Listener = (e: BridgeEvent) => void

/** Dono do estado "ao vivo": cena atual em memória + arquivo em disco + assinantes (app via SSE). */
export class LocalStore implements SceneStore {
  private scene: Scene
  private rev = 0
  private listeners = new Set<Listener>()
  private pending = new Map<string, (png: string) => void>()
  private clients = 0
  readonly file: string

  constructor(file = join(dataDir(), 'cena-atual.json')) {
    this.file = file
    this.scene = this.load() ?? newScene('Novo projeto')
  }

  private load(): Scene | undefined {
    try {
      if (existsSync(this.file)) return JSON.parse(readFileSync(this.file, 'utf8')) as Scene
    } catch (e) {
      console.error('[design3d] não consegui ler', this.file, e instanceof Error ? e.message : e)
    }
    return undefined
  }
  private persist() {
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      const tmp = this.file + '.tmp'
      writeFileSync(tmp, JSON.stringify(this.scene, null, 2))
      renameSync(tmp, this.file)
    } catch (e) {
      console.error('[design3d] falha ao salvar', e instanceof Error ? e.message : e)
    }
  }
  private emit(source: string) {
    this.persist()
    const ev: BridgeEvent = { type: 'scene', rev: this.rev, source, scene: this.scene }
    this.listeners.forEach((l) => l(ev))
  }

  subscribe(l: Listener) {
    this.listeners.add(l)
    this.clients++
    return () => {
      this.listeners.delete(l)
      this.clients--
    }
  }
  clientCount() {
    return this.clients
  }

  async getScene() {
    return { scene: this.scene, rev: this.rev }
  }

  async applyOps(ops: unknown[], source = 'ai'): Promise<ApplyReport> {
    const r = applyOps(this.scene, ops as OpInput[])
    const v = validateScene(r.scene, { catalog: getCatalog() })
    // Se o resultado ficou inválido, não aceita: devolve os erros para a IA corrigir.
    if (!v.valid) return { ok: false, created: [], errors: r.errors, validation: { errors: v.errors, warnings: v.warnings }, scene: this.scene, rev: this.rev }
    if (r.scene !== this.scene) {
      this.scene = r.scene
      this.rev++
      this.emit(source)
    }
    return { ok: r.errors.length === 0, created: r.created, errors: r.errors, validation: { errors: [], warnings: v.warnings }, scene: this.scene, rev: this.rev }
  }

  async replaceScene(scene: unknown, source = 'ai') {
    const v = validateScene(scene, { catalog: getCatalog() })
    if (!v.valid) throw new Error('Cena inválida:\n' + v.errors.slice(0, 12).join('\n'))
    this.scene = scene as Scene
    this.rev++
    this.emit(source)
    return { scene: this.scene, rev: this.rev }
  }

  /** O app abre uma conexão SSE; na conexão inicial decidimos quem manda (o mais recente vence). */
  adoptFromApp(scene: Scene, source: string) {
    const ours = Date.parse(this.scene.updatedAt ?? '') || 0
    const theirs = Date.parse(scene.updatedAt ?? '') || 0
    if (theirs >= ours) return this.replaceScene(scene, source)
    return Promise.resolve({ scene: this.scene, rev: this.rev })
  }

  async appConnected() {
    return this.clients > 0
  }

  snapshot(opts?: { view?: string }): Promise<string> {
    if (!this.clients) return Promise.reject(new Error('Nenhum app aberto. Abra o Design 3D no navegador (npm run dev) para eu enxergar a vista 3D.'))
    const id = Math.random().toString(36).slice(2)
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('O app não respondeu a tempo ao pedido de imagem (a vista 3D precisa estar visível).'))
      }, 15000)
      this.pending.set(id, (png) => {
        clearTimeout(t)
        resolve(png)
      })
      this.listeners.forEach((l) => l({ type: 'snapshot-request', id, view: opts?.view }))
    })
  }
  resolveSnapshot(id: string, png: string) {
    const f = this.pending.get(id)
    if (!f) return false
    this.pending.delete(id)
    f(png)
    return true
  }
}

/** Cliente de um bridge que já está rodando em outro processo (ex.: servidor HTTP e Claude Desktop ao mesmo tempo). */
export class RemoteStore implements SceneStore {
  constructor(private base: string) {}
  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const r = await fetch(this.base + path, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } })
    const body = (await r.json().catch(() => ({}))) as T & { error?: string }
    if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`)
    return body
  }
  getScene = () => this.call<{ scene: Scene; rev: number }>('/api/scene')
  applyOps = (ops: unknown[]) => this.call<ApplyReport>('/api/ops', { method: 'POST', body: JSON.stringify({ ops, source: 'ai' }) })
  replaceScene = (scene: unknown, source = 'ai') => this.call<{ scene: Scene; rev: number }>('/api/scene', { method: 'PUT', body: JSON.stringify({ scene, source }) })
  snapshot = async (opts?: { view?: string }) => (await this.call<{ png: string }>('/api/snapshot', { method: 'POST', body: JSON.stringify(opts ?? {}) })).png
  appConnected = async () => (await this.call<{ app: boolean }>('/api/health')).app
}
