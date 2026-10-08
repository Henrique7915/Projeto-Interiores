import { useSyncExternalStore } from 'react'
import { catalogVersion, subscribeCatalog } from '../core'

/** Re-renderiza quando o catálogo oficial (assets/catalog.json) termina de carregar. */
export const useCatalogVersion = () => useSyncExternalStore(subscribeCatalog, catalogVersion)
