import type { Material, MaterialRef, Opening, Point2, Point3, Scene, SceneObject, Wall } from '../../../../schema/types'
import { getCatalogItem } from '../catalog/registry'
import { resolveMaterial, type MaterialSpec } from '../materials/library'
import type { REnvironment, RLight, RObject, ROpening, RRoof, RSlabOpening, RTerrain, RenderScene, RRoom, RSite, RWall, RZone } from '../render/types'
import { terrainHeight } from '../geometry/terrain'

const DEG = Math.PI / 180

export function parseTime(t: string | undefined, fallback = 12.8): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? '')
  return m ? Math.min(24, +m[1] + +m[2] / 60) : fallback
}

const DOORS = new Set(['door', 'double-door', 'sliding-door', 'garage-door', 'passage'])
/** abertura que corta a parede até o chão (porta) em vez de furo (janela) */
export const isNotch = (o: { kind: string; sill: number }) => DOORS.has(o.kind) && o.sill < 0.001

type Mats = Record<MaterialRef, Material> | undefined

function toOpening(o: Opening, mats: Mats): ROpening {
  const windowLike = !DOORS.has(o.kind)
  const slot = (name: string, fb: MaterialRef) => resolveMaterial(o.materials?.[name], mats, fb)
  return {
    id: o.id,
    kind: o.kind,
    offset: o.offset,
    width: o.width,
    height: o.height,
    sill: o.sill ?? 0,
    hinge: o.hinge ?? 'start',
    opensTo: o.opensTo ?? 'left',
    frame: slot('frame', windowLike || o.kind === 'sliding-door' ? 'metal/black-matte' : 'paint/white-matte'),
    leaf: slot('leaf', o.kind === 'garage-door' ? 'paint/charcoal' : 'wood/natural-oak'),
    glass: slot('glass', 'glass/clear'),
    treatment:
      o.treatment && o.treatment.kind !== 'none'
        ? {
            kind: o.treatment.kind,
            material: resolveMaterial(o.treatment.material, mats, o.treatment.kind === 'sheer' ? 'fabric/linen' : o.treatment.kind === 'blind' ? 'wood/pine' : 'fabric/linen'),
            side: o.treatment.side,
            open: o.treatment.open ?? 0,
          }
        : undefined,
  }
}

interface Ctx {
  scene: Scene
  mats: Mats
  wallHeight: number
  wallThickness: number
  wallMaterial: MaterialRef
}

function toWall(w: Wall, openings: Opening[], levelId: string, elevation: number, levelHeight: number, c: Ctx): RWall {
  const kind = w.kind ?? 'solid'
  const height = w.height ?? (kind === 'half' ? 1.1 : kind === 'fence' ? 1.8 : kind === 'railing' ? 1.0 : levelHeight)
  const thickness = w.thickness ?? (kind === 'fence' || kind === 'railing' ? 0.05 : c.wallThickness)
  const base = kind === 'glass' ? 'glass/clear' : c.wallMaterial
  const left = resolveMaterial(w.finish?.left, c.mats, base)
  const right = resolveMaterial(w.finish?.right, c.mats, base)
  const bb = w.finish?.baseboard
  return {
    id: w.id,
    levelId,
    kind,
    a: w.start,
    b: w.end,
    thickness,
    height,
    heightEnd: w.heightEnd ?? height,
    elevation,
    left,
    right,
    top: resolveMaterial(w.finish?.top, c.mats, w.finish?.left ?? base),
    baseboard: bb ? { height: bb.height ?? 0.08, material: resolveMaterial(bb.material, c.mats, 'paint/white-matte'), sides: bb.sides ?? 'both' } : undefined,
    openings: openings.filter((o) => o.wallId === w.id).map((o) => toOpening(o, c.mats)),
  }
}

