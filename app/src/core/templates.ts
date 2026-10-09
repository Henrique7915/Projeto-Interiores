import { applyOps, type OpInput } from './ops'
import { wallsOfRoom } from './model'
import { newScene, parseScene } from './serialize'
import casaJoao from '../../../schema/exemplos/casa-joao.json'
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
          { op: 'addObjectAtWall', catalogId: 'sofa/three-seat', wallId: w('studio', 2), offset: 4.8 },
          { op: 'addObject', catalogId: 'table/coffee-round', x: 2.2, z: 3.2 },
          { op: 'addObjectAtWall', catalogId: 'storage/tv-unit', wallId: w('studio', 0), offset: 2.2 },
          { op: 'addObject', catalogId: 'sofa/armchair', x: 0.85, z: 2.8, rotationDeg: 80, materials: { upholstery: 'fabric/ochre-velvet' } },
          { op: 'addObjectAtWall', catalogId: 'bed/queen-modern', wallId: w('studio', 1), offset: 3.6 },
          { op: 'addObjectAtWall', catalogId: 'storage/nightstand', wallId: w('studio', 1), offset: 2.5 },
          { op: 'addObjectAtWall', catalogId: 'storage/nightstand', wallId: w('studio', 1), offset: 4.7 },
          { op: 'addObjectAtWall', catalogId: 'desk/simple', wallId: w('studio', 0), offset: 5.4 },
          { op: 'addObject', catalogId: 'chair/office', x: 5.4, z: 1.2, rotationDeg: 180 },
          { op: 'addObject', catalogId: 'plant/monstera-large', x: 0.45, z: 0.5 },
          { op: 'addObject', catalogId: 'lighting/floor-arc', x: 0.5, z: 4.5 },
          { op: 'addObject', catalogId: 'lighting/pendant-dome', x: 2.2, z: 2.9 },
          { op: 'addObjectAtWall', catalogId: 'decor/art-frame', wallId: w('studio', 0), offset: 3.7, y: 1.3 },
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
          { op: 'addZone', id: 'garagem', kind: 'paving', name: 'Garagem', x: 15.5, z: 4, width: 3.5, depth: 8, material: 'ground/asphalt' },
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
          { op: 'addObject', catalogId: 'plant/shrub', x: 4.2, z: 12.5 },
          { op: 'addObject', catalogId: 'outdoor/sun-lounger', x: 5.5, z: 21.4, rotationDeg: 180 },
          { op: 'addObject', catalogId: 'outdoor/sun-lounger', x: 6.5, z: 21.4, rotationDeg: 180 },
          { op: 'addObject', catalogId: 'outdoor/table', x: 10, z: 14, y: 0.1, container: 'site' },
          { op: 'addObject', catalogId: 'outdoor/umbrella', x: 10, z: 14, y: 0.1, container: 'site' },
          { op: 'addObject', catalogId: 'outdoor/bbq', x: 14, z: 13.5, y: 0.1, rotationDeg: 180 },
          { op: 'addObject', catalogId: 'outdoor/car', x: 17.2, z: 8, rotationDeg: 180 },
          { op: 'addObject', catalogId: 'outdoor/mailbox', x: 1, z: 1 },
        ],
      ),
  },
  {
    id: 'sobrado',
    name: 'Sobrado 10 × 5 m (2 andares)',
    description: 'Sala e cozinha embaixo, hall e dois quartos em cima, com escada e telhado de duas águas.',
    build: () =>
      make(
        'Sobrado 10 × 5 m',
        'bright',
        '15:00',
        [
          { op: 'addRoom', id: 'sala', name: 'Sala', type: 'living', x: 0, z: 0, width: 6, depth: 5, wallHeight: 2.8, floorMaterial: 'wood/natural-oak', wallMaterial: 'paint/white-matte' },
          { op: 'addRoom', id: 'cozinha', name: 'Cozinha', type: 'kitchen', x: 6, z: 0, width: 4, depth: 5, wallHeight: 2.8, floorMaterial: 'stone/slate', wallMaterial: 'paint/white-matte' },
          { op: 'updateLevel', id: 'terreo', patch: { height: 2.8 } },
          { op: 'addLevel', id: 'superior', name: '1º andar', height: 2.6 },
          { op: 'addRoom', id: 'hall', name: 'Hall', type: 'hall', x: 0, z: 0, width: 2, depth: 5, container: 'superior', floorMaterial: 'wood/natural-oak', wallMaterial: 'paint/white-matte' },
          { op: 'addRoom', id: 'quarto1', name: 'Quarto 1', type: 'bedroom', x: 2, z: 0, width: 4, depth: 5, container: 'superior', floorMaterial: 'wood/natural-oak', wallMaterial: 'paint/sage' },
          { op: 'addRoom', id: 'quarto2', name: 'Quarto 2', type: 'bedroom', x: 6, z: 0, width: 4, depth: 5, container: 'superior', floorMaterial: 'wood/natural-oak', wallMaterial: 'paint/sand-limewash' },
        ],
        () => [
          // térreo
          { op: 'addOpening', roomId: 'sala', roomSide: 'south', kind: 'door', offset: 4.2 },
          { op: 'addOpening', roomId: 'sala', roomSide: 'south', kind: 'window', offset: 2.2, width: 1.6 },
          { op: 'addOpening', roomId: 'sala', roomSide: 'north', kind: 'sliding-window', offset: 3.5, width: 2 },
          { op: 'addOpening', roomId: 'sala', roomSide: 'east', kind: 'passage', offset: 2.5, width: 1.2 },
          { op: 'addOpening', roomId: 'cozinha', roomSide: 'north', kind: 'window', offset: 2, width: 1.4 },
          { op: 'addObject', catalogId: 'stairs/straight', x: 0.6, z: 2.0, container: 'terreo' },
          { op: 'addObject', catalogId: 'sofa/modern-3-seat', x: 3.6, z: 0.6, container: 'terreo' },
          { op: 'addObject', catalogId: 'table/coffee-rect', x: 3.6, z: 2.0, container: 'terreo' },
          { op: 'addObject', catalogId: 'rug/rectangular', x: 3.6, z: 2.0, container: 'terreo' },
          { op: 'addObject', catalogId: 'storage/tv-unit', x: 3.6, z: 4.7, rotationDeg: 180, container: 'terreo' },
          { op: 'addObject', catalogId: 'kitchen/counter', x: 6.7, z: 0.4, container: 'terreo' },
          { op: 'addObject', catalogId: 'kitchen/counter', x: 7.9, z: 0.4, container: 'terreo' },
          { op: 'addObject', catalogId: 'kitchen/counter', x: 9.1, z: 0.4, container: 'terreo' },
          { op: 'addObject', catalogId: 'kitchen/island', x: 8, z: 2.7, container: 'terreo' },
          { op: 'addObject', catalogId: 'appliance/fridge', x: 9.45, z: 4.55, rotationDeg: 180, container: 'terreo' },
          // 1º andar
          { op: 'addSlabOpening', id: 'vao-escada', levelId: 'superior', x: 0.15, z: 0.2, width: 0.9, depth: 3.6 },
          { op: 'addOpening', roomId: 'hall', roomSide: 'east', kind: 'door', offset: 3.6 },
          { op: 'addOpening', roomId: 'quarto1', roomSide: 'east', kind: 'door', offset: 2.5 },
          { op: 'addOpening', roomId: 'quarto1', roomSide: 'north', kind: 'window', offset: 2, width: 1.6, id: 'janela-q1' },
          { op: 'addOpening', roomId: 'quarto2', roomSide: 'north', kind: 'window', offset: 2, width: 1.6, id: 'janela-q2' },
          { op: 'setTreatment', id: 'janela-q1', kind: 'curtain', material: 'fabric/linen', open: 0.6 },
          { op: 'setTreatment', id: 'janela-q2', kind: 'sheer', material: 'fabric/oat-knit', open: 0.5 },
          { op: 'addObject', catalogId: 'bed/queen-modern', x: 4, z: 1.2, container: 'superior' },
          { op: 'addObject', catalogId: 'storage/nightstand', x: 2.8, z: 0.3, container: 'superior' },
          { op: 'addObject', catalogId: 'storage/nightstand', x: 5.2, z: 0.3, container: 'superior' },
          { op: 'addObject', catalogId: 'bed/king', x: 8, z: 1.2, container: 'superior' },
          { op: 'addObject', catalogId: 'storage/wardrobe-2-door', x: 9.2, z: 4.62, rotationDeg: 180, container: 'superior' },
          { op: 'addRoof', id: 'telhado', kind: 'gable', levelId: 'superior', x: 0, z: 0, width: 10, depth: 5, pitchDeg: 25, overhang: 0.5, material: 'ceramic/roof-tile' },
        ],
      ),
  },
  {
    id: 'casa-joao',
    name: 'Casa do João (prancha A2)',
    description: 'Casa de dois andares com piscina, área gourmet, sauna e garagem para 4 carros, montada a partir do projeto em PDF.',
    build: () => parseScene(structuredClone(casaJoao)),
  },
  {
    id: 'vazio',
    name: 'Projeto em branco',
    description: 'Comece do zero: informe as medidas e construa.',
    build: () => newScene('Novo projeto'),
  },
]
