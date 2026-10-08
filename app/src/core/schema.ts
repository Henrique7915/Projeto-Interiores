/**
 * Tipos canônicos da cena = schema oficial mantido pela frente de Arquitetura (design3d/schema/types.ts).
 * Este arquivo só reexporta e adiciona tipos auxiliares do editor. Não duplique tipos do schema aqui.
 */
import type { Level, Site, Point2 } from '../../../schema/types'

export type {
  Scene,
  Level,
  Site,
  Wall,
  WallKind,
  WallFinish,
  Opening,
  OpeningKind,
  Room,
  RoomType,
  SceneObject,
  GroundZone,
  GroundZoneKind,
  Material,
  MaterialCategory,
  MaterialRef,
  Point2,
  Point3,
  Dimensions,
  Environment,
  Catalog,
  CatalogItem,
  CatalogCategory,
  View,
  Defaults,
  Roof,
  SlabOpening,
  Group,
  Annotation,
  OpeningTreatment,
} from '../../../schema/types'

export const SCENE_FORMAT = 'design3d.scene' as const
export const SCENE_VERSION = '0.2.0'

/** Level ou Site: os dois guardam walls/openings/objects. */
export type Container = Level | Site
export type ContainerKey = 'site' | string

/** Referência a algo selecionável na UI (e nos eventos do 3D). */
export type Selection =
  | { kind: 'room'; id: string }
  | { kind: 'wall'; id: string; side?: 'left' | 'right' }
  | { kind: 'opening'; id: string }
  | { kind: 'object'; id: string }
  | { kind: 'zone'; id: string }
  | { kind: 'roof'; id: string }
  | { kind: 'slab'; id: string }
  | { kind: 'annotation'; id: string }
  | { kind: 'site' }
  | null

export type Vec2 = Point2
