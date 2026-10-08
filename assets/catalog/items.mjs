// Itens do catálogo (bloco "items" de assets/catalog.json).
// `model: "procedural/<nome>"` = móvel gerado por código em app/src/three/furniture (sem arquivo).
// `model: "models/<arquivo>.glb"` = modelo glTF em assets/models (Blender). Ambos têm frente em +Z, origem no centro da base.
const L = (pt, en) => ({ 'pt-BR': pt, en })
const slot = (label, def, allowed) => ({ label, default: def, ...(allowed ? { allowed } : {}) })
const LICENSE = 'Próprio (gerado por código neste repositório)'
const SOFT = ['fabric', 'leather']
const HARD = ['wood', 'metal', 'stone', 'paint', 'plastic']
const CERAMIC = ['ceramic', 'paint', 'stone']
const SURFACE = ['stone', 'wood', 'ceramic', 'concrete', 'paint', 'metal']
const METAL = ['metal']
const GLASS = ['glass']

export const items = [
  // Sofás e poltronas
  { id: 'sofa/modern-l', name: L('Sofá em L moderno', 'Modern L sofa'), category: 'sofa', model: 'procedural/sofa-l', dimensions: { width: 2.6, height: 0.85, depth: 1.6 }, resizable: { width: [1.8, 3.6], depth: [1.2, 2], height: [0.7, 1] },
    materialSlots: { upholstery: slot('Estofado', 'fabric/navy-velvet', SOFT), cushions: slot('Almofadas', 'fabric/rust-wool', SOFT), legs: slot('Pés', 'wood/walnut', HARD) }, tags: ['sala', 'estar'] },
  { id: 'sofa/modern-3-seat', name: L('Sofá de 3 lugares', 'Modern 3-seat sofa'), category: 'sofa', model: 'procedural/sofa-3', dimensions: { width: 2.2, height: 0.85, depth: 0.95 }, resizable: { width: [1.6, 3], depth: [0.8, 1.1], height: [0.7, 1] },
    materialSlots: { upholstery: slot('Estofado', 'fabric/grey-wool', SOFT), cushions: slot('Almofadas', 'fabric/ochre-velvet', SOFT), legs: slot('Pés', 'wood/walnut', HARD) }, tags: ['sala', 'estar'] },
  { id: 'chair/armchair-lounge', name: L('Poltrona lounge', 'Lounge armchair'), category: 'chair', model: 'procedural/armchair', dimensions: { width: 0.85, height: 0.85, depth: 0.85 }, resizable: { width: [0.65, 1.1], depth: [0.65, 1.1], height: [0.7, 1] },
    materialSlots: { upholstery: slot('Estofado', 'leather/cognac', SOFT), frame: slot('Estrutura', 'wood/walnut', HARD) }, tags: ['sala', 'leitura'] },
  // Mesas e cadeiras
  { id: 'table/dining-rect', name: L('Mesa de jantar retangular', 'Rectangular dining table'), category: 'table', model: 'procedural/table-dining', dimensions: { width: 1.6, height: 0.75, depth: 0.9 }, resizable: { width: [1, 3], depth: [0.7, 1.2] },
    materialSlots: { top: slot('Tampo', 'wood/walnut', ['wood', 'stone', 'ceramic', 'paint']), legs: slot('Pés', 'wood/walnut', HARD) }, tags: ['jantar'] },
  { id: 'table/coffee-round', name: L('Mesa de centro redonda', 'Round coffee table'), category: 'table', model: 'procedural/table-coffee-round', dimensions: { width: 0.8, height: 0.4, depth: 0.8 }, resizable: { width: [0.5, 1.2], depth: [0.5, 1.2], height: [0.3, 0.5] },
    materialSlots: { top: slot('Tampo', 'wood/walnut', ['wood', 'stone', 'ceramic', 'paint']) }, tags: ['sala'] },
  { id: 'chair/dining-wood', name: L('Cadeira de jantar de madeira', 'Wooden dining chair'), category: 'chair', model: 'procedural/chair-dining', dimensions: { width: 0.46, height: 0.86, depth: 0.5 },
    materialSlots: { frame: slot('Estrutura', 'wood/walnut', HARD), seat: slot('Assento', 'fabric/rust-wool', SOFT.concat(['wood'])) }, tags: ['jantar'] },
  { id: 'chair/office', name: L('Cadeira de escritório', 'Office chair'), category: 'chair', model: 'procedural/chair-office', dimensions: { width: 0.6, height: 0.95, depth: 0.6 },
    materialSlots: { seat: slot('Estofado', 'fabric/charcoal-felt', SOFT), frame: slot('Estrutura', 'metal/black-matte', HARD) }, tags: ['escritório'] },
  { id: 'desk/simple', name: L('Escrivaninha simples', 'Simple desk'), category: 'desk', model: 'procedural/desk', dimensions: { width: 1.2, height: 0.75, depth: 0.6 }, resizable: { width: [0.8, 2], depth: [0.5, 0.9] },
    materialSlots: { top: slot('Tampo', 'wood/natural-oak', ['wood', 'stone', 'paint']), legs: slot('Pés', 'metal/black-matte', HARD) }, tags: ['escritório'] },
  // Armazenamento
  { id: 'bed/queen-modern', name: L('Cama de casal moderna', 'Modern queen bed'), category: 'bed', model: 'procedural/bed-queen', dimensions: { width: 1.6, height: 1, depth: 2.1 }, resizable: { width: [0.9, 2.1], depth: [1.9, 2.2] },
    materialSlots: { bedding: slot('Roupa de cama', 'fabric/linen', SOFT), accent: slot('Manta', 'fabric/rust-wool', SOFT), frame: slot('Estrutura e cabeceira', 'wood/walnut', ['wood', 'fabric', 'leather', 'paint']) }, tags: ['quarto'] },
  { id: 'storage/nightstand', name: L('Criado-mudo', 'Nightstand'), category: 'storage', model: 'procedural/nightstand', dimensions: { width: 0.45, height: 0.5, depth: 0.4 },
    materialSlots: { body: slot('Corpo', 'wood/walnut', ['wood', 'paint']) }, tags: ['quarto'] },
  { id: 'storage/wardrobe-2-door', name: L('Guarda-roupa de 2 portas', '2-door wardrobe'), category: 'storage', model: 'procedural/wardrobe', dimensions: { width: 1.2, height: 2.2, depth: 0.6 }, resizable: { width: [0.8, 3], height: [1.8, 2.6] },
    materialSlots: { body: slot('Corpo', 'paint/white-matte', ['wood', 'paint']), doors: slot('Portas', 'paint/terracotta', ['wood', 'paint', 'fabric']) }, tags: ['quarto'] },
  { id: 'storage/tv-unit', name: L('Rack de TV', 'TV unit'), category: 'storage', model: 'procedural/tv-unit', dimensions: { width: 1.6, height: 0.5, depth: 0.4 }, resizable: { width: [1, 2.4] },
    materialSlots: { body: slot('Corpo', 'wood/walnut', ['wood', 'paint']) }, tags: ['sala'] },
  { id: 'shelf/bookcase-tall', name: L('Estante alta', 'Tall bookcase'), category: 'shelf', model: 'procedural/bookcase', dimensions: { width: 0.9, height: 1.9, depth: 0.35 }, resizable: { width: [0.5, 2], height: [1, 2.4] },
    materialSlots: { body: slot('Corpo', 'wood/walnut', ['wood', 'paint']) }, tags: ['sala', 'livros'] },
  { id: 'shelf/wall-floating', name: L('Prateleiras flutuantes', 'Floating shelves'), category: 'shelf', model: 'procedural/wall-shelf', dimensions: { width: 1.0, height: 0.6, depth: 0.22 }, mount: 'wall', resizable: { width: [0.4, 2] },
    materialSlots: { body: slot('Madeira', 'wood/walnut', ['wood', 'paint']) }, tags: ['decoração'] },
  // Iluminação
  { id: 'lighting/table-lamp', name: L('Abajur de mesa', 'Table lamp'), category: 'lighting', model: 'procedural/lamp-table', dimensions: { width: 0.3, height: 0.5, depth: 0.3 }, mount: 'surface', light: { type: 'point', intensity: 300, temperatureK: 2700, on: true },
    materialSlots: { base: slot('Base', 'metal/brass', ['metal', 'wood']), shade: slot('Cúpula', 'light/lampshade', ['light']) } },
  { id: 'lighting/floor-arc', name: L('Luminária de piso em arco', 'Arc floor lamp'), category: 'lighting', model: 'procedural/lamp-floor-arc', dimensions: { width: 0.9, height: 1.9, depth: 0.35 }, light: { type: 'point', intensity: 800, temperatureK: 2700, on: true },
    materialSlots: { base: slot('Estrutura', 'metal/black-matte', ['metal']), shade: slot('Cúpula', 'light/lampshade', ['light']) } },
  { id: 'lighting/floor-lamp', name: L('Luminária de piso', 'Floor lamp'), category: 'lighting', model: 'procedural/lamp-floor', dimensions: { width: 0.35, height: 1.6, depth: 0.35 }, light: { type: 'point', intensity: 800, temperatureK: 2700, on: true },
    materialSlots: { base: slot('Estrutura', 'metal/brass', ['metal']), shade: slot('Cúpula', 'light/lampshade', ['light']) } },
  { id: 'lighting/pendant-dome', name: L('Pendente cúpula', 'Dome pendant'), category: 'lighting', model: 'procedural/pendant-dome', dimensions: { width: 0.5, height: 0.9, depth: 0.5 }, mount: 'ceiling', light: { type: 'point', intensity: 600, temperatureK: 2700, on: true },
    materialSlots: { shade: slot('Cúpula', 'metal/black-matte', ['metal', 'paint', 'light']) } },
  { id: 'lighting/desk-lamp', name: L('Luminária de mesa articulada', 'Desk lamp'), category: 'lighting', model: 'procedural/lamp-desk', dimensions: { width: 0.35, height: 0.45, depth: 0.2 }, mount: 'surface', light: { type: 'spot', intensity: 400, temperatureK: 4000, on: true },
    materialSlots: { base: slot('Estrutura', 'metal/black-matte', ['metal']) } },
  // Tapetes e plantas
  { id: 'rug/rectangular', name: L('Tapete retangular', 'Rectangular rug'), category: 'rug', model: 'procedural/rug-rect', dimensions: { width: 2.4, height: 0.015, depth: 1.7 }, resizable: { width: [0.6, 5], depth: [0.6, 5] },
    materialSlots: { fabric: slot('Tecido', 'fabric/oat-knit', SOFT) }, tags: ['sala', 'quarto'] },
  { id: 'rug/round', name: L('Tapete redondo', 'Round rug'), category: 'rug', model: 'procedural/rug-round', dimensions: { width: 1.8, height: 0.015, depth: 1.8 }, resizable: { width: [0.6, 4], depth: [0.6, 4] },
    materialSlots: { fabric: slot('Tecido', 'fabric/boucle', SOFT) } },
  { id: 'plant/monstera-large', name: L('Costela-de-adão grande', 'Large monstera'), category: 'plant', model: 'procedural/plant-monstera', dimensions: { width: 0.7, height: 1.4, depth: 0.7 }, resizable: { height: [0.5, 2.2] },
    materialSlots: { pot: slot('Vaso', 'stone/terrazzo', ['stone', 'ceramic', 'paint']) } },
  { id: 'plant/tree-medium', name: L('Árvore média', 'Medium tree'), category: 'plant', model: 'procedural/tree', dimensions: { width: 3, height: 5, depth: 3 }, resizable: { width: [1, 8], height: [2, 12], depth: [1, 8] }, tags: ['exterior'] },
  { id: 'plant/palm', name: L('Palmeira', 'Palm tree'), category: 'plant', model: 'procedural/palm', dimensions: { width: 2.2, height: 4, depth: 2.2 }, resizable: { height: [1.5, 9] }, tags: ['exterior'] },
  // Exterior
  { id: 'outdoor/sun-lounger', name: L('Espreguiçadeira', 'Sun lounger'), category: 'outdoor', model: 'procedural/lounger', dimensions: { width: 0.65, height: 0.9, depth: 1.95 },
    materialSlots: { fabric: slot('Estofado', 'fabric/linen', SOFT), frame: slot('Estrutura', 'wood/natural-oak', ['wood', 'metal']) }, tags: ['exterior', 'piscina'] },
  { id: 'outdoor/umbrella', name: L('Guarda-sol', 'Parasol'), category: 'outdoor', model: 'procedural/umbrella', dimensions: { width: 2.6, height: 2.5, depth: 2.6 },
    materialSlots: { canopy: slot('Tecido', 'fabric/linen', SOFT), pole: slot('Haste', 'wood/natural-oak', ['wood', 'metal']) }, tags: ['exterior', 'piscina'] },
  // Cozinha
  { id: 'kitchen/counter', name: L('Balcão de cozinha', 'Kitchen counter'), category: 'kitchen', model: 'procedural/kitchen-counter', dimensions: { width: 1.2, height: 0.9, depth: 0.6 }, resizable: { width: [0.4, 3.6], depth: [0.5, 0.75] },
    materialSlots: { body: slot('Armário', 'paint/white-matte', ['wood', 'paint']), top: slot('Bancada', 'stone/granite-grey', SURFACE), handles: slot('Puxadores', 'metal/brushed-steel', METAL) }, tags: ['cozinha'] },
  { id: 'kitchen/island', name: L('Ilha de cozinha', 'Kitchen island'), category: 'kitchen', model: 'procedural/kitchen-island', dimensions: { width: 2, height: 0.92, depth: 0.9 }, resizable: { width: [1, 4], depth: [0.7, 1.2] },
    materialSlots: { body: slot('Armário', 'paint/ink-blue', ['wood', 'paint']), top: slot('Bancada', 'stone/marble-carrara', SURFACE), handles: slot('Puxadores', 'metal/brass', METAL) }, tags: ['cozinha'] },
  { id: 'appliance/fridge', name: L('Geladeira', 'Refrigerator'), category: 'appliance', model: 'procedural/fridge', dimensions: { width: 0.7, height: 1.8, depth: 0.72 }, resizable: { width: [0.55, 0.95], height: [1.4, 2.1] },
    materialSlots: { body: slot('Corpo', 'metal/brushed-steel', ['metal', 'paint', 'plastic']), handle: slot('Puxador', 'metal/black-matte', METAL) }, tags: ['cozinha'] },
  { id: 'appliance/stove', name: L('Fogão', 'Stove'), category: 'appliance', model: 'procedural/stove', dimensions: { width: 0.6, height: 0.9, depth: 0.62 }, resizable: { width: [0.5, 0.9] },
    materialSlots: { body: slot('Corpo', 'metal/brushed-steel', ['metal', 'paint', 'plastic']), top: slot('Mesa', 'metal/black-matte', ['metal', 'glass']) }, tags: ['cozinha'] },
  // Banheiro
  { id: 'bathroom/toilet', name: L('Vaso sanitário', 'Toilet'), category: 'bathroom', model: 'procedural/toilet', dimensions: { width: 0.4, height: 0.78, depth: 0.7 },
    materialSlots: { ceramic: slot('Louça', 'ceramic/porcelain-white', ['ceramic', 'paint']), seat: slot('Assento', 'plastic/white', ['plastic', 'wood']) }, tags: ['banheiro'] },
  { id: 'bathroom/vanity', name: L('Gabinete com pia', 'Vanity with sink'), category: 'bathroom', model: 'procedural/vanity', dimensions: { width: 0.8, height: 0.85, depth: 0.5 }, resizable: { width: [0.5, 1.8] },
    materialSlots: { body: slot('Gabinete', 'wood/ash', ['wood', 'paint']), top: slot('Tampo', 'stone/marble-carrara', SURFACE), basin: slot('Cuba', 'ceramic/porcelain-white', CERAMIC), tap: slot('Torneira', 'metal/chrome', METAL) }, tags: ['banheiro'] },
  { id: 'bathroom/shower-box', name: L('Box de banho', 'Shower enclosure'), category: 'bathroom', model: 'procedural/shower-box', dimensions: { width: 0.9, height: 2, depth: 0.9 }, resizable: { width: [0.7, 1.5], depth: [0.7, 1.5] },
    materialSlots: { tray: slot('Base', 'ceramic/porcelain-white', CERAMIC), frame: slot('Perfil', 'metal/black-matte', METAL), glass: slot('Vidro', 'glass/clear', GLASS) }, tags: ['banheiro'] },
  { id: 'bathroom/bathtub', name: L('Banheira', 'Bathtub'), category: 'bathroom', model: 'procedural/bathtub', dimensions: { width: 1.7, height: 0.55, depth: 0.75 }, resizable: { width: [1.3, 2], depth: [0.65, 0.9] },
    materialSlots: { shell: slot('Louça', 'ceramic/porcelain-white', CERAMIC), tap: slot('Torneira', 'metal/chrome', METAL) }, tags: ['banheiro'] },
  // Camas, sofás e mesas (variações)
  { id: 'bed/single', name: L('Cama de solteiro', 'Single bed'), category: 'bed', model: 'procedural/bed-queen', dimensions: { width: 0.9, height: 0.95, depth: 1.95 }, resizable: { width: [0.8, 1.1] },
    materialSlots: { bedding: slot('Roupa de cama', 'fabric/sage-linen', SOFT), accent: slot('Manta', 'fabric/oat-knit', SOFT), frame: slot('Estrutura e cabeceira', 'wood/light-ash', ['wood', 'fabric', 'leather', 'paint']) }, tags: ['quarto'] },
  { id: 'bed/king', name: L('Cama king', 'King bed'), category: 'bed', model: 'procedural/bed-queen', dimensions: { width: 1.93, height: 1.05, depth: 2.12 }, resizable: { width: [1.8, 2.2] },
    materialSlots: { bedding: slot('Roupa de cama', 'fabric/linen', SOFT), accent: slot('Manta', 'fabric/charcoal-felt', SOFT), frame: slot('Estrutura e cabeceira', 'wood/walnut', ['wood', 'fabric', 'leather', 'paint']) }, tags: ['quarto'] },
  { id: 'sofa/two-seat', name: L('Sofá de 2 lugares', '2-seat sofa'), category: 'sofa', model: 'procedural/sofa-3', dimensions: { width: 1.6, height: 0.82, depth: 0.9 }, resizable: { width: [1.3, 2] },
    materialSlots: { upholstery: slot('Estofado', 'fabric/sage-linen', SOFT), cushions: slot('Almofadas', 'fabric/ochre-velvet', SOFT), legs: slot('Pés', 'wood/walnut', HARD) }, tags: ['sala'] },
  { id: 'sofa/three-seat', name: L('Sofá de 3 lugares reto', '3-seat sofa'), category: 'sofa', model: 'procedural/sofa-3', dimensions: { width: 2.3, height: 0.85, depth: 0.95 }, resizable: { width: [1.9, 3] },
    materialSlots: { upholstery: slot('Estofado', 'fabric/linen', SOFT), cushions: slot('Almofadas', 'fabric/rust-wool', SOFT), legs: slot('Pés', 'wood/natural-oak', HARD) }, tags: ['sala'] },
  { id: 'sofa/armchair', name: L('Poltrona', 'Armchair'), category: 'sofa', model: 'procedural/armchair', dimensions: { width: 0.8, height: 0.82, depth: 0.82 }, resizable: { width: [0.65, 1.1], depth: [0.65, 1.1] },
    materialSlots: { upholstery: slot('Estofado', 'fabric/boucle', SOFT), frame: slot('Estrutura', 'wood/natural-oak', HARD) }, tags: ['sala'] },
  { id: 'table/side', name: L('Mesa lateral', 'Side table'), category: 'table', model: 'procedural/table-coffee-round', dimensions: { width: 0.45, height: 0.5, depth: 0.45 }, resizable: { width: [0.3, 0.7], height: [0.35, 0.65] },
    materialSlots: { top: slot('Tampo', 'wood/walnut', ['wood', 'stone', 'ceramic', 'paint', 'metal']) }, tags: ['sala'] },
  { id: 'table/coffee-rect', name: L('Mesa de centro retangular', 'Rectangular coffee table'), category: 'table', model: 'procedural/table-dining', dimensions: { width: 1.1, height: 0.4, depth: 0.6 }, resizable: { width: [0.7, 1.6], depth: [0.4, 0.9], height: [0.3, 0.5] },
    materialSlots: { top: slot('Tampo', 'wood/walnut', ['wood', 'stone', 'ceramic', 'paint']), legs: slot('Pés', 'metal/black-matte', HARD) }, tags: ['sala'] },
  { id: 'table/dining-round', name: L('Mesa de jantar redonda', 'Round dining table'), category: 'table', model: 'procedural/table-dining-round', dimensions: { width: 1.2, height: 0.75, depth: 1.2 }, resizable: { width: [0.8, 1.8], depth: [0.8, 1.8] },
    materialSlots: { top: slot('Tampo', 'wood/natural-oak', ['wood', 'stone', 'ceramic', 'paint']), legs: slot('Base', 'metal/black-matte', HARD) }, tags: ['jantar'] },
  { id: 'chair/bar-stool', name: L('Banqueta alta', 'Bar stool'), category: 'chair', model: 'procedural/bar-stool', dimensions: { width: 0.4, height: 0.75, depth: 0.4 }, resizable: { height: [0.6, 0.85] },
    materialSlots: { seat: slot('Assento', 'leather/tan', SOFT.concat(['wood'])), frame: slot('Estrutura', 'metal/black-matte', ['metal', 'wood']) }, tags: ['cozinha'] },
  { id: 'storage/sideboard', name: L('Aparador', 'Sideboard'), category: 'storage', model: 'procedural/tv-unit', dimensions: { width: 1.6, height: 0.8, depth: 0.45 }, resizable: { width: [1, 2.4], height: [0.6, 1] },
    materialSlots: { body: slot('Corpo', 'wood/walnut', ['wood', 'paint']) }, tags: ['sala', 'jantar'] },
  // Decoração e têxtil
  { id: 'decor/mirror', name: L('Espelho', 'Mirror'), category: 'decor', model: 'procedural/mirror', dimensions: { width: 0.6, height: 1.6, depth: 0.04 }, mount: 'wall', resizable: { width: [0.3, 1.6], height: [0.4, 2] },
    materialSlots: { frame: slot('Moldura', 'metal/black-matte', ['metal', 'wood', 'paint']) }, tags: ['decoração'] },
  { id: 'decor/art-frame', name: L('Quadro', 'Framed art'), category: 'decor', model: 'procedural/art-frame', dimensions: { width: 0.8, height: 0.6, depth: 0.04 }, mount: 'wall', resizable: { width: [0.3, 2], height: [0.3, 1.6] },
    materialSlots: { frame: slot('Moldura', 'wood/ebony', ['wood', 'metal', 'paint']), art: slot('Cor principal', 'paint/ink-blue', ['paint']), accent: slot('Cor de destaque', 'paint/mustard', ['paint']) }, tags: ['decoração'] },
  { id: 'textile/curtain', name: L('Cortina', 'Curtain'), category: 'textile', model: 'procedural/curtain', dimensions: { width: 1.6, height: 2.5, depth: 0.12 }, mount: 'wall', resizable: { width: [0.6, 4], height: [1.2, 3.2] },
    materialSlots: { fabric: slot('Tecido', 'fabric/linen', SOFT), rod: slot('Varão', 'metal/brass', METAL) }, tags: ['janela'] },
  // Plantas
  { id: 'plant/shrub', name: L('Arbusto', 'Shrub'), category: 'plant', model: 'procedural/shrub', dimensions: { width: 0.9, height: 0.8, depth: 0.9 }, resizable: { width: [0.4, 2.5], height: [0.3, 2], depth: [0.4, 2.5] },
    materialSlots: { foliage: slot('Folhagem', 'plant/leaf', ['plant']) }, tags: ['exterior', 'jardim'] },
  { id: 'plant/small-pot', name: L('Vaso pequeno com planta', 'Small potted plant'), category: 'plant', model: 'procedural/plant-pot', dimensions: { width: 0.3, height: 0.45, depth: 0.3 }, mount: 'surface', resizable: { height: [0.25, 0.8] },
    materialSlots: { pot: slot('Vaso', 'ceramic/terracotta', ['ceramic', 'stone', 'paint']), foliage: slot('Folhagem', 'plant/leaf-light', ['plant']) } },
  // Exterior
  { id: 'outdoor/table', name: L('Mesa de jardim', 'Garden table'), category: 'outdoor', model: 'procedural/table-dining', dimensions: { width: 1.5, height: 0.75, depth: 0.9 }, resizable: { width: [0.8, 3], depth: [0.6, 1.4] },
    materialSlots: { top: slot('Tampo', 'wood/deck-cumaru', ['wood', 'stone', 'ceramic', 'metal']), legs: slot('Pés', 'metal/black-matte', HARD) }, tags: ['exterior'] },
  { id: 'outdoor/bbq', name: L('Churrasqueira', 'Barbecue grill'), category: 'outdoor', model: 'procedural/bbq', dimensions: { width: 1.4, height: 1.1, depth: 0.6 }, resizable: { width: [0.9, 2] },
    materialSlots: { body: slot('Corpo', 'metal/black-matte', ['metal', 'paint']), side: slot('Bancada lateral', 'wood/deck-cumaru', ['wood', 'stone', 'metal']) }, tags: ['exterior'] },
  { id: 'outdoor/mailbox', name: L('Caixa de correio', 'Mailbox'), category: 'outdoor', model: 'procedural/mailbox', dimensions: { width: 0.25, height: 1.2, depth: 0.4 },
    materialSlots: { post: slot('Poste', 'wood/deck-cumaru', ['wood', 'metal', 'paint']), box: slot('Caixa', 'metal/black-matte', ['metal', 'paint']) }, tags: ['exterior'] },
  { id: 'outdoor/car', name: L('Carro', 'Car'), category: 'outdoor', model: 'procedural/car', dimensions: { width: 1.8, height: 1.5, depth: 4.4 },
    materialSlots: { body: slot('Pintura', 'paint/ink-blue', ['paint', 'metal']) }, tags: ['exterior', 'garagem'] },
  // Genérico
  { id: 'other/box', name: L('Caixa', 'Box'), category: 'other', model: 'procedural/box', dimensions: { width: 0.5, height: 0.5, depth: 0.5 }, resizable: { width: [0.05, 10], height: [0.05, 10], depth: [0.05, 10] },
    materialSlots: { body: slot('Material', 'wood/natural-oak') } },
]

for (const it of items) it.license = LICENSE
