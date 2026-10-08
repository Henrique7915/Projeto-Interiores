// Tipos TypeScript do formato da cena Design3D v0.1.x.
// Espelho de scene.schema.json e catalog.schema.json: ao mudar um, mude o outro.
// Unidades em metros, ângulos em graus, Y para cima. Planta usa [x, z].

export type Id = string;
/** 'categoria/nome' da biblioteca (ex.: 'wood/smoked-oak') ou id de material da cena. */
export type MaterialRef = string;
/** Ponto na planta [x, z] em metros. */
export type Point2 = [number, number];
/** Ponto [x, y, z] em metros; y é a altura. */
export type Point3 = [number, number, number];
export type Polygon = Point2[];
export type Color = `#${string}`;
export type Extensions = Record<string, unknown>;

export const SCENE_FORMAT = "design3d.scene" as const;
export const SCENE_VERSION = "0.1.0" as const;

export interface Scene {
  $schema?: string;
  format: typeof SCENE_FORMAT;
  version: string;
  id: Id;
  name: string;
  units: "m";
  createdAt?: string;
  updatedAt?: string;
  meta?: Meta;
  defaults?: Defaults;
  environment?: Environment;
  /** Materiais próprios da cena; têm prioridade sobre a biblioteca. */
  materials?: Record<MaterialRef, Material>;
  levels: Level[];
  site?: Site;
  views?: View[];
  extensions?: Extensions;
}

export interface Meta {
  description?: string;
  author?: string;
  tags?: string[];
  thumbnail?: string;
  locale?: string;
}

export interface Defaults {
  wallHeight?: number; // 2.7
  wallThickness?: number; // 0.15
  wallMaterial?: MaterialRef;
  floorMaterial?: MaterialRef;
  ceilingMaterial?: MaterialRef;
  snap?: number; // 0.05
}

export interface Environment {
  /** HH:MM, hora local para posicionar o sol. */
  timeOfDay?: string;
  date?: string;
  location?: { lat: number; lon: number; label?: string };
  /** Ângulo do norte em relação a -Z. */
  northDeg?: number;
  sky?: "clear" | "partly-cloudy" | "overcast";
  mood?: string;
  interiorLights?: "auto" | "on" | "off";
  exposure?: number;
}

export type MaterialCategory =
  | "wood" | "stone" | "ceramic" | "fabric" | "leather" | "paint" | "wallpaper" | "metal"
  | "glass" | "plastic" | "concrete" | "plant" | "ground" | "water" | "light" | "other";

export interface Texture {
  set: string;
  /** Tamanho real de uma repetição [u, v] em metros. */
  tileSize?: [number, number];
  rotationDeg?: number;
}

export interface Material {
  name: string;
  category: MaterialCategory;
  color: Color;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  emissive?: Color;
  emissiveIntensity?: number;
  texture?: Texture;
  base?: MaterialRef;
}

export interface Level {
  id: Id;
  name: string;
  elevation: number;
  /** Pé-direito padrão. */
  height: number;
  slabThickness?: number;
  walls?: Wall[];
  openings?: Opening[];
  rooms?: Room[];
  objects?: SceneObject[];
  hidden?: boolean;
  extensions?: Extensions;
}

export type WallKind = "solid" | "half" | "glass" | "railing" | "fence";

/** left/right: lados à esquerda/direita de quem anda de start para end, visto de cima.
 *  Normal do lado esquerdo = normalize([dz, -dx]) com d = end - start. */
export interface WallFinish {
  left?: MaterialRef;
  right?: MaterialRef;
  top?: MaterialRef;
  baseboard?: { height?: number; material?: MaterialRef; sides?: "left" | "right" | "both" };
}

export interface Wall {
  id: Id;
  name?: string;
  kind?: WallKind;
  start: Point2;
  end: Point2;
  /** Centrada na linha start-end. */
  thickness?: number;
  height?: number;
  heightEnd?: number;
  finish?: WallFinish;
  extensions?: Extensions;
}

export type OpeningKind =
  | "door" | "double-door" | "sliding-door" | "garage-door"
  | "window" | "sliding-window" | "fixed-window" | "passage";

