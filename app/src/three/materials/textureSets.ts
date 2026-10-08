import type { TextureKind } from './procedural'

/**
 * Conjuntos de textura referenciados por `material.texture.set` no schema.
 * Hoje são todos procedurais (gerados em canvas, sem arquivo). Quando existir
 * assets/textures/<set>/ com mapas PBR (CC0), o carregador usa os arquivos no lugar.
 */
export interface TextureSetDef {
  kind: TextureKind
  /** cor secundária fixa (veios, juntas). Sem ela, usa um tom mais claro da cor do material. */
  color2?: string
}

export const TEXTURE_SETS: Record<string, TextureSetDef> = {
  'planks-oak': { kind: 'planks' },
  'deck-boards': { kind: 'deck' },
  'wood-grain': { kind: 'wood' },
  'wood-slats': { kind: 'wood' },
  marble: { kind: 'marble', color2: '#8d8f93' },
  'stone-rough': { kind: 'concrete' },
  terrazzo: { kind: 'speckle', color2: '#8c5a47' },
  'concrete-fine': { kind: 'concrete' },
  'tile-grid': { kind: 'tile', color2: '#9a9a96' },
  weave: { kind: 'weave' },
  boucle: { kind: 'boucle', color2: '#ffffff' },
  knit: { kind: 'knit' },
  velvet: { kind: 'velvet' },
  felt: { kind: 'felt' },
  leather: { kind: 'leather' },
  'paint-flat': { kind: 'paint' },
  limewash: { kind: 'limewash' },
  grass: { kind: 'grass', color2: '#7fb04e' },
  soil: { kind: 'soil' },
  gravel: { kind: 'gravel', color2: '#cfcac0' },
}
