import { getCatalogItem } from './catalog'
import { dist, footprintCorners, pointInPolygon } from './geometry'
import type { Container, ContainerKey, Opening, Room, Scene, SceneObject, Wall, GroundZone } from './schema'

/** Ambiente dono da parede (o primeiro, se a parede é compartilhada). */
export const ROOM_KEY = 'app.roomId'
/** Todos os ambientes que encostam na parede; só existe quando a parede é compartilhada por 2 ou mais. */
export const ROOMS_KEY = 'app.roomIds'

export interface Located<T> {
  entity: T
  container: Container
  key: ContainerKey
}

export function allContainers(scene: Scene): { key: ContainerKey; c: Container }[] {
  const out: { key: ContainerKey; c: Container }[] = scene.levels.map((l) => ({ key: l.id, c: l }))
  if (scene.site) out.push({ key: 'site', c: scene.site })
  return out
}

export const getContainer = (scene: Scene, key: ContainerKey): Container | undefined => (key === 'site' ? scene.site : scene.levels.find((l) => l.id === key))

function locate<T extends { id: string }>(scene: Scene, id: string, pick: (c: Container) => T[] | undefined): Located<T> | undefined {
  for (const { key, c } of allContainers(scene)) {
    const e = pick(c)?.find((x) => x.id === id)
    if (e) return { entity: e, container: c, key }
  }
  return undefined
}
export const findWall = (s: Scene, id: string) => locate<Wall>(s, id, (c) => c.walls)
export const findOpening = (s: Scene, id: string) => locate<Opening>(s, id, (c) => c.openings)
export const findObject = (s: Scene, id: string) => locate<SceneObject>(s, id, (c) => c.objects)
export const findRoom = (s: Scene, id: string) => locate<Room>(s, id, (c) => (c as { rooms?: Room[] }).rooms)
export const findZone = (s: Scene, id: string) => locate<GroundZone>(s, id, (c) => (c as { zones?: GroundZone[] }).zones)

export const wallRoomIds = (w: Wall): string[] => {
  const list = w.extensions?.[ROOMS_KEY]
  if (Array.isArray(list)) return list.filter((x): x is string => typeof x === 'string')
  const one = w.extensions?.[ROOM_KEY]
  return typeof one === 'string' ? [one] : []
}
export const wallRoomId = (w: Wall): string | undefined => wallRoomIds(w)[0]
export function setWallRooms(w: Wall, ids: string[]) {
  const ext: Record<string, unknown> = { ...w.extensions }
  delete ext[ROOM_KEY]
  delete ext[ROOMS_KEY]
  if (ids.length) ext[ROOM_KEY] = ids[0]
  if (ids.length > 1) ext[ROOMS_KEY] = [...ids]
  if (Object.keys(ext).length) w.extensions = ext as Wall['extensions']
  else delete w.extensions
}

/** Índice da aresta do polígono sobre a qual a parede está (e a posição do meio da parede ao longo dela), ou -1. */
export function edgeOfWall(poly: [number, number][], w: Wall): { index: number; at: number } {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const e = dist(a, b)
    if (e < 1e-6) continue
    const ux = (b[0] - a[0]) / e
    const uz = (b[1] - a[1]) / e
    const off = (p: [number, number]) => Math.abs((p[0] - a[0]) * -uz + (p[1] - a[1]) * ux)
    if (off(w.start) < 5e-3 && off(w.end) < 5e-3) return { index: i, at: ((w.start[0] + w.end[0]) / 2 - a[0]) * ux + ((w.start[1] + w.end[1]) / 2 - a[1]) * uz }
  }
  return { index: -1, at: 0 }
}

/** Paredes que encostam no ambiente (inclusive as compartilhadas), na ordem das arestas do polígono (norte→leste→sul→oeste num retângulo). */
export function wallsOfRoom(c: Container, roomId: string): Wall[] {
  const mine = (c.walls ?? []).filter((w) => wallRoomIds(w).includes(roomId))
  const room = (c as { rooms?: Room[] }).rooms?.find((r) => r.id === roomId)
  if (!room || mine.length < 2) return mine
  return mine
    .map((w) => ({ w, k: edgeOfWall(room.polygon, w) }))
    .sort((p, q) => (p.k.index < 0 ? 1e9 : p.k.index) - (q.k.index < 0 ? 1e9 : q.k.index) || p.k.at - q.k.at)
    .map((x) => x.w)
}

export function allIds(scene: Scene): Set<string> {
  const ids = new Set<string>([scene.id])
  for (const v of scene.views ?? []) ids.add(v.id)
  for (const { c } of allContainers(scene)) {
    if ('id' in c) ids.add(c.id)
    for (const l of [c.walls, c.openings, c.objects, (c as { rooms?: Room[] }).rooms, (c as { zones?: GroundZone[] }).zones]) for (const e of l ?? []) ids.add(e.id)
  }
  return ids
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'x'

/** Gera um id legível e único na cena: base, base-2, base-3… */
export function freshId(taken: Set<string>, base: string): string {
  const b = slug(base)
  let id = b
  for (let n = 2; taken.has(id); n++) id = `${b}-${n}`
  taken.add(id)
  return id
}

/** Dimensões efetivas (da cena ou do catálogo). */
export function objectDims(o: SceneObject): { width: number; height: number; depth: number } {
  return o.dimensions ?? getCatalogItem(o.catalogId)?.dimensions ?? { width: 0.5, height: 0.5, depth: 0.5 }
}
export function objectCorners(o: SceneObject) {
  const d = objectDims(o)
  return footprintCorners({ position: o.position, rotationDeg: o.rotationDeg, width: d.width, depth: d.depth })
}
export function slotNames(o: SceneObject): string[] {
  const slots = Object.keys(getCatalogItem(o.catalogId)?.materialSlots ?? {})
  return slots.length ? slots : Object.keys(o.materials ?? {}).length ? Object.keys(o.materials ?? {}) : ['main']
}
/** Materiais efetivos por slot (padrão do catálogo + trocas da cena). */
export function objectMaterials(o: SceneObject): Record<string, string> {
  const base: Record<string, string> = {}
  for (const [k, v] of Object.entries(getCatalogItem(o.catalogId)?.materialSlots ?? {})) base[k] = v.default
  return { ...base, ...(o.materials ?? {}) }
}

export function roomAt(scene: Scene, x: number, z: number): { room: Room; level: Container & { id: string } } | undefined {
  for (const l of scene.levels) for (const r of l.rooms ?? []) if (pointInPolygon([x, z], r.polygon)) return { room: r, level: l }
  return undefined
}

export const timeToHours = (t: string | undefined): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? '')
  return m ? Math.min(24, Number(m[1]) + Number(m[2]) / 60) : 12
}
export const hoursToTime = (h: number): string => {
  const mins = Math.round((((h % 24) + 24) % 24) * 60) % 1440
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}
