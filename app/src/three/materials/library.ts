import type { Catalog, Material, MaterialRef } from '../../../../schema/types'
import catalogJson from '../../../../assets/catalog.json'

/** Catálogo oficial (assets/catalog.json): itens, biblioteca de materiais e climas. */
export const CATALOG = catalogJson as unknown as Catalog

export const MATERIAL_LIBRARY: Record<MaterialRef, Material> = CATALOG.materials ?? {}

/** Material já resolvido (herança `base` aplicada) com o id de origem. */
export interface MaterialSpec extends Material {
  id: MaterialRef
}

const FALLBACK: Material = { name: 'Material desconhecido', category: 'other', color: '#b9b4ab', roughness: 0.9 }
const warned = new Set<string>()

/**
 * Resolve um id de material: primeiro `scene.materials`, depois a biblioteca.
 * Segue a cadeia `base` (campos do material sobrescrevem os da base).
 */
export function resolveMaterial(
  ref: MaterialRef | undefined,
  sceneMaterials?: Record<MaterialRef, Material>,
  fallbackRef?: MaterialRef,
): MaterialSpec {
  const lookup = (id: MaterialRef): Material | undefined => sceneMaterials?.[id] ?? MATERIAL_LIBRARY[id]
  const chain = (id: MaterialRef, depth: number): Material | undefined => {
    const m = lookup(id)
    if (!m) return undefined
    if (!m.base || depth > 8 || m.base === id && !MATERIAL_LIBRARY[id]) return m
    // se o material da cena tem o mesmo id de um da biblioteca, a base é a própria biblioteca
    const parent = m.base === id ? MATERIAL_LIBRARY[id] : chain(m.base, depth + 1)
    return parent ? { ...parent, ...m, texture: m.texture ?? parent.texture } : m
  }
  if (ref) {
    const m = chain(ref, 0)
    if (m) return { ...m, id: ref }
    if (!warned.has(ref)) { warned.add(ref); console.warn(`[three] material '${ref}' não encontrado`) }
  }
  if (fallbackRef && fallbackRef !== ref) return resolveMaterial(fallbackRef, sceneMaterials)
  return { ...FALLBACK, id: ref ?? 'fallback' }
}

export const materialsByCategory = (category: Material['category']) =>
  Object.entries(MATERIAL_LIBRARY)
    .filter(([, m]) => m.category === category)
    .map(([id, m]) => ({ id, ...m }))
