import { useSyncExternalStore } from 'react'
import { catalogVersion, subscribeCatalog } from '../core'

/** Re-renderiza quando o catálogo oficial (assets/catalog.json) termina de carregar. */
export const useCatalogVersion = () => useSyncExternalStore(subscribeCatalog, catalogVersion)

const MOBILE = '(max-width: 860px)'
const subMobile = (cb: () => void) => {
  const m = window.matchMedia(MOBILE)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
/** Tela estreita (celular): painéis viram gavetas e o 3D ocupa a tela toda. */
export const useIsMobile = () => useSyncExternalStore(subMobile, () => window.matchMedia(MOBILE).matches, () => false)
