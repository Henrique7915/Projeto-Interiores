import { assertScene } from './validate'
import type { ApplyResult, OpInput } from './ops'
import type { Scene } from './schema'
import { SCENE_FORMAT, SCENE_VERSION } from './schema'

export function newScene(name = 'Novo projeto'): Scene {
  const now = new Date().toISOString()
  return {
    format: SCENE_FORMAT,
    version: SCENE_VERSION,
    id: 'cena-' + Math.random().toString(36).slice(2, 8),
    name,
    units: 'm',
    createdAt: now,
    updatedAt: now,
    defaults: { wallHeight: 2.7, wallThickness: 0.15, wallMaterial: 'paint/white-matte', floorMaterial: 'wood/natural-oak', ceilingMaterial: 'paint/white-matte', snap: 0.05 },
    environment: { timeOfDay: '17:30', sky: 'clear', mood: 'cozy', interiorLights: 'auto', northDeg: 0 },
    levels: [],
  }
}

/** Valida (JSON Schema) e devolve a cena. Lança com a lista de erros se for inválida. */
export const parseScene = (json: unknown): Scene => assertScene(json)
export const sceneToJson = (s: Scene) => JSON.stringify(s, null, 2)

/* ───── link compartilhável: deflate + base64url no hash (#s=…), sem servidor ───── */
const toB64Url = (bytes: Uint8Array) => {
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64Url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

export async function encodeShare(scene: Scene): Promise<string> {
  return toB64Url(await pipe(new TextEncoder().encode(JSON.stringify(scene)), new CompressionStream('deflate-raw')))
}
export async function decodeShare(code: string): Promise<Scene> {
  const bytes = await pipe(fromB64Url(code), new DecompressionStream('deflate-raw'))
  return parseScene(JSON.parse(new TextDecoder().decode(bytes)))
}

/** Extrai {"commands":[...]} (ou uma lista) de um texto de IA — aceita cercas ```json — e aplica via `dispatch`. */
export function applyOpsFromText(text: string, dispatch: (ops: OpInput[]) => ApplyResult): string {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  let raw = (fence ? fence[1] : text).trim()
  if (!fence) {
    const a = raw.search(/[[{]/)
    const b = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'))
    if (a >= 0 && b > a) raw = raw.slice(a, b + 1)
  }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return 'Não encontrei um JSON válido na resposta. Peça à IA para responder só com o bloco {"commands":[...]}.'
  }
  const cmds = Array.isArray(data) ? data : (data as { commands?: unknown }).commands
  if (!Array.isArray(cmds) || !cmds.length) return 'O JSON não tem a lista "commands".'
  const r = dispatch(cmds as OpInput[])
  const ok = cmds.length - r.errors.length
  return `${ok} de ${cmds.length} comandos aplicados.` + (r.errors.length ? '\n' + r.errors.slice(0, 6).map((e) => `✗ #${e.index}: ${e.message}`).join('\n') : '') + (ok ? ' Desfaça com Ctrl+Z se não gostar.' : '')
}
