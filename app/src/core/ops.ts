import { produce } from 'immer'
import { z } from 'zod'
import { getCatalogItem, hasMaterial } from './catalog'
import { bbox, dist, ensureClockwise, pointOnWall, rectPoints, round, wallAngleDeg, wallDir, wallLength, wallNormalRight } from './geometry'
import {
  ROOM_KEY,
  allIds,
  findObject,
  findOpening,
  findRoom,
  findWall,
  findZone,
  freshId,
  getContainer,
  hoursToTime,
  objectDims,
  roomAt,
  slotNames,
  wallRoomId,
  wallsOfRoom,
} from './model'
import type { Container, ContainerKey, Level, Opening, Room, Scene, SceneObject, Wall } from './schema'

/* ───────────── schemas (UI, chat de IA e servidor MCP usam os mesmos) ───────────── */

const pt = z.tuple([z.number(), z.number()]).describe('[x, z] em metros')
const mat = z.string().describe('id de material, ex.: "wood/walnut" (ver list_materials)')
const container = z.string().optional().describe('"site" (terreno) ou id de um andar; padrão: primeiro andar (ou terreno, conforme o objeto)')
const optId = z.string().optional().describe('id opcional legível; se omitido é gerado')
const wallKind = z.enum(['solid', 'half', 'glass', 'railing', 'fence'])
const openingKind = z.enum(['door', 'double-door', 'sliding-door', 'garage-door', 'window', 'sliding-window', 'fixed-window', 'passage'])
const zoneKind = z.enum(['grass', 'paving', 'deck', 'gravel', 'soil', 'water', 'pool', 'garden-bed', 'sand', 'other'])
const roomType = z.enum(['living', 'dining', 'kitchen', 'bedroom', 'bathroom', 'office', 'laundry', 'hall', 'garage', 'balcony', 'storage', 'studio', 'other'])
const dims = z.object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() })
const slots = z.record(z.string(), mat)

/** Parede por id, ou pelo lado de um ambiente retangular (mais fácil para IA acertar a orientação). */
const wallRef = {
  wallId: z.string().optional().describe('id da parede'),
  roomId: z.string().optional().describe('alternativa a wallId: id do ambiente retangular'),
  roomSide: z.enum(['north', 'east', 'south', 'west']).optional().describe('lado do ambiente (north = menor Z, east = maior X, south = maior Z, west = menor X)'),
}