function lightOf(o: SceneObject, itemLight: RObject['light'] | undefined): RLight | undefined {
  const l = o.light
  if (!l && !itemLight) return undefined
  return {
    on: l?.on ?? itemLight?.on ?? true,
    type: l?.type ?? itemLight?.type ?? 'point',
    lumens: l?.intensity ?? itemLight?.lumens ?? 400,
    temperatureK: l?.temperatureK ?? itemLight?.temperatureK ?? 2700,
    color: l?.color ?? itemLight?.color,
    castShadow: l?.castShadow ?? itemLight?.castShadow ?? false,
  }
}

function toObject(o: SceneObject, elevation: number, levelHeight: number, c: Ctx): RObject {
  const item = getCatalogItem(o.catalogId)
  const d = o.dimensions ?? item?.dimensions
  const size: Point3 = d ? [d.width, d.height, d.depth] : [0.5, 0.5, 0.5]
  const materials: Record<string, MaterialSpec> = {}
  for (const [slot, def] of Object.entries(item?.materialSlots ?? {})) materials[slot] = resolveMaterial(o.materials?.[slot], c.mats, def.default)
  for (const [slot, ref] of Object.entries(o.materials ?? {})) if (!materials[slot]) materials[slot] = resolveMaterial(ref, c.mats)
  const itemLight: RObject['light'] | undefined = item?.light
    ? { on: item.light.on ?? true, type: item.light.type, lumens: item.light.intensity ?? 400, temperatureK: item.light.temperatureK ?? 2700, color: item.light.color, castShadow: item.light.castShadow ?? false }
    : undefined
  const y = o.position[1]
  return {
    id: o.id,
    name: o.name,
    catalogId: o.catalogId,
    item,
    model: item?.model ?? 'procedural/box',
    position: [o.position[0], elevation + y, o.position[2]],
    elevation,
    rotationY: (o.rotationDeg ?? 0) * DEG,
    size,
    mirror: !!o.mirror,
    mount: o.mount ?? item?.mount ?? 'floor',
    materials,
    light: lightOf(o, itemLight),
    locked: !!o.locked,
    hidden: !!o.hidden,
    clearance: Math.max(0.05, levelHeight - y),
  }
}

export interface ToRenderOptions {
  /** mostra só este andar e os de baixo (os de cima, com telhado e tudo, ficam escondidos) */
  upToLevel?: string
}

