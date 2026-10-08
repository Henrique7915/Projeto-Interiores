import { getCatalogItem } from './catalog'
import { footprintCorners, pointInPolygon } from './geometry'
import type { Container, ContainerKey, Opening, Room, Scene, SceneObject, Wall, GroundZone } from './schema'

export const ROOM_KEY = 'app.roomId'

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

export const wallRoomId = (w: Wall): string | undefined => (w.extensions?.[ROOM_KEY] as string | undefined)
export const wallsOfRoom = (c: Container, roomId: string) => (c.walls ?? []).filter((w) => wallRoomId(w) === roomId)

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
