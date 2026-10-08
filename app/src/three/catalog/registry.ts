import type { CatalogItem } from '../../../../schema/types'
import { CATALOG } from '../materials/library'

const byId = new Map<string, CatalogItem>(CATALOG.items.map((i) => [i.id, i]))

export const getCatalogItem = (id: string): CatalogItem | undefined => byId.get(id)
export const catalogItems = (): CatalogItem[] => CATALOG.items
export const catalogMoods = () => CATALOG.moods ?? []