/** Converte o `Scene` do schema na estrutura que o motor desenha. Puro e barato: pode rodar a cada mudança. */
export function toRenderScene(scene: Scene, opts: ToRenderOptions = {}): RenderScene {
  const d = scene.defaults ?? {}
  const base: Ctx = {
    scene,
    mats: scene.materials,
    wallHeight: d.wallHeight ?? 2.7,
    wallThickness: d.wallThickness ?? 0.15,
    wallMaterial: d.wallMaterial ?? 'paint/white-matte',
  }

  const walls: RWall[] = []
  const rooms: RRoom[] = []
  const objects: RObject[] = []
  const roofs: RRoof[] = []
  const slabOpenings: RSlabOpening[] = []
  const levels: RenderScene['levels'] = []

  const cap = opts.upToLevel ? scene.levels.find((l) => l.id === opts.upToLevel)?.elevation : undefined
  for (const level of scene.levels) {
    if (level.hidden || (cap !== undefined && level.elevation > cap + 1e-6)) continue
    levels.push({ id: level.id, elevation: level.elevation, height: level.height })
    for (const w of level.walls ?? []) walls.push(toWall(w, level.openings ?? [], level.id, level.elevation, level.height, base))
    for (const r of level.rooms ?? []) {
      const ceil = r.ceiling
      const drop = ceil?.dropHeight ?? 0
      rooms.push({
        id: r.id,
        name: r.name,
        type: r.type,
        polygon: r.polygon,
        material: resolveMaterial(r.floor?.material, scene.materials, d.floorMaterial ?? 'wood/natural-oak'),
        elevation: level.elevation + (r.floor?.elevation ?? 0),
        levelId: level.id,
        // o forro só é desenhado quando pedido (visible) ou rebaixado; no resto a vista de cima continua livre
        ceiling: ceil?.visible || drop > 0
          ? { height: ceil?.height ?? level.height, drop, material: resolveMaterial(ceil?.material, scene.materials, 'paint/white-matte') }
          : undefined,
      })
    }
    for (const o of level.objects ?? []) objects.push(toObject(o, level.elevation, level.height, base))
    for (const rf of level.roofs ?? []) {
      const sloped = rf.kind !== 'flat'
      roofs.push({
        id: rf.id,
        levelId: level.id,
        kind: rf.kind,
        polygon: rf.polygon,
        elevation: level.elevation + (rf.baseHeight ?? level.height),
        pitchDeg: sloped ? rf.pitchDeg ?? 30 : 0,
        ridgeDeg: rf.ridgeDeg ?? 0,
        overhang: rf.overhang ?? 0.4,
        thickness: rf.thickness ?? 0.15,
        top: resolveMaterial(rf.material, scene.materials, sloped ? 'ceramic/roof-tile' : 'concrete/exposed'),
        under: resolveMaterial(rf.ceilingMaterial, scene.materials, 'paint/white-matte'),
      })
    }
    for (const so of level.slabOpenings ?? []) {
      slabOpenings.push({ id: so.id, levelId: level.id, polygon: so.polygon, elevation: level.elevation, railing: so.railing ?? false })
    }
  }

  let site: RSite | undefined
  if (scene.site) {
    const s = scene.site
    const zones: RZone[] = (s.zones ?? []).map((z) => ({
      id: z.id,
      kind: z.kind,
      polygon: z.polygon,
      material: resolveMaterial(z.material, scene.materials, z.kind === 'grass' ? 'ground/grass' : z.kind === 'water' || z.kind === 'pool' ? 'water/pool' : 'ground/soil'),
      elevation: z.elevation ?? 0,
      depth: z.depth ?? (z.kind === 'pool' ? 1.4 : 0),
      edgeMaterial: z.edgeMaterial ? resolveMaterial(z.edgeMaterial, scene.materials) : undefined,
    }))

    // relevo: nivelado sob o térreo e as zonas; objetos e cercas do terreno acompanham a altura do chão
    let terrain: RTerrain | undefined
    if (s.terrain?.points?.length) {
      const lowest = Math.min(...scene.levels.map((l) => l.elevation))
      const flat: Point2[][] = [
        ...scene.levels.filter((l) => l.elevation === lowest).flatMap((l) => (l.rooms ?? []).map((r) => r.polygon)),
        ...zones.map((z) => z.polygon),
      ]
      const xs = [...s.terrain.points.map((p) => p[0]), ...(s.boundary ?? []).map((p) => p[0])]
      const zs = [...s.terrain.points.map((p) => p[1]), ...(s.boundary ?? []).map((p) => p[1])]
      terrain = {
        points: s.terrain.points,
        smoothing: s.terrain.smoothing ?? 0.5,
        flat,
        rect: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)],
      }
    }
    const ground = (x: number, z: number) => (terrain ? terrainHeight(terrain, x, z) : 0)
    const r3 = (n: number) => Math.round(n * 1000) / 1000

    site = {
      terrain,
      boundary: s.boundary,
      ground: resolveMaterial(s.groundMaterial, scene.materials, 'ground/grass'),
      zones,
      walls: (s.walls ?? []).map((w) =>
        toWall(w, s.openings ?? [], 'site', r3(ground((w.start[0] + w.end[0]) / 2, (w.start[1] + w.end[1]) / 2)), base.wallHeight, { ...base, wallMaterial: 'paint/exterior-white' }),
      ),
      objects: (s.objects ?? []).map((o) => toObject(o, r3(ground(o.position[0], o.position[2])), 6, base)),
    }
  }

  const e = scene.environment ?? {}
  const env: REnvironment = {
    timeOfDay: parseTime(e.timeOfDay),
    northDeg: e.northDeg ?? 0,
    sky: e.sky ?? 'clear',
    interiorLights: e.interiorLights ?? 'auto',
    exposure: e.exposure ?? 1,
  }
  return { walls, rooms, objects, roofs, slabOpenings, site, env, levels }
}