export interface Opening {
  id: Id;
  wallId: Id;
  kind: OpeningKind;
  /** Distância do start da parede até o CENTRO da abertura. */
  offset: number;
  width: number;
  height: number;
  sill?: number;
  hinge?: "start" | "end";
  opensTo?: "left" | "right";
  catalogId?: string;
  materials?: MaterialSlots;
  extensions?: Extensions;
}

export type RoomType =
  | "living" | "dining" | "kitchen" | "bedroom" | "bathroom" | "office" | "laundry"
  | "hall" | "garage" | "balcony" | "storage" | "studio" | "other";

export interface Room {
  id: Id;
  name: string;
  type?: RoomType;
  polygon: Polygon;
  floor?: { material?: MaterialRef; elevation?: number };
  ceiling?: { height?: number; material?: MaterialRef; visible?: boolean };
  extensions?: Extensions;
}

export type MaterialSlots = Record<string, MaterialRef>;

export interface Light {
  type: "point" | "spot" | "area";
  intensity?: number;
  temperatureK?: number;
  color?: Color;
  on?: boolean;
  castShadow?: boolean;
}

/** Caixa envolvente real: largura (x local), altura (y), profundidade (z local). */
export interface Dimensions {
  width: number;
  height: number;
  depth: number;
}

export type Mount = "floor" | "wall" | "ceiling" | "surface";

export interface SceneObject {
  id: Id;
  name?: string;
  catalogId: string;
  /** Centro da base, relativo ao piso do andar (ou ao terreno em site.objects). */
  position: Point3;
  /** Rotação em Y, anti-horária vista de cima. Frente do modelo = +Z quando 0. */
  rotationDeg?: number;
  dimensions?: Dimensions;
  mirror?: boolean;
  materials?: MaterialSlots;
  mount?: Mount;
  wallId?: Id;
  parentId?: Id;
  roomId?: Id;
  light?: Light;
  locked?: boolean;
  hidden?: boolean;
  tags?: string[];
  extensions?: Extensions;
}

export type GroundZoneKind =
  | "grass" | "paving" | "deck" | "gravel" | "soil" | "water" | "pool" | "garden-bed" | "sand" | "other";

export interface GroundZone {
  id: Id;
  name?: string;
  kind: GroundZoneKind;
  polygon: Polygon;
  material?: MaterialRef;
  elevation?: number;
  depth?: number;
  edgeMaterial?: MaterialRef;
  extensions?: Extensions;
}

export interface Site {
  boundary?: Polygon;
  groundMaterial?: MaterialRef;
  zones?: GroundZone[];
  walls?: Wall[];
  openings?: Opening[];
  objects?: SceneObject[];
  extensions?: Extensions;
}

export interface View {
  id: Id;
  name: string;
  mode?: "orbit" | "top" | "walk";
  position: Point3;
  target: Point3;
  fovDeg?: number;
}

// ---- Catálogo (assets/catalog.json) ----

export type I18n = string | Record<string, string>;

export type CatalogCategory =
  | "sofa" | "chair" | "table" | "bed" | "storage" | "shelf" | "desk" | "lighting" | "decor"
  | "rug" | "plant" | "kitchen" | "bathroom" | "appliance" | "electronics" | "textile"
  | "door" | "window" | "stairs" | "outdoor" | "structure" | "other";

export interface CatalogItem {
  id: string;
  name: I18n;
  category: CatalogCategory;
  tags?: string[];
  /** GLB relativo a assets/. Origem no centro da base, frente +Z, 1 unidade = 1 m. */
  model: string;
  thumbnail?: string;
  dimensions: Dimensions;
  resizable?: Partial<Record<keyof Dimensions, [number, number]>>;
  mount?: Mount;
  materialSlots?: Record<string, { label?: I18n; default: MaterialRef; allowed?: MaterialCategory[] }>;
  light?: Light;
  license?: string;
  source?: string;
}

export interface Catalog {
  $schema?: string;
  format: "design3d.catalog";
  version: string;
  items: CatalogItem[];
  materials?: Record<MaterialRef, Material>;
  moods?: { id: string; name: I18n; timeOfDay?: string; exposure?: number; palette?: MaterialRef[] }[];
}