export const OpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('addRoom'),
    id: optId,
    name: z.string().default('Ambiente'),
    type: roomType.optional(),
    x: z.number().optional().describe('canto mínimo X (m) — para ambiente retangular'),
    z: z.number().optional().describe('canto mínimo Z (m)'),
    width: z.number().positive().optional().describe('largura no eixo X (m)'),
    depth: z.number().positive().optional().describe('profundidade no eixo Z (m)'),
    polygon: z.array(pt).min(3).optional().describe('alternativa a x/z/width/depth: polígono qualquer'),
    container,
    walls: z.boolean().default(true).describe('criar paredes em volta (padrão: sim)'),
    wallHeight: z.number().positive().optional().describe('pé-direito (m), padrão 2.7'),
    wallThickness: z.number().positive().optional().describe('espessura (m), padrão 0.15'),
    floorMaterial: mat.optional(),
    wallMaterial: mat.optional().describe('acabamento interno das paredes'),
    exteriorMaterial: mat.optional().describe('acabamento externo das paredes'),
  }),
  z.object({
    op: z.literal('updateRoom'),
    id: z.string(),
    patch: z.object({ name: z.string().optional(), type: roomType.optional(), floorMaterial: mat.optional(), ceilingHeight: z.number().positive().optional(), ceilingVisible: z.boolean().optional() }),
  }),
  z.object({
    op: z.literal('resizeRoom'),
    id: z.string(),
    width: z.number().positive().optional(),
    depth: z.number().positive().optional(),
    x: z.number().optional(),
    z: z.number().optional(),
  }),
  z.object({ op: z.literal('moveRoom'), id: z.string(), dx: z.number(), dz: z.number() }),
  z.object({ op: z.literal('removeRoom'), id: z.string(), keepWalls: z.boolean().optional() }),

  z.object({
    op: z.literal('addZone'),
    id: optId,
    kind: zoneKind,
    name: z.string().optional(),
    x: z.number().optional(),
    z: z.number().optional(),
    width: z.number().positive().optional(),
    depth: z.number().positive().optional(),
    polygon: z.array(pt).min(3).optional(),
    material: mat.optional(),
    elevation: z.number().optional(),
    poolDepth: z.number().positive().optional().describe('profundidade (m), só para piscina/água'),
  }),
  z.object({
    op: z.literal('updateZone'),
    id: z.string(),
    patch: z.object({ name: z.string().optional(), kind: zoneKind.optional(), material: mat.optional(), edgeMaterial: mat.optional(), elevation: z.number().optional(), poolDepth: z.number().positive().optional(), polygon: z.array(pt).min(3).optional() }),
  }),
  z.object({ op: z.literal('removeZone'), id: z.string() }),
  z.object({
    op: z.literal('setSite'),
    width: z.number().positive().optional(),
    depth: z.number().positive().optional(),
    x: z.number().optional(),
    z: z.number().optional(),
    boundary: z.array(pt).min(3).optional(),
    groundMaterial: mat.optional(),
  }),

  z.object({
    op: z.literal('addWall'),
    id: optId,
    name: z.string().optional(),
    kind: wallKind.optional(),
    start: pt,
    end: pt,
    thickness: z.number().positive().optional(),
    height: z.number().positive().optional(),
    left: mat.optional(),
    right: mat.optional(),
    container,
  }),
  z.object({
    op: z.literal('updateWall'),
    id: z.string(),
    patch: z.object({ name: z.string().optional(), kind: wallKind.optional(), start: pt.optional(), end: pt.optional(), thickness: z.number().positive().optional(), height: z.number().positive().optional(), left: mat.optional(), right: mat.optional() }),
  }),
  z.object({ op: z.literal('removeWall'), id: z.string() }),

  z.object({
    op: z.literal('addOpening'),
    id: optId,
    ...wallRef,
    kind: openingKind,
    offset: z.number().optional().describe('distância (m) ao CENTRO da abertura (padrão: meio da parede). Com wallId: contada do início da parede. Com roomId+roomSide: contada do lado oeste (norte/sul) ou do lado norte (leste/oeste)'),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    sill: z.number().min(0).optional().describe('altura do peitoril (m); portas = 0'),
    hinge: z.enum(['start', 'end']).optional(),
    opensTo: z.enum(['left', 'right']).optional(),
  }),
  z.object({
    op: z.literal('updateOpening'),
    id: z.string(),
    patch: z.object({ kind: openingKind.optional(), wallId: z.string().optional(), offset: z.number().optional(), width: z.number().positive().optional(), height: z.number().positive().optional(), sill: z.number().min(0).optional(), hinge: z.enum(['start', 'end']).optional(), opensTo: z.enum(['left', 'right']).optional() }),
  }),
  z.object({ op: z.literal('removeOpening'), id: z.string() }),

  z.object({
    op: z.literal('addObject'),
    id: optId,
    catalogId: z.string().describe('id do catálogo (ver search_catalog)'),
    name: z.string().optional(),
    x: z.number(),
    z: z.number(),
    y: z.number().optional().describe('altura da base (m); padrão 0 (ou a do tipo de montagem)'),
    rotationDeg: z.number().optional().describe('anti-horário visto de cima; 0 = frente para +Z (sul); 90 = frente para +X (leste); -90 = oeste; 180 = norte'),
    dimensions: dims.optional().describe('medidas reais; padrão = do catálogo'),
    materials: slots.optional().describe('slot → material'),
    roomId: z.string().optional(),
    container,
  }),
  z.object({
    op: z.literal('addObjectAtWall'),
    id: optId,
    catalogId: z.string(),
    name: z.string().optional(),
    ...wallRef,
    offset: z.number().optional().describe('distância (m) ao centro do objeto (padrão: meio da parede); mesma convenção de addOpening'),
    side: z.enum(['left', 'right']).default('right').describe('lado da parede onde fica o objeto; "right" = interior dos ambientes'),
    gap: z.number().min(0).default(0.02),
    y: z.number().optional(),
    dimensions: dims.optional(),
    materials: slots.optional(),
  }),
  z.object({
    op: z.literal('updateObject'),
    id: z.string(),
    patch: z.object({
      name: z.string().optional(),
      x: z.number().optional(),
      z: z.number().optional(),
      y: z.number().optional(),
      rotationDeg: z.number().optional(),
      dimensions: dims.optional(),
      materials: slots.optional(),
      locked: z.boolean().optional(),
      hidden: z.boolean().optional(),
      mirror: z.boolean().optional(),
    }),
  }),
  z.object({ op: z.literal('duplicateObject'), id: z.string(), newId: optId, dx: z.number().default(0.5), dz: z.number().default(0.5) }),
  z.object({ op: z.literal('removeObject'), id: z.string() }),

  z.object({
    op: z.literal('setMaterial'),
    target: z.discriminatedUnion('type', [
      z.object({ type: z.literal('room'), id: z.string() }).describe('piso do ambiente'),
      z.object({ type: z.literal('roomWalls'), id: z.string(), side: z.enum(['inside', 'outside', 'both']).default('inside') }).describe('todas as paredes do ambiente'),
      z.object({ type: z.literal('wall'), id: z.string(), side: z.enum(['left', 'right', 'top', 'both']).default('both') }),
      z.object({ type: z.literal('object'), id: z.string(), slot: z.string().optional().describe('slot de material; padrão: o primeiro') }),
      z.object({ type: z.literal('opening'), id: z.string(), slot: z.string().default('frame') }),
      z.object({ type: z.literal('zone'), id: z.string() }),
      z.object({ type: z.literal('site') }).describe('solo do terreno'),
    ]),
    material: mat,
  }),
  z.object({
    op: z.literal('setEnvironment'),
    patch: z.object({
      timeOfDay: z.string().regex(/^\d{1,2}:\d{2}$/).optional().describe('HH:MM'),
      northDeg: z.number().optional(),
      sky: z.enum(['clear', 'partly-cloudy', 'overcast']).optional(),
      mood: z.string().optional(),
      interiorLights: z.enum(['auto', 'on', 'off']).optional(),
      exposure: z.number().optional(),
    }),
  }),
  z.object({ op: z.literal('setMeta'), patch: z.object({ name: z.string().optional(), description: z.string().optional() }) }),
  z.object({ op: z.literal('clear') }),
])

