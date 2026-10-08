import type { CatalogItem, Light, Mount, OpeningKind, Point2, Point3, RoomType, WallKind } from '../../../../schema/types'
import type { MaterialSpec } from '../materials/library'

/**
 * Cena já "mastigada" para o desenho: ids de material resolvidos, medidas e catálogo aplicados.
 * Quem produz isto é `adapter/toRender.ts` (a partir do `Scene` do schema); o resto do motor só lê estes tipos.
 */

export interface ROpening {
  id: string
  kind: OpeningKind
  offset: number
  width: number
  height: number
  sill: number
  hinge: 'start' | 'end'
  opensTo: 'left' | 'right'
  frame: MaterialSpec
  leaf: MaterialSpec
  glass: MaterialSpec
}

export interface RWall {
  id: string
  kind: WallKind
  a: Point2
  b: Point2
  thickness: number
  height: number
  heightEnd: number
  elevation: number
  /** material da face à esquerda de quem anda de a para b (visto de cima) */
  left: MaterialSpec
  right: MaterialSpec
  top: MaterialSpec
  baseboard?: { height: number; material: MaterialSpec; sides: 'left' | 'right' | 'both' }
  openings: ROpening[]
}

export interface RRoom {
  id: string
  name: string
  type?: RoomType
  polygon: Point2[]
  material: MaterialSpec
  elevation: number
}

export interface RLight {
  on: boolean
  type: Light['type']
  lumens: number
  temperatureK: number
  color?: string
  castShadow: boolean
}

export interface RObject {
  id: string
  name?: string
  catalogId: string
  item: CatalogItem | undefined
  /** nome do desenhista procedural ou caminho do GLB (de `item.model`) */
  model: string
  /** posição no mundo (já somada à elevação do andar) */
  position: Point3
  /** elevação do andar/terreno onde o objeto está; scene.position[1] = position[1] - elevation */
  elevation: number
  rotationY: number
  size: Point3
  mirror: boolean
  mount: Mount
  materials: Record<string, MaterialSpec>
  light?: RLight
  locked: boolean
  hidden: boolean
  /** distância da base até o forro (cabos de pendentes) */
  clearance: number
}

export interface RZone {
  id: string
  kind: string
  polygon: Point2[]
  material: MaterialSpec
  elevation: number
  depth: number
  edgeMaterial?: MaterialSpec
}

export interface RSite {
  boundary?: Point2[]
  ground: MaterialSpec
  zones: RZone[]
  walls: RWall[]
  objects: RObject[]
}

export interface REnvironment {
  /** hora decimal 0..24 vinda de scene.environment.timeOfDay */
  timeOfDay: number
  northDeg: number
  sky: 'clear' | 'partly-cloudy' | 'overcast'
  interiorLights: 'auto' | 'on' | 'off'
  exposure: number
}

export interface RenderScene {
  walls: RWall[]
  rooms: RRoom[]
  objects: RObject[]
  site?: RSite
  env: REnvironment
  /** altura de cada andar, para câmera e recorte */
  levels: { id: string; elevation: number; height: number }[]
}

/** Seleção e picks usam ids do schema. */
export type ScenePick =
  | { type: 'object'; id: string }
  | { type: 'wall'; id: string; side: 'left' | 'right' }
  | { type: 'room'; id: string }
  | { type: 'opening'; id: string }
  | { type: 'zone'; id: string }

export interface ObjectPatch {
  position?: Point3
  rotationDeg?: number
}
