import { produce } from 'immer'
import { z } from 'zod'
import { getCatalogItem, hasMaterial } from './catalog'
import { bbox, dist, ensureClockwise, pointInPolygon, pointOnWall, rectPoints, round, wallAngleDeg, wallDir, wallLength, wallNormalRight } from './geometry'
import {
  ROOM_KEY,
  allIds,
  edgeOfWall,
  findAnnotation,
  findGroup,
  findObject,
  findOpening,
  findRoof,
  findRoom,
  findSlabOpening,
  findWall,
  findZone,
  freshId,
  groupOfObject,
  getContainer,
  hoursToTime,
  objectDims,
  roomAt,
  setWallRooms,
  slotNames,
  wallRoomIds,
  wallsOfRoom,
} from './model'
import type { Annotation, Container, ContainerKey, Group, Level, Opening, Room, Roof, Scene, SceneObject, SlabOpening, Wall } from './schema'

/* ───────────── schemas (UI, chat de IA e servidor MCP usam os mesmos) ───────────── */

const pt = z.tuple([z.number(), z.number()]).describe('[x, z] em metros')
const mat = z.string().describe('id de material, ex.: "wood/walnut" (ver list_materials)')
const container = z.string().optional().describe('"site" (terreno) ou id de um andar; padrão: primeiro andar (ou terreno, conforme o objeto)')
const optId = z.string().optional().describe('id opcional legível; se omitido é gerado')
const wallKind = z.enum(['solid', 'half', 'glass', 'railing', 'fence'])
const openingKind = z.enum(['door', 'double-door', 'sliding-door', 'garage-door', 'window', 'sliding-window', 'fixed-window', 'passage'])
const zoneKind = z.enum(['grass', 'paving', 'deck', 'gravel', 'soil', 'water', 'pool', 'garden-bed', 'sand', 'other'])
const roofKind = z.enum(['flat', 'shed', 'gable', 'hip'])
const treatmentKind = z.enum(['curtain', 'sheer', 'blind', 'roller', 'none'])
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
      z.object({ type: z.literal('roof'), id: z.string() }).describe('telhado (telhas)'),
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
  /* ───── andares, telhado, escada, cortina, grupos e cotas (schema v0.2) ───── */
  z.object({
    op: z.literal('addLevel'),
    id: optId,
    name: z.string().optional().describe('ex.: "1º andar"'),
    height: z.number().positive().optional().describe('pé-direito (m); padrão = o do andar de baixo'),
    slabThickness: z.number().positive().optional().describe('espessura da laje (m), padrão 0.12'),
  }),
  z.object({
    op: z.literal('updateLevel'),
    id: z.string(),
    patch: z.object({ name: z.string().optional(), height: z.number().positive().optional(), slabThickness: z.number().positive().optional(), hidden: z.boolean().optional() }),
  }),
  z.object({ op: z.literal('removeLevel'), id: z.string() }).describe('remove o andar com tudo que há nele'),
  z.object({
    op: z.literal('addRoof'),
    id: optId,
    name: z.string().optional(),
    levelId: z.string().optional().describe('andar que recebe o telhado; padrão: o do ambiente (roomId) ou o mais alto'),
    kind: roofKind.default('gable').describe('flat = laje plana · shed = uma água · gable = duas águas · hip = quatro águas'),
    roomId: z.string().optional().describe('cobre este ambiente (usa o polígono dele)'),
    x: z.number().optional(),
    z: z.number().optional(),
    width: z.number().positive().optional(),
    depth: z.number().positive().optional(),
    polygon: z.array(pt).min(3).optional(),
    pitchDeg: z.number().min(0).max(70).optional().describe('inclinação em graus (padrão: 30 para duas/quatro águas, 15 para uma água)'),
    ridgeDeg: z.number().optional().describe('direção da cumeeira (duas/quatro águas) ou da descida (uma água): 0 = ao longo de +X, 90 = ao longo de -Z. Padrão: ao longo do lado mais comprido'),
    overhang: z.number().min(0).optional().describe('beiral (m), padrão 0.4'),
    baseHeight: z.number().optional().describe('altura da base do telhado sobre o piso do andar (m); padrão: o pé-direito'),
    thickness: z.number().positive().optional(),
    material: mat.optional(),
    ceilingMaterial: mat.optional(),
  }),
  z.object({
    op: z.literal('updateRoof'),
    id: z.string(),
    patch: z.object({
      name: z.string().optional(),
      kind: roofKind.optional(),
      polygon: z.array(pt).min(3).optional(),
      pitchDeg: z.number().min(0).max(70).optional(),
      ridgeDeg: z.number().optional(),
      overhang: z.number().min(0).optional(),
      baseHeight: z.number().optional(),
      thickness: z.number().positive().optional(),
      material: mat.optional(),
      ceilingMaterial: mat.optional(),
    }),
  }),
  z.object({ op: z.literal('removeRoof'), id: z.string() }),
  z.object({
    op: z.literal('addSlabOpening'),
    id: optId,
    name: z.string().optional(),
    levelId: z.string().optional().describe('andar cujo piso é furado (o de cima da escada); padrão: o mais alto'),
    x: z.number().optional(),
    z: z.number().optional(),
    width: z.number().positive().optional(),
    depth: z.number().positive().optional(),
    polygon: z.array(pt).min(3).optional(),
    railing: z.boolean().default(true).describe('guarda-corpo em volta do vão'),
  }).describe('vão no piso para a escada; ponha a escada (stairs/*) no andar de baixo, sob o vão'),
  z.object({
    op: z.literal('updateSlabOpening'),
    id: z.string(),
    patch: z.object({ name: z.string().optional(), polygon: z.array(pt).min(3).optional(), railing: z.boolean().optional() }),
  }),
  z.object({ op: z.literal('removeSlabOpening'), id: z.string() }),
  z.object({
    op: z.literal('setTreatment'),
    id: z.string().describe('id da abertura (janela ou porta)'),
    kind: treatmentKind.describe('curtain = cortina · sheer = voal · blind = persiana · roller = rolô · none = tirar'),
    material: mat.optional().describe('tecido/cor'),
    side: z.enum(['left', 'right']).optional().describe('lado da parede; padrão: o de dentro'),
    open: z.number().min(0).max(1).optional().describe('0 = fechada, 1 = aberta'),
  }),
  z.object({
    op: z.literal('groupObjects'),
    id: optId,
    name: z.string().optional(),
    objectIds: z.array(z.string()).min(2).describe('móveis que passam a se mover juntos (do mesmo andar ou do terreno)'),
  }),
  z.object({ op: z.literal('ungroup'), id: z.string() }),
  z.object({
    op: z.literal('addDimension'),
    id: optId,
    start: pt,
    end: pt,
    offset: z.number().optional().describe('afastamento da linha de cota (m)'),
    text: z.string().optional().describe('texto no lugar da medida automática'),
    container,
  }).describe('cota desenhada na planta'),
  z.object({
    op: z.literal('addLabel'),
    id: optId,
    start: pt.describe('onde fica o texto'),
    text: z.string(),
    container,
  }).describe('texto solto na planta'),
  z.object({
    op: z.literal('updateAnnotation'),
    id: z.string(),
    patch: z.object({ start: pt.optional(), end: pt.optional(), offset: z.number().optional(), text: z.string().optional() }),
  }),
  z.object({ op: z.literal('removeAnnotation'), id: z.string() }),
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

