// Biblioteca de materiais do Design3D (fonte do bloco "materials" de assets/catalog.json).
// Formato compacto: [id, nome, categoria, cor, rugosidade, { texture:[set, tile], metalness, opacity, emissive... }]
// O `set` de textura é resolvido pelo motor 3D (app/src/three/materials/textureSets.ts):
// por enquanto procedural; quando existir assets/textures/<set>/ com PBR (CC0), ele passa a ter prioridade.
const M = [
  // Madeira
  ['wood/smoked-oak', 'Carvalho defumado', 'wood', '#4a3426', 0.5, { texture: ['planks-oak', 1.6] }],
  ['wood/natural-oak', 'Carvalho natural', 'wood', '#c79a6a', 0.55, { texture: ['planks-oak', 1.6] }],
  ['wood/light-ash', 'Freijó claro', 'wood', '#dcc7a2', 0.55, { texture: ['planks-oak', 1.6] }],
  ['wood/walnut', 'Nogueira', 'wood', '#6a4430', 0.5, { texture: ['wood-grain', 1.2] }],
  ['wood/cherry', 'Cerejeira', 'wood', '#8c4a2c', 0.5, { texture: ['wood-grain', 1.2] }],
  ['wood/ebony', 'Ébano', 'wood', '#2a221d', 0.45, { texture: ['wood-grain', 1.2] }],
  ['wood/pine', 'Pinus', 'wood', '#d9b47c', 0.6, { texture: ['wood-grain', 1.2] }],
  ['wood/ash', 'Cinza (freixo)', 'wood', '#cdb994', 0.55, { texture: ['wood-grain', 1.2] }],
  ['wood/deck-cumaru', 'Deck de cumaru', 'wood', '#8a5a36', 0.7, { texture: ['deck-boards', 1.2] }],
  // Pedra, concreto, cerâmica
  ['stone/carrara', 'Mármore Carrara', 'stone', '#ecebe8', 0.18, { texture: ['marble', 2.4] }],
  ['stone/slate', 'Ardósia', 'stone', '#3f444b', 0.65, { texture: ['stone-rough', 1.2] }],
  ['stone/travertine', 'Travertino', 'stone', '#dccaa8', 0.5, { texture: ['stone-rough', 1.5] }],
  ['stone/terrazzo', 'Terrazo', 'stone', '#dcd5c8', 0.35, { texture: ['terrazzo', 1.2] }],
  ['stone/marble-carrara', 'Mármore Carrara polido', 'stone', '#efeeeb', 0.12, { texture: ['marble', 2.4] }],
  ['stone/granite-grey', 'Granito cinza', 'stone', '#6f7279', 0.3, { texture: ['granite', 0.8] }],
  ['concrete/exposed', 'Concreto aparente', 'concrete', '#a6a5a1', 0.85, { texture: ['concrete-fine', 1.5] }],
  ['concrete/polished', 'Concreto polido', 'concrete', '#8d8d8a', 0.5, { texture: ['concrete-fine', 2] }],
  ['ceramic/white-tile', 'Azulejo branco', 'ceramic', '#f1f1ee', 0.2, { texture: ['tile-grid', 0.3] }],
  ['ceramic/porcelain-white', 'Porcelana branca', 'ceramic', '#f7f7f5', 0.1],
  ['ceramic/terracotta', 'Cerâmica terracota', 'ceramic', '#b8683f', 0.7, { texture: ['tile-grid', 0.3] }],
  ['ceramic/green-tile', 'Azulejo verde', 'ceramic', '#5f8a6e', 0.2, { texture: ['tile-grid', 0.15] }],
  // Tecido e couro
  ['fabric/linen', 'Linho', 'fabric', '#e9e3d6', 0.95, { texture: ['weave', 0.5] }],
  ['fabric/boucle', 'Bouclé', 'fabric', '#efebe2', 1, { texture: ['boucle', 0.5] }],
  ['fabric/grey-wool', 'Lã cinza', 'fabric', '#8f9296', 0.95, { texture: ['weave', 0.5] }],
  ['fabric/oat-knit', 'Tricô aveia', 'fabric', '#d8ccb4', 1, { texture: ['knit', 0.6] }],
  ['fabric/navy-velvet', 'Veludo azul-marinho', 'fabric', '#22346c', 0.7, { texture: ['velvet', 0.5] }],
  ['fabric/ochre-velvet', 'Veludo ocre', 'fabric', '#d4a02c', 0.7, { texture: ['velvet', 0.5] }],
  ['fabric/rust-wool', 'Lã ferrugem', 'fabric', '#c4602e', 1, { texture: ['weave', 0.5] }],
  ['fabric/charcoal-felt', 'Feltro grafite', 'fabric', '#33353a', 1, { texture: ['felt', 0.5] }],
  ['fabric/sage-linen', 'Linho sálvia', 'fabric', '#a5ad8f', 0.95, { texture: ['weave', 0.5] }],
  ['leather/cognac', 'Couro conhaque', 'leather', '#a85a22', 0.5, { texture: ['leather', 0.6] }],
  ['leather/black', 'Couro preto', 'leather', '#1f1f21', 0.45, { texture: ['leather', 0.6] }],
  ['leather/tan', 'Couro caramelo', 'leather', '#c18a52', 0.5, { texture: ['leather', 0.6] }],
  // Tintas
  ['paint/sand-limewash', 'Cal areia', 'paint', '#e7d6b8', 0.9, { texture: ['limewash', 2] }],
  ['paint/white-matte', 'Branco fosco', 'paint', '#f2efe8', 0.9, { texture: ['paint-flat', 2] }],
  ['paint/exterior-white', 'Branco de fachada', 'paint', '#f4f2ec', 0.95, { texture: ['paint-flat', 2] }],
  ['paint/warm-grey', 'Cinza quente', 'paint', '#b9b2a8', 0.9, { texture: ['paint-flat', 2] }],
  ['paint/mustard', 'Mostarda', 'paint', '#d1a22e', 0.9, { texture: ['paint-flat', 2] }],
  ['paint/ink-blue', 'Azul-tinta', 'paint', '#243b63', 0.85, { texture: ['paint-flat', 2] }],
  ['paint/sage', 'Verde sálvia', 'paint', '#a3b093', 0.9, { texture: ['paint-flat', 2] }],
  ['paint/terracotta', 'Terracota', 'paint', '#b9603f', 0.9, { texture: ['limewash', 2] }],
  ['paint/rust', 'Ferrugem', 'paint', '#b4532a', 0.85, { texture: ['paint-flat', 2] }],
  ['paint/navy', 'Azul-noite', 'paint', '#1d2a4d', 0.85, { texture: ['paint-flat', 2] }],
  ['paint/charcoal', 'Grafite', 'paint', '#35373b', 0.85, { texture: ['paint-flat', 2] }],
  ['paint/blush', 'Rosa antigo', 'paint', '#d9b0a4', 0.9, { texture: ['paint-flat', 2] }],
  ['wallpaper/linen-beige', 'Papel linho bege', 'wallpaper', '#d9cdb5', 0.9, { texture: ['weave', 0.6] }],
  // Metal, vidro, plástico
  ['metal/black-matte', 'Metal preto fosco', 'metal', '#1c1d20', 0.45, { metalness: 0.8 }],
  ['metal/brushed-steel', 'Aço escovado', 'metal', '#b9bcc0', 0.4, { metalness: 0.6 }],
  ['metal/brass', 'Latão', 'metal', '#c9a14a', 0.3, { metalness: 0.9 }],
  ['metal/chrome', 'Cromado', 'metal', '#d9dde2', 0.12, { metalness: 1 }],
  ['glass/clear', 'Vidro incolor', 'glass', '#cfe3f2', 0.05, { opacity: 0.2 }],
  ['glass/frosted', 'Vidro fosco', 'glass', '#e3edf3', 0.5, { opacity: 0.5 }],
  ['plastic/white', 'Plástico branco', 'plastic', '#f5f5f3', 0.4],
  // Natureza e exterior
  ['plant/leaf', 'Folhagem', 'plant', '#3f7a3c', 0.8],
  ['plant/leaf-light', 'Folhagem clara', 'plant', '#5f9a4c', 0.8],
  ['plant/bark', 'Tronco', 'plant', '#5a4332', 0.9],
  ['ground/grass', 'Grama', 'ground', '#5a8f3e', 1, { texture: ['grass', 2] }],
  ['ground/soil', 'Terra', 'ground', '#4a3526', 1, { texture: ['soil', 1.5] }],
  ['ground/gravel', 'Brita', 'ground', '#a29d94', 1, { texture: ['gravel', 1] }],
  ['ground/asphalt', 'Asfalto', 'ground', '#47484b', 1, { texture: ['asphalt', 1] }],
  ['ground/sand', 'Areia', 'ground', '#dcc79b', 1, { texture: ['soil', 1.5] }],
  ['water/pool', 'Água de piscina', 'water', '#3fb6c9', 0.04, { opacity: 0.82 }],
  // Luz
  ['light/lampshade', 'Cúpula de luz', 'light', '#f4e3c0', 0.9, { emissive: '#ffcf85', emissiveIntensity: 0 }],
]

export const materials = Object.fromEntries(
  M.map(([id, name, category, color, roughness, extra = {}]) => {
    const m = { name, category, color, roughness }
    if (extra.metalness !== undefined) m.metalness = extra.metalness
    if (extra.opacity !== undefined) m.opacity = extra.opacity
    if (extra.emissive) { m.emissive = extra.emissive; m.emissiveIntensity = extra.emissiveIntensity ?? 0 }
    if (extra.texture) m.texture = { set: extra.texture[0], tileSize: [extra.texture[1], extra.texture[1]] }
    return [id, m]
  }),
)
