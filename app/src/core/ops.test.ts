import { describe, expect, it } from 'vitest'
import { analyzeScene, applyOps, decodeShare, describeScene, encodeShare, newScene, parseScene, polygonArea, TEMPLATES, validateSchema, wallsOfRoom } from './index'
import { wallRoomIds } from './model'

describe('ops', () => {
  it('cria ambiente com 4 paredes (interior à direita) e área correta', () => {
    const r = applyOps(newScene(), [{ op: 'addRoom', id: 'sala', name: 'Sala', x: 0, z: 0, width: 5, depth: 4, wallMaterial: 'paint/sage' }])
    expect(r.errors).toEqual([])
    const lvl = r.scene.levels[0]
    expect(lvl.walls).toHaveLength(4)
    expect(polygonArea(lvl.rooms![0].polygon)).toBe(20)
    expect(lvl.walls![0].finish?.right).toBe('paint/sage')
    expect(validateSchema(r.scene).errors).toEqual([])
  })
  it('redimensiona e mantém aberturas dentro da parede', () => {
    let s = applyOps(newScene(), [{ op: 'addRoom', id: 'a', name: 'A', x: 0, z: 0, width: 6, depth: 4 }]).scene
    const wall = wallsOfRoom(s.levels[0], 'a')[0].id
    s = applyOps(s, [{ op: 'addOpening', wallId: wall, kind: 'window', offset: 5.5, width: 1 }]).scene
    s = applyOps(s, [{ op: 'resizeRoom', id: 'a', width: 3 }]).scene
    const o = s.levels[0].openings![0]
    expect(o.offset + o.width / 2).toBeLessThanOrEqual(3 + 1e-9)
  })
  it('reporta erros sem derrubar o lote', () => {
    const r = applyOps(newScene(), [
      { op: 'addObject', catalogId: 'nao/existe', x: 0, z: 0 },
      { op: 'addRoom', name: 'B', x: 0, z: 0, width: 2, depth: 2 },
    ])
    expect(r.errors).toHaveLength(1)
    expect(r.scene.levels[0].rooms).toHaveLength(1)
  })
  it('addObjectAtWall encosta e vira o móvel para dentro', () => {
    const s = applyOps(newScene(), [{ op: 'addRoom', id: 'r', name: 'R', x: 0, z: 0, width: 4, depth: 4 }]).scene
    const south = wallsOfRoom(s.levels[0], 'r')[2].id
    const r = applyOps(s, [{ op: 'addObjectAtWall', id: 'sofa', catalogId: 'sofa/three-seat', wallId: south, offset: 2 }])
    expect(r.errors).toEqual([])
    const o = r.scene.levels[0].objects![0]
    expect(Math.abs(o.rotationDeg!)).toBe(180)
    expect(o.position[2]).toBeLessThan(4)
    expect(o.position[2]).toBeCloseTo(4 - 0.075 - 0.475 - 0.02, 3)
  })
  it('detecta sobreposição de móveis', () => {
    const s = applyOps(newScene(), [
      { op: 'addRoom', name: 'S', x: 0, z: 0, width: 5, depth: 5 },
      { op: 'addObject', catalogId: 'sofa/three-seat', x: 2, z: 2 },
      { op: 'addObject', catalogId: 'sofa/three-seat', x: 2.2, z: 2.2 },
    ]).scene
    expect(analyzeScene(s).some((i) => i.type === 'sobreposicao')).toBe(true)
  })
  it('templates constroem, validam no schema e descrevem', () => {
    for (const t of TEMPLATES) {
      const s = t.build()
      const v = validateSchema(s)
      expect(v.errors).toEqual([])
      expect(describeScene(s).length).toBeGreaterThan(20)
      expect(parseScene(JSON.parse(JSON.stringify(s))).id).toBe(s.id)
    }
  })
  it('link compartilhável vai e volta', async () => {
    const s = TEMPLATES[0].build()
    const back = await decodeShare(await encodeShare(s))
    expect(back.levels[0].objects!.length).toBe(s.levels[0].objects!.length)
  })
  it('endereça paredes por lado do ambiente (offset cresce em X/Z)', () => {
    const r = applyOps(newScene(), [
      { op: 'addRoom', id: 'sala', name: 'Sala', x: 0, z: 0, width: 5, depth: 4 },
      { op: 'addOpening', id: 'j-n', roomId: 'sala', roomSide: 'north', kind: 'window', offset: 1 },
      { op: 'addOpening', id: 'p-s', roomId: 'sala', roomSide: 'south', kind: 'door', offset: 1 },
      { op: 'addObjectAtWall', id: 'sofa', catalogId: 'sofa/modern-3-seat', roomId: 'sala', roomSide: 'south', offset: 3 },
      { op: 'addObjectAtWall', id: 'cama', catalogId: 'bed/queen-modern', roomId: 'sala', roomSide: 'west', offset: 3 },
    ])
    expect(r.errors).toEqual([])
    const lvl = r.scene.levels[0]
    const wallOf = (id: string) => lvl.walls!.find((w) => w.id === lvl.openings!.find((o) => o.id === id)!.wallId)!
    expect(wallOf('j-n').start[1]).toBe(0)
    // porta na parede sul a 1 m do lado OESTE: centro em x = 1 (parede vai de leste para oeste, offset 4)
    const door = lvl.openings!.find((o) => o.id === 'p-s')!
    expect(door.offset).toBeCloseTo(4, 3)
    const sofa = lvl.objects!.find((o) => o.id === 'sofa')!
    expect(sofa.position[0]).toBeCloseTo(3, 3)
    const bed = lvl.objects!.find((o) => o.id === 'cama')!
    expect(bed.position[2]).toBeCloseTo(3, 3)
    expect(bed.rotationDeg).toBe(90)
  })
})