const D = { slab: 0.12, wallHeight: 2.7, wallThickness: 0.15, floor: 'wood/natural-oak', wallIn: 'paint/white-matte', wallOut: 'paint/exterior-white' }

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

type V2 = [number, number]
interface WallStyle {
  height: number
  thickness: number
  inside: string
  outside: string
}

/** Tolerância (m) para duas paredes serem consideradas na mesma linha, e menor trecho (m) que vale a pena existir. */
const TOL = 5e-3
const MIN_SEG = 0.02

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const alongWall = (w: { start: V2; end: V2 }, p: V2) => {
  const [dx, dz] = wallDir(w)
  return (p[0] - w.start[0]) * dx + (p[1] - w.start[1]) * dz
}
const offWall = (w: { start: V2; end: V2 }, p: V2) => {
  const [dx, dz] = wallDir(w)
  return Math.abs(-(p[0] - w.start[0]) * dz + (p[1] - w.start[1]) * dx)
}

/** Trecho (em metros desde o início de w) em que o segmento a→b coincide com a parede w, ou null. */
function overlapOnWall(w: Wall, a: V2, b: V2): { lo: number; hi: number } | null {
  if (offWall(w, a) > TOL || offWall(w, b) > TOL) return null
  const lo = Math.max(0, Math.min(alongWall(w, a), alongWall(w, b)))
  const hi = Math.min(wallLength(w), Math.max(alongWall(w, a), alongWall(w, b)))
  return hi - lo >= MIN_SEG ? { lo, hi } : null
}