export type Op = z.infer<typeof OpSchema>
export type OpInput = z.input<typeof OpSchema>

export interface ApplyResult {
  scene: Scene
  /** ids criados, na ordem */
  created: string[]
  errors: { index: number; message: string }[]
}

const D = { wallHeight: 2.7, wallThickness: 0.15, floor: 'wood/natural-oak', wallIn: 'paint/white-matte', wallOut: 'paint/exterior-white' }

/* ───────────── aplicação ───────────── */

const strip = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi < lo ? lo : hi, v))
const normDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180

function needMat(scene: Scene, ref: string | undefined) {
  if (ref && !hasMaterial(ref, scene)) throw new Error(`Material desconhecido: "${ref}". Use list_materials para ver os ids.`)
}

function ensureLevel(d: Scene, key?: ContainerKey): Container {
  if (key === 'site') {
    d.site ??= {}
    return d.site
  }
  if (key) {
    const l = d.levels.find((x) => x.id === key)
    if (!l) throw new Error(`Andar/contêiner não encontrado: "${key}" (use "site" ou um id de andar)`)
    return l
  }
  if (!d.levels.length) d.levels.push({ id: 'terreo', name: 'Térreo', elevation: 0, height: D.wallHeight })
  return d.levels[0]
}
const list = <K extends 'walls' | 'openings' | 'objects'>(c: Container, k: K): NonNullable<Container[K]> => ((c[k] ??= [] as never) as NonNullable<Container[K]>)

function rectOrPoly(op: { x?: number; z?: number; width?: number; depth?: number; polygon?: [number, number][] }): [number, number][] {
  if (op.polygon) return ensureClockwise(op.polygon)
  if (op.width == null || op.depth == null) throw new Error('Informe width e depth (e x, z) ou um polygon.')
  return rectPoints(op.x ?? 0, op.z ?? 0, op.width, op.depth)
}

function makeWalls(d: Scene, c: Container, roomId: string, pts: [number, number][], o: { height: number; thickness: number; inside: string; outside: string }, taken: Set<string>) {
  const walls = list(c, 'walls')
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]
    if (dist(p, q) < 0.01) return
    walls.push({
      id: freshId(taken, `parede-${roomId}`),
      start: p,
      end: q,
      thickness: o.thickness,
      height: o.height,
      finish: { left: o.outside, right: o.inside },
      extensions: { [ROOM_KEY]: roomId },
    })
  })
}

