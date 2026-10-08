import { getCatalog, nameOf, timeToHours, bbox, encodeShare, findObject, findWall, getCatalogItem, getContainer, hoursToTime, objectMaterials, parseScene, roomAt, sceneToJson, slotNames, type OpInput, type Scene, type Selection } from '../core'
import { activeLevelOf, useEditor } from './store'
import { download, toast } from '../ui/common'

/** Posição razoável para um item novo: centro do ambiente selecionado/primeiro; senão perto da origem. */
export function suggestPosition(scene: Scene, sel: Selection, exterior = false): [number, number] {
  const lvl = activeLevelOf(scene, useEditor.getState().activeLevel)
  const levels = lvl ? [lvl] : scene.levels
  if (sel && (sel.kind === 'room' || sel.kind === 'object')) {
    if (sel.kind === 'room') for (const l of levels) { const r = l.rooms?.find((x) => x.id === sel.id); if (r) { const b = bbox(r.polygon); return [b.minX + b.width / 2, b.minZ + b.depth / 2] } }
    if (sel.kind === 'object') { const o = findObject(scene, sel.id); if (o) return [o.entity.position[0] + 0.6, o.entity.position[2] + 0.6] }
  }
  if (!exterior) {
    const r = levels[0]?.rooms?.[0]
    if (r) { const b = bbox(r.polygon); return [b.minX + b.width / 2, b.minZ + b.depth / 2] }
  }
  if (scene.site?.boundary) { const b = bbox(scene.site.boundary); return [b.minX + b.width / 2, b.minZ + b.depth / 2] }
  return [2, 2]
}

export function addFurniture(catalogId: string) {
  const { scene, selection, dispatch } = useEditor.getState()
  const cat = getCatalogItem(catalogId)
  if (!cat) return toast('Item não encontrado no catálogo', 'err')
  const [x, z] = suggestPosition(scene, selection, cat.category === 'outdoor' || cat.category === 'plant')
  const exterior = cat.category === 'outdoor' || cat.category === 'plant'
  const lvl = activeLevelOf(scene, useEditor.getState().activeLevel)
  const r = dispatch([{ op: 'addObject', catalogId, x: Math.round(x * 20) / 20, z: Math.round(z * 20) / 20, ...(!exterior && lvl ? { container: lvl.id } : {}) }])
  if (r.errors.length) toast(r.errors[0].message, 'err')
}

/** Aplica um material na seleção atual ou no alvo do moodboard. */
export function applyMaterial(material: string) {
  const { scene, selection: sel, paintTarget, dispatch } = useEditor.getState()
  const ops: OpInput[] = []
  if (sel) {
    if (sel.kind === 'room') ops.push({ op: 'setMaterial', target: { type: 'room', id: sel.id }, material })
    else if (sel.kind === 'wall') ops.push({ op: 'setMaterial', target: { type: 'wall', id: sel.id, side: sel.side ?? 'both' }, material })
    else if (sel.kind === 'object') ops.push({ op: 'setMaterial', target: { type: 'object', id: sel.id, slot: useEditor.getState().objectSlot || undefined }, material })
    else if (sel.kind === 'zone') ops.push({ op: 'setMaterial', target: { type: 'zone', id: sel.id }, material })
    else if (sel.kind === 'roof') ops.push({ op: 'setMaterial', target: { type: 'roof', id: sel.id }, material })
    else if (sel.kind === 'slab' || sel.kind === 'annotation') return toast('Este item não tem material para pintar.', 'err')
    else if (sel.kind === 'opening') ops.push({ op: 'setMaterial', target: { type: 'opening', id: sel.id, slot: 'frame' }, material })
    else ops.push({ op: 'setMaterial', target: { type: 'site' }, material })
  } else if (paintTarget) {
    const rooms = scene.levels.flatMap((l) => l.rooms ?? [])
    if (paintTarget === 'floors') for (const r of rooms) ops.push({ op: 'setMaterial', target: { type: 'room', id: r.id }, material })
    else if (paintTarget === 'wallsInside') for (const r of rooms) ops.push({ op: 'setMaterial', target: { type: 'roomWalls', id: r.id, side: 'inside' }, material })
    else if (paintTarget === 'wallsOutside') for (const r of rooms) ops.push({ op: 'setMaterial', target: { type: 'roomWalls', id: r.id, side: 'outside' }, material })
    else if (paintTarget === 'ground') ops.push({ op: 'setMaterial', target: { type: 'site' }, material })
    else {
      const idx = paintTarget === 'furnitureMain' ? 0 : 1
      for (const c of [...scene.levels, ...(scene.site ? [scene.site] : [])]) for (const o of c.objects ?? []) {
        const slots = slotNames(o)
        if (slots[idx]) ops.push({ op: 'setMaterial', target: { type: 'object', id: o.id, slot: slots[idx] }, material })
      }
    }
  } else return toast('Escolha uma superfície ou objeto (ou um item do moodboard) para aplicar o material.', 'err')
  if (ops.length) {
    const r = dispatch(ops)
    if (r.errors.length) toast(r.errors[0].message, 'err')
  }
}

const MOOD_SUB: Record<string, string> = { cozy: 'luz dourada', bright: 'meio-dia', moody: 'depois de escurecer' }
/** Climas do catálogo oficial (assets/catalog.json): hora do dia, exposição e luzes internas. */
export const moods = () =>
  (getCatalog().moods ?? []).map((m) => {
    const time = m.timeOfDay ?? '12:00'
    return { id: m.id, name: nameOf(m.name), sub: MOOD_SUB[m.id] ?? '', time, exposure: m.exposure, lights: timeToHours(time) >= 17 || timeToHours(time) < 6 ? ('on' as const) : ('off' as const) }
  })