describe('paredes compartilhadas entre ambientes vizinhos', () => {
  const dup = (s: ReturnType<typeof newScene>) => {
    const w = s.levels[0].walls ?? []
    const out: string[] = []
    for (let i = 0; i < w.length; i++)
      for (let j = i + 1; j < w.length; j++) {
        const a = w[i]
        const b = w[j]
        const sameLine = a.start[0] === a.end[0] && b.start[0] === b.end[0] ? a.start[0] === b.start[0] : a.start[1] === a.end[1] && b.start[1] === b.end[1] ? a.start[1] === b.start[1] : false
        if (!sameLine) continue
        const ax = a.start[0] === a.end[0] ? 1 : 0
        const lo = Math.max(Math.min(a.start[ax], a.end[ax]), Math.min(b.start[ax], b.end[ax]))
        const hi = Math.min(Math.max(a.start[ax], a.end[ax]), Math.max(b.start[ax], b.end[ax]))
        if (hi - lo > 0.02) out.push(`${a.id}~${b.id}`)
      }
    return out
  }
  const base = () => applyOps(newScene(), [{ op: 'addRoom', id: 'sala', name: 'Sala', x: 0, z: 0, width: 4, depth: 5 }]).scene

  it('quarto colado na sala reaproveita a parede (sem parede duplicada)', () => {
    const s = applyOps(base(), [{ op: 'addRoom', id: 'quarto', name: 'Quarto', x: 4, z: 0, width: 3, depth: 5, wallMaterial: 'paint/sage' }]).scene
    expect(s.levels[0].walls).toHaveLength(7)
    expect(dup(s)).toEqual([])
    const shared = s.levels[0].walls!.filter((w) => wallRoomIds(w).length === 2)
    expect(shared).toHaveLength(1)
    expect(wallRoomIds(shared[0]).sort()).toEqual(['quarto', 'sala'])
    expect(wallsOfRoom(s.levels[0], 'sala')).toHaveLength(4)
    expect(wallsOfRoom(s.levels[0], 'quarto')).toHaveLength(4)
    expect(validateSchema(s).errors).toEqual([])
  })
  it('acabamento de cada lado da parede compartilhada é o do ambiente daquele lado', () => {
    let s = applyOps(newScene(), [{ op: 'addRoom', id: 'sala', name: 'Sala', x: 0, z: 0, width: 4, depth: 5, wallMaterial: 'paint/white-matte' }]).scene
    s = applyOps(s, [{ op: 'addRoom', id: 'quarto', name: 'Quarto', x: 4, z: 0, width: 3, depth: 5, wallMaterial: 'paint/sage' }]).scene
    const sh = s.levels[0].walls!.find((w) => wallRoomIds(w).length === 2)!
    expect(new Set([sh.finish?.left, sh.finish?.right])).toEqual(new Set(['paint/white-matte', 'paint/sage']))
  })
  it('porta em roomSide leste da sala e oeste do quarto cai na mesma parede', () => {
    let s = applyOps(base(), [{ op: 'addRoom', id: 'quarto', name: 'Quarto', x: 4, z: 0, width: 3, depth: 5 }]).scene
    const r = applyOps(s, [
      { op: 'addOpening', id: 'p1', roomId: 'sala', roomSide: 'east', kind: 'door' },
      { op: 'addOpening', id: 'p2', roomId: 'quarto', roomSide: 'west', kind: 'window', offset: 1 },
    ])
    expect(r.errors).toEqual([])
    const ops = r.scene.levels[0].openings!
    expect(ops[0].wallId).toBe(ops[1].wallId)
    expect(ops[0].offset).toBeCloseTo(2.5, 3)
  })
  it('parede parcialmente compartilhada é dividida no trecho comum e a porta acha o pedaço certo', () => {
    // sala 0..5 em z; quarto encosta só em z 0..3 -> leste da sala = [0..3 compartilhado] + [3..5 só da sala]
    let s = applyOps(base(), [{ op: 'addRoom', id: 'quarto', name: 'Quarto', x: 4, z: 0, width: 3, depth: 3 }]).scene
    expect(dup(s)).toEqual([])
    const east = wallsOfRoom(s.levels[0], 'sala').filter((w) => w.start[0] === 4 && w.end[0] === 4)
    expect(east).toHaveLength(2)
    expect(east.map((w) => wallRoomIds(w).length).sort()).toEqual([1, 2])
    s = applyOps(s, [
      { op: 'addOpening', id: 'p1', roomId: 'sala', roomSide: 'east', kind: 'door', offset: 1.5 },
      { op: 'addOpening', id: 'p2', roomId: 'sala', roomSide: 'east', kind: 'window', offset: 4 },
    ]).scene
    const [p1, p2] = s.levels[0].openings!
    expect(wallRoomIds(s.levels[0].walls!.find((w) => w.id === p1.wallId)!)).toHaveLength(2)
    expect(wallRoomIds(s.levels[0].walls!.find((w) => w.id === p2.wallId)!)).toEqual(['sala'])
    expect(validateSchema(s).errors).toEqual([])
  })
  it('aberturas já existentes ficam com o pedaço certo ao dividir', () => {
    let s = applyOps(base(), [{ op: 'addOpening', id: 'j', roomId: 'sala', roomSide: 'east', kind: 'window', offset: 4, width: 1 }]).scene
    s = applyOps(s, [{ op: 'addRoom', id: 'quarto', name: 'Quarto', x: 4, z: 0, width: 3, depth: 3 }]).scene
    const j = s.levels[0].openings!.find((o) => o.id === 'j')!
    const w = s.levels[0].walls!.find((x) => x.id === j.wallId)!
    expect(wallRoomIds(w)).toEqual(['sala'])
    expect(w.start[1]).toBeCloseTo(3)
    expect(j.offset).toBeCloseTo(1, 3)
  })
  it('mover o ambiente para colar em outro compartilha; afastar de volta separa', () => {
    let s = applyOps(base(), [{ op: 'addRoom', id: 'quarto', name: 'Quarto', x: 10, z: 0, width: 3, depth: 5 }]).scene
    expect(s.levels[0].walls).toHaveLength(8)
    s = applyOps(s, [{ op: 'moveRoom', id: 'quarto', dx: -6, dz: 0 }]).scene
    expect(s.levels[0].walls).toHaveLength(7)
    expect(dup(s)).toEqual([])
    s = applyOps(s, [{ op: 'moveRoom', id: 'quarto', dx: 6, dz: 0 }]).scene
    expect(s.levels[0].walls).toHaveLength(8)
    expect(wallsOfRoom(s.levels[0], 'sala')).toHaveLength(4)
    expect(wallsOfRoom(s.levels[0], 'quarto')).toHaveLength(4)
    expect(s.levels[0].walls!.every((w) => wallRoomIds(w).length === 1)).toBe(true)
    expect(validateSchema(s).errors).toEqual([])
  })
  it('mover um ambiente com porta própria para colar no outro leva a porta para a parede compartilhada', () => {
    let s = applyOps(base(), [{ op: 'addRoom', id: 'quarto', name: 'Quarto', x: 10, z: 0, width: 3, depth: 5 }]).scene
    s = applyOps(s, [{ op: 'addOpening', id: 'p', roomId: 'quarto', roomSide: 'west', kind: 'door' }]).scene
    s = applyOps(s, [{ op: 'moveRoom', id: 'quarto', dx: -6, dz: 0 }]).scene
    const p = s.levels[0].openings!.find((o) => o.id === 'p')!
    const w = s.levels[0].walls!.find((x) => x.id === p.wallId)!
    expect(wallRoomIds(w).sort()).toEqual(['quarto', 'sala'])
    expect(dup(s)).toEqual([])
    expect(s.levels[0].openings).toHaveLength(1)
  })
  it('redimensionar o quarto mantém a parede comum e o resto acompanha', () => {
    let s = applyOps(base(), [{ op: 'addRoom', id: 'quarto', name: 'Quarto', x: 4, z: 0, width: 3, depth: 5 }]).scene
    s = applyOps(s, [{ op: 'resizeRoom', id: 'quarto', width: 5, depth: 3 }]).scene
    expect(dup(s)).toEqual([])
    expect(wallsOfRoom(s.levels[0], 'quarto')).toHaveLength(4)
    expect(wallsOfRoom(s.levels[0], 'sala')).toHaveLength(5)
    s = applyOps(s, [{ op: 'resizeRoom', id: 'quarto', depth: 5 }]).scene
    expect(dup(s)).toEqual([])
    expect(validateSchema(s).errors).toEqual([])
  })
  it('remover um ambiente deixa a parede comum com o vizinho', () => {
    let s = applyOps(base(), [{ op: 'addRoom', id: 'quarto', name: 'Quarto', x: 4, z: 0, width: 3, depth: 5 }]).scene
    s = applyOps(s, [{ op: 'removeRoom', id: 'quarto' }]).scene
    expect(s.levels[0].walls).toHaveLength(4)
    expect(wallsOfRoom(s.levels[0], 'sala')).toHaveLength(4)
    expect(s.levels[0].walls!.every((w) => wallRoomIds(w).length === 1)).toBe(true)
  })
  it('três ambientes em fila: duas paredes compartilhadas', () => {
    const s = applyOps(base(), [
      { op: 'addRoom', id: 'b', name: 'B', x: 4, z: 0, width: 3, depth: 5 },
      { op: 'addRoom', id: 'c', name: 'C', x: 7, z: 0, width: 3, depth: 5 },
    ]).scene
    expect(s.levels[0].walls).toHaveLength(10)
    expect(dup(s)).toEqual([])
  })
})
