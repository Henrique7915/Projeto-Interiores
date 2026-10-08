// API pública do motor 3D. O App importa só daqui.
export { SceneView } from './SceneView'
export type { SceneViewHandle, SceneViewProps, ViewPreset, Quality } from './SceneView'
export type { ScenePick, ObjectPatch } from './render/types'
export type { Cutaway } from './Architecture'
export type { TimePreset } from './lighting/daylight'
export { TIME_PRESETS, formatTime } from './lighting/daylight'
export { CATALOG, MATERIAL_LIBRARY, materialsByCategory, resolveMaterial } from './materials/library'
export { catalogItems, catalogMoods, getCatalogItem } from './catalog/registry'