export function setMood(id: string) {
  const m = moods().find((x) => x.id === id)
  if (!m) return
  useEditor.getState().dispatch([{ op: 'setEnvironment', patch: { mood: m.id, timeOfDay: m.time, sky: 'clear', interiorLights: m.lights, ...(m.exposure ? { exposure: m.exposure } : {}) } }])
}

/** Ambiente novo ao lado do que já existe, nas medidas informadas. */
export function addRoomAuto(name: string, width: number, depth: number, exterior = false) {
  const { scene, dispatch } = useEditor.getState()
  let x = 0
  const lvl = activeLevelOf(scene, useEditor.getState().activeLevel)
  const rooms = lvl?.rooms ?? []
  if (rooms.length) x = Math.max(...rooms.map((r) => bbox(r.polygon).maxX)) + 0.0
  dispatch([exterior ? { op: 'addZone', kind: 'deck', name, x, z: 0, width, depth } : { op: 'addRoom', name, x, z: 0, width, depth, ...(lvl ? { container: lvl.id } : {}) }])
}

/* ───── arquivo / link ───── */
export function exportJson() {
  const s = useEditor.getState().scene
  download(`${s.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'projeto'}.design3d.json`, sceneToJson(s))
}
export async function importFile(file: File) {
  try {
    const scene = parseScene(JSON.parse(await file.text()))
    useEditor.getState().setScene(scene)
    toast(`Projeto "${scene.name}" aberto`)
  } catch (e) {
    toast(e instanceof Error ? e.message.split('\n').slice(0, 3).join(' · ') : 'Arquivo inválido', 'err')
  }
}
export async function copyShareLink() {
  const code = await encodeShare(useEditor.getState().scene)
  const url = `${location.origin}${location.pathname}#s=${code}`
  try {
    await navigator.clipboard.writeText(url)
    toast(url.length > 8000 ? 'Link copiado (é grande: prefira exportar o arquivo)' : 'Link copiado!')
  } catch {
    prompt('Copie o link:', url)
  }
}
export { getContainer, findWall, objectMaterials, roomAt }


/* ───── andares, telhado, escada ───── */

/** Andar novo em cima do último; vira o andar em edição. */
export function addLevelAbove() {
  const { scene, dispatch } = useEditor.getState()
  if (!scene.levels.length) return toast('Crie primeiro um ambiente no térreo.', 'err')
  const r = dispatch([{ op: 'addLevel' }])
  if (r.errors.length) toast(r.errors[0].message, 'err')
  else toast('Andar criado. Desenhe os ambientes dele na planta.', 'ok')
}

/** Telhado sobre o ambiente selecionado, ou sobre o conjunto de ambientes do andar em edição. */
export function addRoofOver(kind: 'gable' | 'hip' | 'shed' | 'flat') {
  const { scene, selection, dispatch } = useEditor.getState()
  const lvl = activeLevelOf(scene, useEditor.getState().activeLevel)
  if (!lvl) return toast('Crie um ambiente antes do telhado.', 'err')
  let op: OpInput
  if (selection?.kind === 'room' && findRoomLevel(scene, selection.id)) op = { op: 'addRoof', kind, roomId: selection.id }
  else {
    const rooms = lvl.rooms ?? []
    if (!rooms.length) return toast('Este andar ainda não tem ambientes para cobrir.', 'err')
    const b = bbox(rooms.flatMap((r) => r.polygon))
    op = { op: 'addRoof', kind, levelId: lvl.id, x: b.minX, z: b.minZ, width: b.width, depth: b.depth }
  }
  const r = dispatch([op])
  if (r.errors.length) toast(r.errors[0].message, 'err')
  else useEditor.getState().setRoofMode('show')
}
const findRoomLevel = (scene: Scene, id: string) => scene.levels.some((l) => (l.rooms ?? []).some((r) => r.id === id))

/** Escada reta ou em L no andar em edição + vão no piso do andar de cima (se houver). */
export function addStairs(catalogId: 'stairs/straight' | 'stairs/l-shaped') {
  const { scene, selection, dispatch } = useEditor.getState()
  const lvl = activeLevelOf(scene, useEditor.getState().activeLevel)
  if (!lvl) return toast('Crie um ambiente antes da escada.', 'err')
  const cat = getCatalogItem(catalogId)
  if (!cat) return toast('Escada não encontrada no catálogo.', 'err')
  const [x, z] = suggestPosition(scene, selection)
  const { width, depth } = cat.dimensions
  const above = scene.levels[scene.levels.findIndex((l) => l.id === lvl.id) + 1]
  const ops: OpInput[] = [{ op: 'addObject', catalogId, x: Math.round(x * 20) / 20, z: Math.round(z * 20) / 20, container: lvl.id }]
  if (above) ops.push({ op: 'addSlabOpening', levelId: above.id, x: Math.round((x - width / 2) * 20) / 20, z: Math.round((z - depth / 2) * 20) / 20, width, depth })
  const r = dispatch(ops)
  if (r.errors.length) toast(r.errors[0].message, 'err')
  else if (!above) toast('Escada criada. Crie o andar de cima para furar o piso dele.', 'ok')
}