/**
 * Corta a parede nos pontos `cuts` (metros desde o início). O primeiro pedaço mantém o id; os outros ganham ids novos.
 * Aberturas e objetos presos à parede vão para o pedaço onde estão.
 */
function cutWall(c: Container, w: Wall, cuts: number[], taken: Set<string>): { wall: Wall; t0: number; t1: number }[] {
  const L = wallLength(w)
  const ts = [...new Set(cuts.map((t) => round(t, 4)))].filter((t) => t > MIN_SEG && t < L - MIN_SEG).sort((a, b) => a - b)
  if (!ts.length) return [{ wall: w, t0: 0, t1: L }]
  const orig = { start: w.start, end: w.end }
  const pts = [0, ...ts, L]
  const at = (t: number): V2 => (t <= 0 ? orig.start : t >= L ? orig.end : ([round(pointOnWall(orig, t)[0], 4), round(pointOnWall(orig, t)[1], 4)] as V2))
  const segs: { wall: Wall; t0: number; t1: number }[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = i === 0 ? w : { ...clone(w), id: freshId(taken, w.id) }
    segs.push({ wall: seg, t0: pts[i], t1: pts[i + 1] })
  }
  const all = list(c, 'walls')
  all.splice(all.findIndex((x) => x.id === w.id) + 1, 0, ...segs.slice(1).map((s) => s.wall))
  const pick = (t: number) => segs.find((s) => t <= s.t1) ?? segs[segs.length - 1]
  for (const o of c.openings ?? []) if (o.wallId === w.id) {
    const s = pick(o.offset)
    o.wallId = s.wall.id
    o.offset = round(o.offset - s.t0)
  }
  for (const ob of c.objects ?? []) if (ob.wallId === w.id) ob.wallId = pick(alongWall(orig, [ob.position[0], ob.position[2]])).wall.id
  for (const s of segs) {
    s.wall.start = at(s.t0)
    s.wall.end = at(s.t1)
  }
  for (const s of segs) clampOpenings(c, s.wall)
  return segs
}

/** Passa aberturas e objetos de uma parede que vai sumir para outra que cobre o mesmo trecho. */
function moveWallContents(c: Container, from: Wall, to: Wall) {
  const L = wallLength(to)
  for (const o of c.openings ?? []) if (o.wallId === from.id) {
    const center = pointOnWall(from, o.offset)
    o.wallId = to.id
    o.offset = round(clamp(alongWall(to, center), o.width / 2, L - o.width / 2))
  }
  for (const ob of c.objects ?? []) if (ob.wallId === from.id) ob.wallId = to.id
}

/**
 * Cria as paredes do ambiente. Onde a aresta coincide com a parede de outro ambiente (colada, lado a lado),
 * a parede é dividida na medida do trecho comum e compartilhada: uma só parede, ligada aos dois ambientes.
 */
