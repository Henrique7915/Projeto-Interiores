import { getCatalogItem, nameOf, resolveMaterial } from './catalog'
import { bbox, overlapDepth, pointInPolygon, polygonArea, polygonPerimeter, round, wallLength } from './geometry'
import { allContainers, objectCorners, objectDims, objectMaterials, wallRoomId } from './model'
import type { Scene, SceneObject } from './schema'

export interface Issue {
  severity: 'erro' | 'aviso'
  type: 'sobreposicao' | 'fora-do-ambiente' | 'passagem-estreita'
  message: string
  ids: string[]
}

const label = (o: SceneObject) => o.name ?? (getCatalogItem(o.catalogId) ? nameOf(getCatalogItem(o.catalogId)!.name) : o.catalogId)
const isFlat = (o: SceneObject) => getCatalogItem(o.catalogId)?.category === 'rug'
const isFloorObject = (o: SceneObject) => o.position[1] < 0.3 && !o.mount?.match(/wall|ceiling|surface/) && !isFlat(o)

/** Checagens geométricas para o usuário e para a IA conferir o que montou (além da validação do schema). */
export function analyzeScene(scene: Scene): Issue[] {
  const issues: Issue[] = []
  for (const { c } of allContainers(scene)) {
    const objs = (c.objects ?? []).filter(isFloorObject)
    for (let a = 0; a < objs.length; a++)
      for (let b = a + 1; b < objs.length; b++) {
        const depth = overlapDepth(objectCorners(objs[a]), objectCorners(objs[b]))
        if (depth > 0.05) issues.push({ severity: depth > 0.15 ? 'erro' : 'aviso', type: 'sobreposicao', message: `"${label(objs[a])}" e "${label(objs[b])}" se sobrepõem em ~${Math.round(depth * 100)} cm.`, ids: [objs[a].id, objs[b].id] })
      }
  }
  for (const l of scene.levels) {
    if (!(l.rooms ?? []).length) continue
    for (const o of (l.objects ?? []).filter(isFloorObject)) {
      if (!(l.rooms ?? []).some((r) => pointInPolygon([o.position[0], o.position[2]], r.polygon)))
        issues.push({ severity: 'aviso', type: 'fora-do-ambiente', message: `"${label(o)}" está fora de qualquer ambiente (${round(o.position[0], 2)}, ${round(o.position[2], 2)}).`, ids: [o.id] })
    }
  }
  return issues
}

/** Resumo em pt-BR da cena, com medidas, para a IA entender o estado atual. */
export function describeScene(scene: Scene): string {
  const L: string[] = []
  L.push(`Projeto "${scene.name}" (id ${scene.id}). Unidades: metros; X→leste, Z→sul (planta); Y para cima. rotationDeg anti-horário visto de cima; frente do modelo = +Z quando 0.`)
  const env = scene.environment
  if (env) L.push(`Ambiente: ${env.timeOfDay ?? '—'}, céu ${env.sky ?? 'clear'}, clima "${env.mood ?? '—'}", luzes internas ${env.interiorLights ?? 'auto'}.`)
  for (const lvl of scene.levels) {
    L.push(`# Andar "${lvl.name}" [${lvl.id}] elevação ${lvl.elevation} m, pé-direito ${lvl.height} m`)
    const rooms = lvl.rooms ?? []
    const total = rooms.reduce((s, r) => s + polygonArea(r.polygon), 0)
    if (total) L.push(`Área total dos ambientes: ${round(total, 2)} m².`)
    for (const r of rooms) {
      const b = bbox(r.polygon)
      L.push(`• ambiente "${r.name}" [${r.id}]${r.type ? ` (${r.type})` : ''}: ${round(b.width, 2)} × ${round(b.depth, 2)} m, área ${round(polygonArea(r.polygon), 2)} m², perímetro ${round(polygonPerimeter(r.polygon), 2)} m, de (${round(b.minX, 2)}, ${round(b.minZ, 2)}) a (${round(b.maxX, 2)}, ${round(b.maxZ, 2)}), piso ${resolveMaterial(r.floor?.material, scene).name} [${r.floor?.material ?? '—'}]`)
    }
  }
  for (const { key, c } of allContainers(scene)) {
    if (key === 'site') {
      const s = scene.site!
      L.push(`# Terreno (site)${s.boundary ? ` limites ${JSON.stringify(s.boundary)}` : ''}, solo ${s.groundMaterial ?? 'ground/grass'}`)
      for (const z of s.zones ?? []) L.push(`• zona ${z.kind} "${z.name ?? z.id}" [${z.id}]: ${round(polygonArea(z.polygon), 2)} m², ${JSON.stringify(z.polygon)}, material ${z.material ?? '—'}${z.depth ? `, profundidade ${z.depth} m` : ''}`)
    }
    for (const w of c.walls ?? []) {
      const ops = (c.openings ?? []).filter((o) => o.wallId === w.id)
      L.push(`• parede ${w.kind ?? 'solid'} [${w.id}]${wallRoomId(w) ? ` (do ambiente ${wallRoomId(w)})` : ''}: (${round(w.start[0], 2)}, ${round(w.start[1], 2)}) → (${round(w.end[0], 2)}, ${round(w.end[1], 2)}), ${round(wallLength(w), 2)} m, esp ${w.thickness ?? 0.15}, h ${w.height ?? '—'}, esquerda ${w.finish?.left ?? '—'}, direita ${w.finish?.right ?? '—'}` + (ops.length ? `; aberturas: ${ops.map((o) => `${o.kind} [${o.id}] centro a ${round(o.offset, 2)} m, ${o.width}×${o.height}${o.sill ? `, peitoril ${o.sill}` : ''}`).join('; ')}` : ''))
    }
    for (const o of c.objects ?? []) {
      const d = objectDims(o)
      const m = objectMaterials(o)
      L.push(`• ${label(o)} [${o.id}] ${o.catalogId}: centro da base (${round(o.position[0], 2)}, ${round(o.position[1], 2)}, ${round(o.position[2], 2)}), rot ${round(o.rotationDeg ?? 0, 0)}°, ${d.width} × ${d.height} × ${d.depth} m (L×A×P), ${Object.entries(m).map(([k, v]) => `${k}=${v}`).join(', ')}`)
    }
  }
  const issues = analyzeScene(scene)
  if (issues.length) L.push('Problemas detectados:\n' + issues.map((x) => `  - [${x.severity}] ${x.message}`).join('\n'))
  return L.join('\n')
}