function rebuildRoomWalls(c: Container, room: Room, taken: Set<string>) {
  const old = wallsOfRoom(c, room.id)
  if (!old.length) return
  const pts = room.polygon
  const goneWalls = old.slice(pts.length)
  old.slice(0, pts.length).forEach((w, i) => {
    w.start = pts[i]
    w.end = pts[(i + 1) % pts.length]
  })
  for (let i = old.length; i < pts.length; i++) {
    const proto = old[0]
    list(c, 'walls').push({ ...structuredClone(proto), id: freshId(taken, `parede-${room.id}`), start: pts[i], end: pts[(i + 1) % pts.length] })
  }
  if (goneWalls.length) {
    const ids = new Set(goneWalls.map((w) => w.id))
    c.walls = (c.walls ?? []).filter((w) => !ids.has(w.id))
    c.openings = (c.openings ?? []).filter((o) => !ids.has(o.wallId))
  }
  for (const w of wallsOfRoom(c, room.id)) clampOpenings(c, w)
}

function clampOpenings(c: Container, w: Wall) {
  const len = wallLength(w)
  for (const o of c.openings ?? []) {
    if (o.wallId !== w.id) continue
    o.width = Math.min(o.width, len)
    o.height = Math.min(o.height, w.height ?? o.height)
    o.offset = clamp(o.offset, o.width / 2, len - o.width / 2)
  }
}

export function openingDefaults(kind: Opening['kind']) {
  switch (kind) {
    case 'door':
      return { width: 0.9, height: 2.1, sill: 0 }
    case 'double-door':
      return { width: 1.6, height: 2.1, sill: 0 }
    case 'sliding-door':
      return { width: 2.0, height: 2.2, sill: 0 }
    case 'garage-door':
      return { width: 2.8, height: 2.2, sill: 0 }
    case 'passage':
      return { width: 1.0, height: 2.1, sill: 0 }
    case 'sliding-window':
      return { width: 1.6, height: 1.2, sill: 0.9 }
    case 'fixed-window':
      return { width: 1.2, height: 1.2, sill: 0.9 }
    default:
      return { width: 1.2, height: 1.2, sill: 0.9 }
  }
}

const zoneDefaultMaterial: Record<string, string> = {
  grass: 'ground/grass',
  paving: 'stone/travertine',
  deck: 'wood/deck-cumaru',
  gravel: 'ground/gravel',
  soil: 'ground/soil',
  water: 'water/pool',
  pool: 'water/pool',
  'garden-bed': 'ground/soil',
  sand: 'ground/sand',
  other: 'stone/slate',
}

/** Resolve a parede de um comando: por wallId, ou por roomId + roomSide (retângulos). `flip` = offset deve ser invertido. */
function resolveWallRef(d: Scene, ref: { wallId?: string; roomId?: string; roomSide?: 'north' | 'east' | 'south' | 'west' }) {
  if (ref.wallId) {
    const w = findWall(d, ref.wallId)
    if (!w) throw new Error(`Parede não encontrada: "${ref.wallId}"`)
    return { w, flip: false }
  }
  if (!ref.roomId || !ref.roomSide) throw new Error('Informe wallId, ou roomId + roomSide (north/east/south/west).')
  const r = findRoom(d, ref.roomId)
  if (!r) throw new Error(`Ambiente não encontrado: "${ref.roomId}"`)
  const b = bbox(r.entity.polygon)
  const eps = 1e-3
  const horizontal = ref.roomSide === 'north' || ref.roomSide === 'south'
  const target = ref.roomSide === 'north' ? b.minZ : ref.roomSide === 'south' ? b.maxZ : ref.roomSide === 'west' ? b.minX : b.maxX
  const hit = wallsOfRoom(r.container, ref.roomId).find((w) => (horizontal ? Math.abs(w.start[1] - target) < eps && Math.abs(w.end[1] - target) < eps : Math.abs(w.start[0] - target) < eps && Math.abs(w.end[0] - target) < eps))
  if (!hit) throw new Error(`O ambiente "${ref.roomId}" não tem parede no lado ${ref.roomSide} (só funciona em ambientes retangulares com paredes).`)
  const flip = horizontal ? hit.start[0] > hit.end[0] : hit.start[1] > hit.end[1]
  return { w: { entity: hit, container: r.container, key: r.key }, flip }
}