function attachRoomWalls(c: Container, room: { id: string; polygon: V2[] }, st: WallStyle, taken: Set<string>) {
  const walls = list(c, 'walls')
  const rooms = (c as { rooms?: Room[] }).rooms ?? []
  const pts = room.polygon
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]
    const E = dist(p, q)
    if (E < 0.01) return
    const ux = (q[0] - p[0]) / E
    const uz = (q[1] - p[1]) / E
    const s_ = (pt: V2) => (pt[0] - p[0]) * ux + (pt[1] - p[1]) * uz
    const pointAt = (s: number): V2 => (s <= TOL ? p : s >= E - TOL ? q : [round(p[0] + ux * s, 4), round(p[1] + uz * s, 4)])
    const covered: [number, number][] = []
    const shared: { s0: number; s1: number; wall: Wall }[] = []

    // 1) paredes de ambientes vizinhos, do outro lado da aresta: divide no trecho comum e compartilha
    for (const w of [...walls]) {
      const ids = wallRoomIds(w)
      if (!ids.length || ids.includes(room.id)) continue
      const ov = overlapOnWall(w, p, q)
      if (!ov) continue
      // o vizinho tem que estar mesmo do lado de fora desta aresta (a parede pode correr em qualquer sentido)
      const m = pointOnWall(w, (ov.lo + ov.hi) / 2)
      const behind: V2 = [m[0] + uz * 0.05, m[1] - ux * 0.05]
      if (!rooms.some((r) => ids.includes(r.id) && pointInPolygon(behind, r.polygon))) continue
      const segs = cutWall(c, w, [ov.lo, ov.hi], taken)
      const mid = segs.reduce((best, s) => (Math.min(s.t1, ov.hi) - Math.max(s.t0, ov.lo) > Math.min(best.t1, ov.hi) - Math.max(best.t0, ov.lo) ? s : best))
      setWallRooms(mid.wall, [...ids, room.id])
      const sameDir = wallDir(mid.wall)[0] * ux + wallDir(mid.wall)[1] * uz > 0
      mid.wall.finish = { ...mid.wall.finish, [sameDir ? 'right' : 'left']: st.inside }
      const a = s_(mid.wall.start)
      const b = s_(mid.wall.end)
      shared.push({ s0: Math.min(a, b), s1: Math.max(a, b), wall: mid.wall })
      covered.push([Math.min(a, b), Math.max(a, b)])
    }

    // 2) paredes que já eram só deste ambiente: o que caiu sobre trecho compartilhado é redundante
    for (const w of [...walls]) {
      const ids = wallRoomIds(w)
      if (ids.length !== 1 || ids[0] !== room.id) continue
      if (!overlapOnWall(w, p, q)) continue
      const cuts = shared.flatMap((sh) => [alongWall(w, pointAt(sh.s0)), alongWall(w, pointAt(sh.s1))])
      for (const seg of cutWall(c, w, cuts, taken)) {
        const a = s_(seg.wall.start)
        const b = s_(seg.wall.end)
        const mid = (a + b) / 2
        const sh = shared.find((x) => mid > x.s0 - TOL && mid < x.s1 + TOL)
        if (sh) {
          moveWallContents(c, seg.wall, sh.wall)
          c.walls = (c.walls ?? []).filter((x) => x.id !== seg.wall.id)
        } else covered.push([Math.min(a, b), Math.max(a, b)])
      }
    }

    // 3) o que sobrou da aresta ganha parede nova
    covered.sort((a, b) => a[0] - b[0])
    let cursor = 0
    const gaps: [number, number][] = []
    for (const [a, b] of covered) {
      if (a - cursor >= MIN_SEG) gaps.push([cursor, a])
      cursor = Math.max(cursor, b)
    }
    if (E - cursor >= MIN_SEG) gaps.push([cursor, E])
    for (const [a, b] of gaps) {
      const wl = list(c, 'walls')
      wl.push({
        id: freshId(taken, `parede-${room.id}`),
        start: pointAt(a),
        end: pointAt(b),
        thickness: st.thickness,
        height: st.height,
        finish: { left: st.outside, right: st.inside },
        extensions: { [ROOM_KEY]: room.id },
      })
    }
  })
}

/** O lado direito da parede (de start para end) aponta para dentro do polígono? */
function rightFacesInside(w: Wall, poly: V2[]): boolean {
  const n = wallNormalRight(w)
  const m = pointOnWall(w, wallLength(w) / 2)
  return pointInPolygon([m[0] + n[0] * 0.05, m[1] + n[1] * 0.05], poly)
}

/** Altura, espessura e acabamentos das paredes que o ambiente já tem (ou o padrão da cena). */
function roomStyle(d: Scene, c: Container, room: Room): WallStyle {
  const df = d.defaults
  const st: WallStyle = { height: df?.wallHeight ?? (c as Level).height ?? D.wallHeight, thickness: df?.wallThickness ?? D.wallThickness, inside: df?.wallMaterial ?? D.wallIn, outside: D.wallOut }
  const mine = wallsOfRoom(c, room.id)
  const w = mine.find((x) => wallRoomIds(x).length === 1) ?? mine[0]
  if (!w) return st
  const rightIsInside = rightFacesInside(w, room.polygon)
  const [ins, out] = rightIsInside ? (['right', 'left'] as const) : (['left', 'right'] as const)
  return { height: w.height ?? st.height, thickness: w.thickness ?? st.thickness, inside: w.finish?.[ins] ?? st.inside, outside: w.finish?.[out] ?? st.outside }
}

/**
 * Muda o polígono do ambiente (resize/move) levando as paredes junto:
 * as só dele acompanham (aberturas ficam), as compartilhadas ficam com o vizinho, e a nova posição se cola de novo onde encostar.
 */
