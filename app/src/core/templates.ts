import { applyOps, type OpInput } from './ops'
import { wallsOfRoom } from './model'
import { newScene } from './serialize'
import type { Scene } from './schema'

/** Projetos de exemplo para começar (tudo em medidas reais). */
export interface Template {
  id: string
  name: string
  description: string
  build: () => Scene
}

type WallFn = (room: string, i: number) => string

/** Em duas etapas para referenciar paredes pelo índice (0=norte, 1=leste, 2=sul, 3=oeste em ambientes retangulares). */
function make(name: string, mood: string, time: string, rooms: OpInput[], more: (wall: WallFn) => OpInput[]): Scene {
  const base = newScene(name)
  base.environment = { ...base.environment, timeOfDay: time, mood }
  const r1 = applyOps(base, rooms)
  if (r1.errors.length) throw new Error('template: ' + JSON.stringify(r1.errors))
  const wall: WallFn = (room, i) => {
    const w = wallsOfRoom(r1.scene.levels[0], room)[i]
    if (!w) throw new Error(`template: parede ${i} de ${room}`)
    return w.id
  }
  const r2 = applyOps(r1.scene, more(wall))
  if (r2.errors.length) throw new Error('template: ' + JSON.stringify(r2.errors))
  return r2.scene
}

export const TEMPLATES: Template[] = [
  {
    id: 'studio',
    name: 'Studio 7 × 5 m',
    description: 'Sala, cama e cantinho de trabalho em um único ambiente.',
    build: () =>
      make(
        'Studio 7 × 5 m',
        'cozy',
        '17:30',
        [{ op: 'addRoom', id: 'studio', name: 'Studio', type: 'studio', x: 0, z: 0, width: 7, depth: 5, floorMaterial: 'wood/smoked-oak', wallMaterial: 'paint/sand-limewash' }],
        (w) => [
          { op: 'addOpening', wallId: w('studio', 0), kind: 'window', offset: 2.0, width: 1.8, height: 1.5, sill: 0.8 },
          { op: 'addOpening', wallId: w('studio', 0), kind: 'window', offset: 5.4, width: 1.4, height: 1.5, sill: 0.8 },
          { op: 'addOpening', wallId: w('studio', 2), kind: 'door', offset: 6.1 },
          { op: 'addOpening', wallId: w('studio', 1), kind: 'sliding-door', offset: 1.2, width: 1.6 },
          { op: 'addObject', catalogId: 'rug/rectangular', x: 2.2, z: 2.6 },
          { op: 'addObjectAtWall', catalogId: 'sofa/modern-3-seat', wallId: w('studio', 2), offset: 4.8 },
          { op: 'addObject', catalogId: 'table/coffee-round', x: 2.2, z: 3.2 },
          { op: 'addObjectAtWall', catalogId: 'storage/tv-unit', wallId: w('studio', 0), offset: 2.2 },
          { op: 'addObject', catalogId: 'chair/armchair-lounge', x: 0.85, z: 2.8, rotationDeg: 80, materials: { upholstery: 'fabric/ochre-velvet' } },
          { op: 'addObjectAtWall', catalogId: 'bed/queen-modern', wallId: w('studio', 1), offset: 3.6 },
          { op: 'addObjectAtWall', catalogId: 'storage/nightstand', wallId: w('studio', 1), offset: 2.5 },
          { op: 'addObjectAtWall', catalogId: 'storage/nightstand', wallId: w('studio', 1), offset: 4.7 },
          { op: 'addObjectAtWall', catalogId: 'desk/simple', wallId: w('studio', 0), offset: 5.4 },
          { op: 'addObject', catalogId: 'chair/office', x: 5.4, z: 1.2, rotationDeg: 180 },
          { op: 'addObject', catalogId: 'plant/monstera-large', x: 0.45, z: 0.5 },
          { op: 'addObject', catalogId: 'lighting/floor-arc', x: 0.5, z: 4.5 },
          { op: 'addObject', catalogId: 'lighting/pendant-dome', x: 2.2, z: 2.9 },
        ],
      ),
  },
  {
    id: 'quarto',
    name: 'Quarto 4 × 3,5 m',
    description: 'Quarto de casal com guarda-roupa e tapete.',
    build: () =>
      make(
        'Quarto 4 × 3,5 m',
        'bright',
        '19:00',
        [{ op: 'addRoom', id: 'quarto', name: 'Quarto', type: 'bedroom', x: 0, z: 0, width: 4, depth: 3.5, floorMaterial: 'wood/natural-oak', wallMaterial: 'paint/sage' }],
        (w) => [
          { op: 'addOpening', wallId: w('quarto', 0), kind: 'window', offset: 2.0, width: 1.6, height: 1.4, sill: 0.9 },
          { op: 'addOpening', wallId: w('quarto', 3), kind: 'door', offset: 0.9 },
          { op: 'addObject', catalogId: 'rug/rectangular', x: 2.0, z: 1.9 },
          { op: 'addObjectAtWall', catalogId: 'bed/queen-modern', wallId: w('quarto', 0), offset: 2.0 },
          { op: 'addObjectAtWall', catalogId: 'storage/nightstand', wallId: w('quarto', 0), offset: 0.55 },
          { op: 'addObjectAtWall', catalogId: 'storage/nightstand', wallId: w('quarto', 0), offset: 3.45 },
          { op: 'addObjectAtWall', catalogId: 'storage/wardrobe-2-door', wallId: w('quarto', 2), offset: 2.0 },
          { op: 'addObject', catalogId: 'plant/monstera-large', x: 3.6, z: 3.1 },
        ],
      ),
  },
  {
    id: 'jardim',
    name: 'Casa com jardim (20 × 30 m)',
    description: 'Terreno com casa, deck, piscina, gramado, cerca e árvores.',
    build: () =>
      make(
        'Casa com jardim',
        'bright',
        '16:00',
        [
          { op: 'setSite', width: 20, depth: 30, groundMaterial: 'ground/grass' },
          { op: 'addRoom', id: 'casa', name: 'Casa', type: 'living', x: 5, z: 4, width: 10, depth: 8, floorMaterial: 'wood/natural-oak', wallMaterial: 'paint/white-matte', wallHeight: 3.0 },
          { op: 'addZone', id: 'deck', kind: 'deck', name: 'Deck', x: 5, z: 12, width: 10, depth: 4 },
          { op: 'addZone', id: 'piscina', kind: 'pool', name: 'Piscina', x: 7, z: 17, width: 6, depth: 3 },
          { op: 'addZone', id: 'garagem', kind: 'paving', name: 'Garagem', x: 15.5, z: 4, width: 3.5, depth: 8, material: 'concrete/polished' },
        ],
        (w) => [
          { op: 'addOpening', wallId: w('casa', 2), kind: 'sliding-door', offset: 5, width: 3 },
          { op: 'addOpening', wallId: w('casa', 2), kind: 'window', offset: 1.5, width: 1.2, height: 1.2, sill: 0.9 },
          { op: 'addOpening', wallId: w('casa', 0), kind: 'door', offset: 2 },
          { op: 'addOpening', wallId: w('casa', 0), kind: 'window', offset: 6, width: 1.6, height: 1.2, sill: 1 },
          { op: 'addWall', kind: 'fence', start: [0, 0], end: [20, 0], container: 'site' },
          { op: 'addWall', kind: 'fence', start: [20, 0], end: [20, 30], container: 'site' },
          { op: 'addWall', kind: 'fence', start: [20, 30], end: [0, 30], container: 'site' },
          { op: 'addWall', kind: 'fence', start: [0, 30], end: [0, 0], container: 'site' },
          { op: 'addObject', catalogId: 'plant/tree-medium', x: 2.5, z: 6 },
          { op: 'addObject', catalogId: 'plant/palm', x: 17.5, z: 22 },
          { op: 'addObject', catalogId: 'outdoor/sun-lounger', x: 5.5, z: 21.4, rotationDeg: 180 },
          { op: 'addObject', catalogId: 'outdoor/sun-lounger', x: 6.5, z: 21.4, rotationDeg: 180 },
          { op: 'addObject', catalogId: 'table/dining-rect', x: 10, z: 14, y: 0.1, container: 'site' },
          { op: 'addObject', catalogId: 'outdoor/umbrella', x: 10, z: 14, y: 0.1, container: 'site' },
        ],
      ),
  },
  {
    id: 'vazio',
    name: 'Projeto em branco',
    description: 'Comece do zero: informe as medidas e construa.',
    build: () => newScene('Novo projeto'),
  },
]