function apply(d: Scene, op: Op, created: string[]) {
  const taken = allIds(d)
  const newOf = (id: string | undefined, base: string) => {
    if (id !== undefined) {
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id)) throw new Error(`id inválido: "${id}" (use letras, números, - e _)`)
      if (taken.has(id)) throw new Error(`id já existe: "${id}"`)
      taken.add(id)
      created.push(id)
      return id
    }
    const x = freshId(taken, base)
    created.push(x)
    return x
  }
  const wall = (id: string) => {
    const r = findWall(d, id)
    if (!r) throw new Error(`Parede não encontrada: "${id}"`)
    return r
  }

  switch (op.op) {
    case 'addRoom': {
      needMat(d, op.floorMaterial)
      needMat(d, op.wallMaterial)
      needMat(d, op.exteriorMaterial)
      const pts = rectOrPoly(op)
      const c = ensureLevel(d, op.container)
      if (!('rooms' in c) && c !== d.site) (c as Level).rooms = []
      if (c === d.site) throw new Error('Ambientes (room) ficam em um andar; para áreas externas use addZone.')
      const lvl = c as Level
      const id = newOf(op.id, op.name)
      const defaults = d.defaults
      ;(lvl.rooms ??= []).push({ id, name: op.name, type: op.type, polygon: pts, floor: { material: op.floorMaterial ?? defaults?.floorMaterial ?? D.floor } })
      if (op.walls)
        makeWalls(d, lvl, id, pts, { height: op.wallHeight ?? defaults?.wallHeight ?? lvl.height ?? D.wallHeight, thickness: op.wallThickness ?? defaults?.wallThickness ?? D.wallThickness, inside: op.wallMaterial ?? defaults?.wallMaterial ?? D.wallIn, outside: op.exteriorMaterial ?? D.wallOut }, taken)
      break
    }
    case 'updateRoom': {
      const r = findRoom(d, op.id)
      if (!r) throw new Error(`Ambiente não encontrado: "${op.id}"`)
      needMat(d, op.patch.floorMaterial)
      const { name, type, floorMaterial, ceilingHeight, ceilingVisible } = op.patch
      if (name !== undefined) r.entity.name = name
      if (type !== undefined) r.entity.type = type
      if (floorMaterial !== undefined) r.entity.floor = { ...r.entity.floor, material: floorMaterial }
      if (ceilingHeight !== undefined || ceilingVisible !== undefined) r.entity.ceiling = { ...r.entity.ceiling, ...strip({ height: ceilingHeight, visible: ceilingVisible }) }
      break
    }
    case 'resizeRoom': {
      const r = findRoom(d, op.id)
      if (!r) throw new Error(`Ambiente não encontrado: "${op.id}"`)
      const b = bbox(r.entity.polygon)
      r.entity.polygon = rectPoints(op.x ?? b.minX, op.z ?? b.minZ, op.width ?? b.width, op.depth ?? b.depth)
      rebuildRoomWalls(r.container, r.entity, taken)
      break
    }
    case 'moveRoom': {
      const r = findRoom(d, op.id)
      if (!r) throw new Error(`Ambiente não encontrado: "${op.id}"`)
      const mv = (p: [number, number]): [number, number] => [round(p[0] + op.dx), round(p[1] + op.dz)]
      r.entity.polygon = r.entity.polygon.map(mv)
      for (const w of wallsOfRoom(r.container, op.id)) {
        w.start = mv(w.start)
        w.end = mv(w.end)
      }
      for (const o of r.container.objects ?? []) if (o.roomId === op.id) o.position = [round(o.position[0] + op.dx), o.position[1], round(o.position[2] + op.dz)]
      break
    }
    case 'removeRoom': {
      const r = findRoom(d, op.id)
      if (!r) throw new Error(`Ambiente não encontrado: "${op.id}"`)
      const c = r.container as Level
      c.rooms = (c.rooms ?? []).filter((x) => x.id !== op.id)
      if (!op.keepWalls) {
        const ids = new Set(wallsOfRoom(c, op.id).map((w) => w.id))
        c.walls = (c.walls ?? []).filter((w) => !ids.has(w.id))
        c.openings = (c.openings ?? []).filter((o) => !ids.has(o.wallId))
        for (const ob of c.objects ?? []) if (ob.wallId && ids.has(ob.wallId)) delete ob.wallId
      }
      for (const ob of c.objects ?? []) if (ob.roomId === op.id) delete ob.roomId
      break
    }
    case 'addZone': {
      needMat(d, op.material)
      const pts = rectOrPoly(op)
      d.site ??= {}
      const id = newOf(op.id, op.name ?? op.kind)
      ;(d.site.zones ??= []).push({
        id,
        name: op.name,
        kind: op.kind,
        polygon: pts,
        material: op.material ?? zoneDefaultMaterial[op.kind],
        ...(op.elevation !== undefined ? { elevation: op.elevation } : op.kind === 'deck' ? { elevation: 0.1 } : {}),
        ...(op.poolDepth !== undefined ? { depth: op.poolDepth } : op.kind === 'pool' ? { depth: 1.4 } : {}),
      })
      break
    }
    case 'updateZone': {
      const z = findZone(d, op.id)
      if (!z) throw new Error(`Zona não encontrada: "${op.id}"`)
      needMat(d, op.patch.material)
      needMat(d, op.patch.edgeMaterial)
      const { poolDepth, polygon, ...rest } = op.patch
      Object.assign(z.entity, strip(rest))
      if (poolDepth !== undefined) z.entity.depth = poolDepth
      if (polygon) z.entity.polygon = ensureClockwise(polygon)
      break
    }
    case 'removeZone': {
      if (!d.site?.zones?.some((z) => z.id === op.id)) throw new Error(`Zona não encontrada: "${op.id}"`)
      d.site.zones = d.site.zones.filter((z) => z.id !== op.id)
      break
    }
    case 'setSite': {
      needMat(d, op.groundMaterial)
      d.site ??= {}
      if (op.boundary) d.site.boundary = ensureClockwise(op.boundary)
      else if (op.width != null && op.depth != null) d.site.boundary = rectPoints(op.x ?? 0, op.z ?? 0, op.width, op.depth)
      if (op.groundMaterial) d.site.groundMaterial = op.groundMaterial
      d.site.groundMaterial ??= 'ground/grass'
      break
    }
    case 'addWall': {
      needMat(d, op.left)
      needMat(d, op.right)
      if (dist(op.start, op.end) < 0.01) throw new Error('Parede com comprimento zero')
      const c = ensureLevel(d, op.container)
      const id = newOf(op.id, op.name ?? 'parede')
      const fence = op.kind === 'fence'
      const m = fence ? 'wood/natural-oak' : D.wallIn
      list(c, 'walls').push({
        id,
        name: op.name,
        ...(op.kind ? { kind: op.kind } : {}),
        start: op.start,
        end: op.end,
        thickness: op.thickness ?? (fence ? 0.05 : d.defaults?.wallThickness ?? D.wallThickness),
        ...(op.height !== undefined ? { height: op.height } : fence ? { height: 1.8 } : op.kind === 'half' ? { height: 1.1 } : {}),
        finish: { left: op.left ?? m, right: op.right ?? m },
      })
      break
    }
    case 'updateWall': {
      const w = wall(op.id)
      needMat(d, op.patch.left)
      needMat(d, op.patch.right)
      const { left, right, ...rest } = op.patch
      Object.assign(w.entity, strip(rest))
      if (left !== undefined || right !== undefined) w.entity.finish = { ...w.entity.finish, ...strip({ left, right }) }
      if (wallLength(w.entity) < 0.01) throw new Error('Parede com comprimento zero')
      clampOpenings(w.container, w.entity)
      break
    }
    case 'removeWall': {
      const w = wall(op.id)
      w.container.walls = (w.container.walls ?? []).filter((x) => x.id !== op.id)
      w.container.openings = (w.container.openings ?? []).filter((o) => o.wallId !== op.id)
      for (const ob of w.container.objects ?? []) if (ob.wallId === op.id) delete ob.wallId
      break
    }
    case 'addOpening': {
      const { w, flip } = resolveWallRef(d, op)
      const df = openingDefaults(op.kind)
      const id = newOf(op.id, op.kind)
      const width = op.width ?? df.width
      const len = wallLength(w.entity)
      const rawOffset = op.offset === undefined ? len / 2 : flip ? len - op.offset : op.offset
      if (width > len) throw new Error(`Abertura (${width} m) maior que a parede (${round(len, 2)} m)`)
      const wallH = w.entity.height ?? (w.container as Level).height ?? D.wallHeight
      const sill = op.sill ?? df.sill
      const height = Math.min(op.height ?? df.height, wallH - sill)
      list(w.container, 'openings').push({ id, wallId: w.entity.id, kind: op.kind, offset: round(clamp(rawOffset, width / 2, len - width / 2)), width, height, ...(sill ? { sill } : {}), ...strip({ hinge: op.hinge, opensTo: op.opensTo }) })
      break
    }
    case 'updateOpening': {
      const o = findOpening(d, op.id)
      if (!o) throw new Error(`Abertura não encontrada: "${op.id}"`)
      Object.assign(o.entity, strip(op.patch))
      const w = wall(o.entity.wallId)
      o.entity.width = Math.min(o.entity.width, wallLength(w.entity))
      o.entity.offset = clamp(o.entity.offset, o.entity.width / 2, wallLength(w.entity) - o.entity.width / 2)
      break
    }
    case 'removeOpening': {
      const o = findOpening(d, op.id)
      if (!o) throw new Error(`Abertura não encontrada: "${op.id}"`)
      o.container.openings = (o.container.openings ?? []).filter((x) => x.id !== op.id)
      break
    }
    case 'addObject': {
      const cat = getCatalogItem(op.catalogId)
      if (!cat) throw new Error(`Item de catálogo desconhecido: "${op.catalogId}". Use search_catalog.`)
      for (const m of Object.values(op.materials ?? {})) needMat(d, m)
      let key: ContainerKey | undefined = op.container
      if (!key) {
        const hit = roomAt(d, op.x, op.z)
        key = hit ? hit.level.id : d.site && (!d.levels.length || cat.category === 'outdoor' || cat.category === 'plant') ? 'site' : undefined
      }
      const c = ensureLevel(d, key)
      const id = newOf(op.id, op.name ?? nameSlug(cat.id))
      const inRoom = op.roomId ?? roomAt(d, op.x, op.z)?.room.id
      const obj: SceneObject = {
        id,
        catalogId: op.catalogId,
        position: [round(op.x, 4), round(op.y ?? defaultElevation(cat.mount), 4), round(op.z, 4)],
        ...(op.name ? { name: op.name } : {}),
        ...(op.rotationDeg ? { rotationDeg: normDeg(op.rotationDeg) } : {}),
        ...(op.dimensions ? { dimensions: op.dimensions } : {}),
        ...(op.materials ? { materials: op.materials } : {}),
        ...(cat.mount && cat.mount !== 'floor' ? { mount: cat.mount } : {}),
        ...(inRoom && c !== d.site ? { roomId: inRoom } : {}),
      }
      list(c, 'objects').push(obj)
      break
    }
    case 'addObjectAtWall': {
      const cat = getCatalogItem(op.catalogId)
      if (!cat) throw new Error(`Item de catálogo desconhecido: "${op.catalogId}".`)
      const { w, flip } = resolveWallRef(d, op)
      const dm = op.dimensions ?? cat.dimensions
      const offset = op.offset === undefined ? wallLength(w.entity) / 2 : flip ? wallLength(w.entity) - op.offset : op.offset
      const nR = wallNormalRight(w.entity)
      const n: [number, number] = op.side === 'right' ? nR : [-nR[0], -nR[1]]
      const base = pointOnWall(w.entity, offset)
      const push = (w.entity.thickness ?? D.wallThickness) / 2 + dm.depth / 2 + op.gap
      const id = newOf(op.id, op.name ?? nameSlug(cat.id))
      const yy = op.y ?? defaultElevation(cat.mount)
      const rot = normDeg((Math.atan2(n[0], n[1]) * 180) / Math.PI)
      const room = roomAt(d, base[0] + n[0] * push, base[1] + n[1] * push)
      list(w.container, 'objects').push({
        id,
        catalogId: op.catalogId,
        position: [round(base[0] + n[0] * push), yy, round(base[1] + n[1] * push)],
        rotationDeg: rot,
        ...(op.name ? { name: op.name } : {}),
        ...(op.dimensions ? { dimensions: op.dimensions } : {}),
        ...(op.materials ? { materials: op.materials } : {}),
        ...(cat.mount && cat.mount !== 'floor' ? { mount: cat.mount } : {}),
        ...(cat.mount === 'wall' ? { wallId: w.entity.id } : {}),
        ...(room ? { roomId: room.room.id } : {}),
      })
      break
    }
    case 'updateObject': {
      const o = findObject(d, op.id)
      if (!o) throw new Error(`Objeto não encontrado: "${op.id}"`)
      for (const m of Object.values(op.patch.materials ?? {})) needMat(d, m)
      const { x, z, y, rotationDeg, materials, ...rest } = op.patch
      Object.assign(o.entity, strip(rest))
      if (x !== undefined || y !== undefined || z !== undefined) o.entity.position = [round(x ?? o.entity.position[0], 4), round(y ?? o.entity.position[1], 4), round(z ?? o.entity.position[2], 4)]
      if (rotationDeg !== undefined) o.entity.rotationDeg = normDeg(rotationDeg)
      if (materials) o.entity.materials = { ...o.entity.materials, ...materials }
      break
    }
    case 'duplicateObject': {
      const o = findObject(d, op.id)
      if (!o) throw new Error(`Objeto não encontrado: "${op.id}"`)
      const id = newOf(op.newId, o.entity.name ?? nameSlug(o.entity.catalogId))
      const copy = structuredClone(o.entity)
      copy.id = id
      copy.position = [round(copy.position[0] + op.dx), copy.position[1], round(copy.position[2] + op.dz)]
      delete copy.locked
      list(o.container, 'objects').push(copy)
      break
    }
    case 'removeObject': {
      const o = findObject(d, op.id)
      if (!o) throw new Error(`Objeto não encontrado: "${op.id}"`)
      o.container.objects = (o.container.objects ?? []).filter((x) => x.id !== op.id)
      for (const ob of o.container.objects) if (ob.parentId === op.id) delete ob.parentId
      break
    }
    case 'setMaterial': {
      needMat(d, op.material)
      const t = op.target
      if (t.type === 'room') {
        const r = findRoom(d, t.id)
        if (!r) throw new Error(`Ambiente não encontrado: "${t.id}"`)
        r.entity.floor = { ...r.entity.floor, material: op.material }
      } else if (t.type === 'roomWalls') {
        const r = findRoom(d, t.id)
        if (!r) throw new Error(`Ambiente não encontrado: "${t.id}"`)
        for (const w of wallsOfRoom(r.container, t.id)) {
          w.finish ??= {}
          if (t.side !== 'outside') w.finish.right = op.material
          if (t.side !== 'inside') w.finish.left = op.material
        }
      } else if (t.type === 'wall') {
        const w = wall(t.id).entity
        w.finish ??= {}
        if (t.side === 'top') w.finish.top = op.material
        else {
          if (t.side !== 'left') w.finish.right = op.material
          if (t.side !== 'right') w.finish.left = op.material
        }
      } else if (t.type === 'object') {
        const o = findObject(d, t.id)
        if (!o) throw new Error(`Objeto não encontrado: "${t.id}"`)
        const slot = t.slot ?? slotNames(o.entity)[0]
        o.entity.materials = { ...o.entity.materials, [slot]: op.material }
      } else if (t.type === 'opening') {
        const o = findOpening(d, t.id)
        if (!o) throw new Error(`Abertura não encontrada: "${t.id}"`)
        o.entity.materials = { ...o.entity.materials, [t.slot]: op.material }
      } else if (t.type === 'zone') {
        const z = findZone(d, t.id)
        if (!z) throw new Error(`Zona não encontrada: "${t.id}"`)
        z.entity.material = op.material
      } else {
        d.site ??= {}
        d.site.groundMaterial = op.material
      }
      break
    }
    case 'setEnvironment':
      d.environment = { ...d.environment, ...strip(op.patch) }
      break
    case 'setMeta': {
      if (op.patch.name !== undefined) d.name = op.patch.name
      if (op.patch.description !== undefined) d.meta = { ...d.meta, description: op.patch.description }
      break
    }
    case 'clear':
      d.levels = []
      delete d.site
      break
  }
}

