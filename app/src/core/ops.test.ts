import { describe, expect, it } from 'vitest'
import { analyzeScene, applyOps, decodeShare, describeScene, encodeShare, newScene, parseScene, polygonArea, TEMPLATES, validateSchema, wallsOfRoom } from './index'

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
})