function reshapeRoom(d: Scene, c: Container, room: Room, newPoly: V2[], taken: Set<string>) {
  const had = wallsOfRoom(c, room.id)
  const oldPoly = room.polygon
  if (!had.length) {
    room.polygon = newPoly
    return
  }
  const st = roomStyle(d, c, room)
  for (const w of had) {
    const ids = wallRoomIds(w)
    if (ids.length < 2) continue
    const facing = rightFacesInside(w, oldPoly) ? 'right' : 'left'
    setWallRooms(w, ids.filter((x) => x !== room.id))
    w.finish = { ...w.finish, [facing]: st.outside }
  }
  const gone = new Set<string>()
  for (const w of wallsOfRoom(c, room.id)) {
    const { index } = edgeOfWall(oldPoly, w)
    if (index < 0) {
      gone.add(w.id)
      continue
    }
    const a = oldPoly[index]
    const b = oldPoly[(index + 1) % oldPoly.length]
    const na = newPoly[index]
    const nb = newPoly[(index + 1) % newPoly.length]
    const E = dist(a, b) || 1
    const pos = (pt: V2): V2 => {
      const u = ((pt[0] - a[0]) * (b[0] - a[0]) + (pt[1] - a[1]) * (b[1] - a[1])) / (E * E)
      return [round(na[0] + (nb[0] - na[0]) * u, 4), round(na[1] + (nb[1] - na[1]) * u, 4)]
    }
    w.start = pos(w.start)
    w.end = pos(w.end)
  }
  if (gone.size) {
    c.walls = (c.walls ?? []).filter((w) => !gone.has(w.id))
    c.openings = (c.openings ?? []).filter((o) => !gone.has(o.wallId))
  }
  room.polygon = newPoly
  attachRoomWalls(c, room, st, taken)
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

/**
 * Resolve a parede de um comando: por wallId, ou por roomId + roomSide (retângulos).
 * `flip`: a parede corre contra o sentido do lado (oeste→leste / norte→sul). `shift`: onde a parede começa, medido do início do lado.
 * Um lado pode ter várias paredes (parte dele é compartilhada com um vizinho); vale a que contém o `offset` pedido (ou o meio do lado).
 */
function resolveWallRef(d: Scene, ref: { wallId?: string; roomId?: string; roomSide?: 'north' | 'east' | 'south' | 'west'; offset?: number }) {
  if (ref.wallId) {
    const w = findWall(d, ref.wallId)
    if (!w) throw new Error(`Parede não encontrada: "${ref.wallId}"`)
    return { w, flip: false, shift: 0 }
  }
  if (!ref.roomId || !ref.roomSide) throw new Error('Informe wallId, ou roomId + roomSide (north/east/south/west).')
  const r = findRoom(d, ref.roomId)
  if (!r) throw new Error(`Ambiente não encontrado: "${ref.roomId}"`)
  const b = bbox(r.entity.polygon)
  const horizontal = ref.roomSide === 'north' || ref.roomSide === 'south'
  const target = ref.roomSide === 'north' ? b.minZ : ref.roomSide === 'south' ? b.maxZ : ref.roomSide === 'west' ? b.minX : b.maxX
  const ax = horizontal ? 0 : 1
  const cross = horizontal ? 1 : 0
  const sideStart = horizontal ? b.minX : b.minZ
  const pieces = wallsOfRoom(r.container, ref.roomId)
    .filter((w) => Math.abs(w.start[cross] - target) < TOL && Math.abs(w.end[cross] - target) < TOL)
    .map((w) => ({ w, lo: Math.min(w.start[ax], w.end[ax]) - sideStart, hi: Math.max(w.start[ax], w.end[ax]) - sideStart }))
  if (!pieces.length) throw new Error(`O ambiente "${ref.roomId}" não tem parede no lado ${ref.roomSide} (só funciona em ambientes retangulares com paredes).`)
  const pos = ref.offset ?? (horizontal ? b.width : b.depth) / 2
  const gap = (p: { lo: number; hi: number }) => Math.max(p.lo - pos, pos - p.hi, 0)
  const hit = pieces.reduce((best, p) => (gap(p) < gap(best) ? p : best))
  const flip = hit.w.start[ax] > hit.w.end[ax]
  return { w: { entity: hit.w, container: r.container, key: r.key }, flip, shift: hit.lo }
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
        attachRoomWalls(lvl, { id, polygon: pts }, { height: op.wallHeight ?? lvl.height ?? defaults?.wallHeight ?? D.wallHeight, thickness: op.wallThickness ?? defaults?.wallThickness ?? D.wallThickness, inside: op.wallMaterial ?? defaults?.wallMaterial ?? D.wallIn, outside: op.exteriorMaterial ?? D.wallOut }, taken)
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
      reshapeRoom(d, r.container, r.entity, rectPoints(op.x ?? b.minX, op.z ?? b.minZ, op.width ?? b.width, op.depth ?? b.depth), taken)
      break
    }
    case 'moveRoom': {
      const r = findRoom(d, op.id)
      if (!r) throw new Error(`Ambiente não encontrado: "${op.id}"`)
      const mv = (p: [number, number]): [number, number] => [round(p[0] + op.dx), round(p[1] + op.dz)]
      reshapeRoom(d, r.container, r.entity, r.entity.polygon.map(mv), taken)
      for (const o of r.container.objects ?? []) if (o.roomId === op.id) o.position = [round(o.position[0] + op.dx), o.position[1], round(o.position[2] + op.dz)]
      break
    }
    case 'removeRoom': {
      const r = findRoom(d, op.id)
      if (!r) throw new Error(`Ambiente não encontrado: "${op.id}"`)
      const c = r.container as Level
      const ownWalls = wallsOfRoom(c, op.id)
      const soleIds = new Set(ownWalls.filter((w) => wallRoomIds(w).length === 1).map((w) => w.id))
      const outside = roomStyle(d, c, r.entity).outside
      for (const w of ownWalls) {
        const ids = wallRoomIds(w)
        if (ids.length < 2) continue
        setWallRooms(w, ids.filter((x) => x !== op.id))
        w.finish = { ...w.finish, [rightFacesInside(w, r.entity.polygon) ? 'right' : 'left']: outside }
      }
      c.rooms = (c.rooms ?? []).filter((x) => x.id !== op.id)
      if (!op.keepWalls) {
        const ids = soleIds
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
      const { w, flip, shift } = resolveWallRef(d, op)
      const df = openingDefaults(op.kind)
      const id = newOf(op.id, op.kind)
      const width = op.width ?? df.width
      const len = wallLength(w.entity)
      const rawOffset = op.offset === undefined ? len / 2 : flip ? len - (op.offset - shift) : op.offset - shift
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
      const inRoom = op.roomId ?? (c === d.site ? undefined : ((c as Level).rooms ?? []).find((r) => pointInPolygon([op.x, op.z], r.polygon))?.id)
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
      const { w, flip, shift } = resolveWallRef(d, op)
      const dm = op.dimensions ?? cat.dimensions
      const offset = op.offset === undefined ? wallLength(w.entity) / 2 : flip ? wallLength(w.entity) - (op.offset - shift) : op.offset - shift
      const nR = wallNormalRight(w.entity)
      const n: [number, number] = op.side === 'right' ? nR : [-nR[0], -nR[1]]
      const base = pointOnWall(w.entity, offset)
      const push = (w.entity.thickness ?? D.wallThickness) / 2 + dm.depth / 2 + op.gap
      const id = newOf(op.id, op.name ?? nameSlug(cat.id))
      const yy = op.y ?? defaultElevation(cat.mount)
      const rot = normDeg((Math.atan2(n[0], n[1]) * 180) / Math.PI)
      const room = ((w.container as Level).rooms ?? []).find((r) => pointInPolygon([base[0] + n[0] * push, base[1] + n[1] * push], r.polygon))
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
        ...(room ? { roomId: room.id } : {}),
      })
      break
    }
    case 'updateObject': {
      const o = findObject(d, op.id)
      if (!o) throw new Error(`Objeto não encontrado: "${op.id}"`)
      for (const m of Object.values(op.patch.materials ?? {})) needMat(d, m)
      const { x, z, y, rotationDeg, materials, ...rest } = op.patch
      const prev = [...o.entity.position]
      Object.assign(o.entity, strip(rest))
      if (x !== undefined || y !== undefined || z !== undefined) o.entity.position = [round(x ?? o.entity.position[0], 4), round(y ?? o.entity.position[1], 4), round(z ?? o.entity.position[2], 4)]
      // objeto de um grupo leva o grupo junto (só no plano; altura e giro são do objeto)
      const grp = groupOfObject(o.container, o.entity.id)
      const mdx = o.entity.position[0] - prev[0]
      const mdz = o.entity.position[2] - prev[2]
      if (grp && (mdx || mdz) && !grp.locked)
        for (const oid of grp.objectIds) {
          const m = oid === o.entity.id ? undefined : (o.container.objects ?? []).find((q) => q.id === oid)
          if (m && !m.locked) m.position = [round(m.position[0] + mdx, 4), m.position[1], round(m.position[2] + mdz, 4)]
        }
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
      if (o.container.groups) o.container.groups = o.container.groups.map((g) => ({ ...g, objectIds: g.objectIds.filter((x) => x !== op.id) })).filter((g) => g.objectIds.length >= 2)
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
      } else if (t.type === 'roof') {
        const r = findRoof(d, t.id)
        if (!r) throw new Error(`Telhado não encontrado: "${t.id}"`)
        r.entity.material = op.material
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
    case 'addLevel': {
      const below = d.levels[d.levels.length - 1]
      const id = newOf(op.id, op.name ?? `${d.levels.length + 1} andar`)
      const height = op.height ?? below?.height ?? D.wallHeight
      d.levels.push({
        id,
        name: op.name ?? (d.levels.length ? `${d.levels.length}º andar` : 'Térreo'),
        elevation: below ? round(below.elevation + below.height + (below.slabThickness ?? D.slab), 3) : 0,
        height,
        ...(op.slabThickness ? { slabThickness: op.slabThickness } : {}),
      })
      break
    }
    case 'updateLevel': {
      const i = d.levels.findIndex((l) => l.id === op.id)
      if (i < 0) throw new Error(`Andar não encontrado: "${op.id}"`)
      const l = d.levels[i]
      const before = l.height + (l.slabThickness ?? D.slab)
      Object.assign(l, strip(op.patch))
      const shift = round(l.height + (l.slabThickness ?? D.slab) - before, 3)
      if (shift) for (const up of d.levels.slice(i + 1)) up.elevation = round(up.elevation + shift, 3)
      break
    }
    case 'removeLevel': {
      const i = d.levels.findIndex((l) => l.id === op.id)
      if (i < 0) throw new Error(`Andar não encontrado: "${op.id}"`)
      const [gone] = d.levels.splice(i, 1)
      const shift = gone.height + (gone.slabThickness ?? D.slab)
      for (const up of d.levels.slice(i)) up.elevation = round(up.elevation - shift, 3)
      break
    }
    case 'addRoof': {
      needMat(d, op.material)
      needMat(d, op.ceilingMaterial)
      const room = op.roomId ? findRoom(d, op.roomId) : undefined
      if (op.roomId && !room) throw new Error(`Ambiente não encontrado: "${op.roomId}"`)
      const lvl = (room ? (room.container as Level) : (ensureLevel(d, op.levelId ?? d.levels[d.levels.length - 1]?.id) as Level))
      if (lvl === (d.site as unknown)) throw new Error('Telhado fica em um andar, não no terreno.')
      const polygon = room ? room.entity.polygon : rectOrPoly(op)
      const b = bbox(polygon)
      const id = newOf(op.id, op.name ?? 'telhado')
      const pitch = op.pitchDeg ?? (op.kind === 'flat' ? undefined : op.kind === 'shed' ? 15 : 30)
      ;(lvl.roofs ??= []).push({
        id,
        ...(op.name ? { name: op.name } : {}),
        kind: op.kind,
        polygon,
        baseHeight: op.baseHeight ?? lvl.height,
        ...(pitch !== undefined ? { pitchDeg: pitch } : {}),
        ...(op.kind !== 'flat' ? { ridgeDeg: op.ridgeDeg ?? (b.width >= b.depth ? 0 : 90) } : {}),
        ...strip({ overhang: op.overhang, thickness: op.thickness, material: op.material, ceilingMaterial: op.ceilingMaterial }),
      })
      break
    }
    case 'updateRoof': {
      const r = findRoof(d, op.id)
      if (!r) throw new Error(`Telhado não encontrado: "${op.id}"`)
      needMat(d, op.patch.material)
      needMat(d, op.patch.ceilingMaterial)
      const { polygon, ...rest } = op.patch
      Object.assign(r.entity, strip(rest))
      if (polygon) r.entity.polygon = ensureClockwise(polygon)
      break
    }
    case 'removeRoof': {
      const r = findRoof(d, op.id)
      if (!r) throw new Error(`Telhado não encontrado: "${op.id}"`)
      ;(r.container as Level).roofs = ((r.container as Level).roofs ?? []).filter((x) => x.id !== op.id)
      break
    }
    case 'addSlabOpening': {
      const lvl = ensureLevel(d, op.levelId ?? d.levels[d.levels.length - 1]?.id) as Level
      if (lvl === (d.site as unknown)) throw new Error('Vão de escada fica em um andar, não no terreno.')
      const id = newOf(op.id, op.name ?? 'vao-escada')
      ;(lvl.slabOpenings ??= []).push({ id, ...(op.name ? { name: op.name } : {}), polygon: rectOrPoly(op), railing: op.railing })
      break
    }
    case 'updateSlabOpening': {
      const s = findSlabOpening(d, op.id)
      if (!s) throw new Error(`Vão não encontrado: "${op.id}"`)
      const { polygon, ...rest } = op.patch
      Object.assign(s.entity, strip(rest))
      if (polygon) s.entity.polygon = ensureClockwise(polygon)
      break
    }
    case 'removeSlabOpening': {
      const s = findSlabOpening(d, op.id)
      if (!s) throw new Error(`Vão não encontrado: "${op.id}"`)
      ;(s.container as Level).slabOpenings = ((s.container as Level).slabOpenings ?? []).filter((x) => x.id !== op.id)
      break
    }
    case 'setTreatment': {
      const o = findOpening(d, op.id)
      if (!o) throw new Error(`Abertura não encontrada: "${op.id}"`)
      needMat(d, op.material)
      if (op.kind === 'none') delete o.entity.treatment
      else o.entity.treatment = { kind: op.kind, ...strip({ material: op.material ?? o.entity.treatment?.material, side: op.side ?? o.entity.treatment?.side, open: op.open ?? o.entity.treatment?.open }) }
      break
    }
    case 'groupObjects': {
      const found = [...new Set(op.objectIds)].map((oid) => {
        const o = findObject(d, oid)
        if (!o) throw new Error(`Objeto não encontrado: "${oid}"`)
        return o
      })
      if (found.length < 2) throw new Error('Um grupo precisa de pelo menos 2 objetos.')
      const c = found[0].container
      if (found.some((f) => f.container !== c)) throw new Error('Os objetos do grupo precisam estar no mesmo andar (ou todos no terreno).')
      const ids = new Set(found.map((f) => f.entity.id))
      c.groups = (c.groups ?? []).map((g) => ({ ...g, objectIds: g.objectIds.filter((x) => !ids.has(x)) })).filter((g) => g.objectIds.length >= 2)
      const id = newOf(op.id, op.name ?? 'grupo')
      c.groups.push({ id, ...(op.name ? { name: op.name } : {}), objectIds: [...ids] })
      break
    }
    case 'ungroup': {
      const g = findGroup(d, op.id)
      if (!g) throw new Error(`Grupo não encontrado: "${op.id}"`)
      g.container.groups = (g.container.groups ?? []).filter((x) => x.id !== op.id)
      break
    }
    case 'addDimension': {
      const c = ensureLevel(d, op.container ?? d.levels[0]?.id)
      const id = newOf(op.id, 'cota')
      if (dist(op.start, op.end) < 0.01) throw new Error('A cota precisa de dois pontos diferentes.')
      ;(c.annotations ??= []).push({ id, kind: 'dimension', start: op.start, end: op.end, ...strip({ offset: op.offset, text: op.text }) })
      break
    }
    case 'addLabel': {
      const c = ensureLevel(d, op.container ?? d.levels[0]?.id)
      const id = newOf(op.id, 'texto')
      ;(c.annotations ??= []).push({ id, kind: 'label', start: op.start, text: op.text })
      break
    }
    case 'updateAnnotation': {
      const a = findAnnotation(d, op.id)
      if (!a) throw new Error(`Anotação não encontrada: "${op.id}"`)
      Object.assign(a.entity, strip(op.patch))
      break
    }
    case 'removeAnnotation': {
      const a = findAnnotation(d, op.id)
      if (!a) throw new Error(`Anotação não encontrada: "${op.id}"`)
      a.container.annotations = (a.container.annotations ?? []).filter((x) => x.id !== op.id)
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
