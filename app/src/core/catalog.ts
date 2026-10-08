import { FALLBACK_CATALOG } from './fallbackCatalog'
import type { Catalog, CatalogItem, Material, Scene } from './schema'

/**
 * Registro do catálogo em uso (itens + biblioteca de materiais). Começa com o catálogo embutido;
 * `loadCatalog()` troca pelo oficial (/assets/catalog.json, /assets/materials.json) quando existir.
 */
let current: Catalog = FALLBACK_CATALOG
let byId = indexItems(current)
let version = 0
const listeners = new Set<() => void>()

function indexItems(c: Catalog) {
  return new Map(c.items.map((i) => [i.id, i]))
}

export function setCatalog(c: Catalog) {
  current = { ...c, materials: { ...FALLBACK_CATALOG.materials, ...(c.materials ?? {}) } }
  byId = indexItems(current)
  version++
  listeners.forEach((l) => l())
}
export const getCatalog = () => current
export const catalogVersion = () => version
export const subscribeCatalog = (l: () => void) => (listeners.add(l), () => listeners.delete(l))
export const getCatalogItem = (id: string): CatalogItem | undefined => byId.get(id)
export const nameOf = (n: CatalogItem['name'], locale = 'pt-BR') => (typeof n === 'string' ? n : (n[locale] ?? n['pt'] ?? n['en'] ?? Object.values(n)[0]))

const UNKNOWN: Material = { name: 'Material desconhecido', category: 'other', color: '#c0c0c0', roughness: 0.8 }

/** Resolve um MaterialRef: materiais da própria cena primeiro, depois a biblioteca. */
export function resolveMaterial(ref: string | undefined, scene?: Pick<Scene, 'materials'>): Material {
  if (!ref) return UNKNOWN
  return scene?.materials?.[ref] ?? current.materials?.[ref] ?? UNKNOWN
}
export const hasMaterial = (ref: string, scene?: Pick<Scene, 'materials'>) => !!(scene?.materials?.[ref] ?? current.materials?.[ref])

export function listMaterials(scene?: Pick<Scene, 'materials'>) {
  const all = { ...(current.materials ?? {}), ...(scene?.materials ?? {}) }
  return Object.entries(all).map(([ref, m]) => ({ ref, ...m }))
}

/** Busca itens do catálogo por texto (id, nome, categoria, tags). */
export function searchCatalog(query = '', category?: string, limit = 40) {
  const q = query.trim().toLowerCase()
  return current.items
    .filter((i) => (!category || i.category === category) && (!q || [i.id, nameOf(i.name), i.category, ...(i.tags ?? [])].join(' ').toLowerCase().includes(q)))
    .slice(0, limit)
}

/** Tenta carregar o catálogo oficial publicado em `${base}catalog.json` e `${base}materials.json`. Silencioso se não existir. */
export async function loadCatalog(base = './assets/'): Promise<boolean> {
  try {
    const [c, m] = await Promise.all([fetch(base + 'catalog.json'), fetch(base + 'materials.json').catch(() => undefined)])
    if (!c.ok) return false
    const cat = (await c.json()) as Catalog
    if (cat?.format !== 'design3d.catalog' || !Array.isArray(cat.items)) return false
    if (m?.ok) {
      try {
        const mj = await m.json()
        cat.materials = { ...(mj.materials ?? mj), ...(cat.materials ?? {}) }
      } catch {
        /* materials.json opcional */
      }
    }
    setCatalog(cat)
    return true
  } catch {
    return false
  }
}

export const MATERIAL_GROUPS: { id: string; label: string; categories: Material['category'][] }[] = [
  { id: 'wood', label: 'Madeira', categories: ['wood'] },
  { id: 'stone', label: 'Pedra', categories: ['stone', 'ceramic', 'concrete'] },
  { id: 'fabric', label: 'Tecido', categories: ['fabric', 'leather'] },
  { id: 'paint', label: 'Tinta', categories: ['paint', 'wallpaper'] },
  { id: 'other', label: 'Outros', categories: ['metal', 'glass', 'plastic', 'ground', 'water', 'plant', 'light', 'other'] },
]

export const CATEGORY_LABEL: Record<string, string> = {
  sofa: 'Sofás',
  chair: 'Cadeiras',
  table: 'Mesas',
  bed: 'Camas',
  storage: 'Armazenamento',
  shelf: 'Estantes',
  desk: 'Escrivaninhas',
  lighting: 'Iluminação',
  decor: 'Decoração',
  rug: 'Tapetes',
  plant: 'Plantas',
  kitchen: 'Cozinha',
  bathroom: 'Banheiro',
  appliance: 'Eletros',
  electronics: 'Eletrônicos',
  textile: 'Têxteis',
  door: 'Portas',
  window: 'Janelas',
  stairs: 'Escadas',
  outdoor: 'Exterior',
  structure: 'Estruturas',
  other: 'Outros',
}