const defaultElevation = (mount: SceneObject['mount']) => (mount === 'wall' ? 1.2 : mount === 'ceiling' ? 2.1 : 0)
const nameSlug = (catalogId: string) => catalogId.split('/').pop() ?? catalogId

/**
 * Aplica uma lista de operações. Operações que falham são puladas e reportadas em `errors`; as demais continuam.
 * Se algo mudou, atualiza `updatedAt`.
 */
export function applyOps(scene: Scene, input: OpInput[], now: () => Date = () => new Date()): ApplyResult {
  const created: string[] = []
  const errors: ApplyResult['errors'] = []
  let current = scene
  input.forEach((raw, index) => {
    const parsed = OpSchema.safeParse(raw)
    if (!parsed.success) {
      errors.push({ index, message: parsed.error.issues.map((i) => `${i.path.join('.') || 'op'}: ${i.message}`).join('; ') })
      return
    }
    try {
      const local: string[] = []
      current = produce(current, (d) => apply(d as Scene, parsed.data, local))
      created.push(...local)
    } catch (e) {
      errors.push({ index, message: e instanceof Error ? e.message : String(e) })
    }
  })
  if (current !== scene) current = { ...current, updatedAt: now().toISOString() }
  return { scene: current, created, errors }
}

export { hoursToTime, objectDims, getContainer, wallAngleDeg, wallDir }
