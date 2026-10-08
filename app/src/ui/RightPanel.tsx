import { bbox, findObject, findOpening, findRoom, findWall, findZone, getCatalogItem, hoursToTime, nameOf, objectDims, objectMaterials, polygonArea, resolveMaterial, timeToHours, wallLength, wallsOfRoom, type Scene } from '../core'
import { fmtArea } from '../lib/units'
import { useEditor } from '../state/store'
import { Icon, LenInput, NumInput, Section, Swatch, TextInput } from './common'
import { ExtraInspector, GroupControls, RoomRoofButtons, TreatmentControls } from './Structure'

const PRESETS = [
  { id: 'morning', label: 'Manhã', t: 7.6, icon: 'sunrise' },
  { id: 'midday', label: 'Meio-dia', t: 12.8, icon: 'sun' },
  { id: 'evening', label: 'Tarde', t: 18.5, icon: 'lamp' },
  { id: 'night', label: 'Noite', t: 22.2, icon: 'moon' },
]

export function RightPanel() {
  const scene = useEditor((s) => s.scene)
  const dispatch = useEditor((s) => s.dispatch)
  const sel = useEditor((s) => s.selection)
  const hours = timeToHours(scene.environment?.timeOfDay)
  const set = (h: number) => dispatch([{ op: 'setEnvironment', patch: { timeOfDay: hoursToTime(h) } }], { gesture: false })
  const active = PRESETS.reduce((best, p) => (Math.abs(p.t - hours) < Math.abs(best.t - hours) ? p : best), PRESETS[0])

  return (
    <aside className="panel right">
      <Section title="Luz do dia" right={<b className="clock">{hoursToTime(hours)}</b>}>
        <div className="daylight">
          {PRESETS.map((p) => (
            <button key={p.id} className={'dl' + (Math.abs(p.t - hours) < 1.2 && active.id === p.id ? ' on' : '')} onClick={() => set(p.t)}>
              <Icon name={p.icon} size={22} />
              <span>
                {p.label}
                <small>{hoursToTime(p.t)}</small>
              </span>
            </button>
          ))}
        </div>
        <input className="slider" type="range" min={0} max={24} step={0.05} value={hours} onChange={(e) => set(Number(e.target.value))} aria-label="Hora do dia" />
        <div className="row">
          <label className="field">
            <span>Céu</span>
            <select value={scene.environment?.sky ?? 'clear'} onChange={(e) => dispatch([{ op: 'setEnvironment', patch: { sky: e.target.value as 'clear' } }])}>
              <option value="clear">Limpo</option>
              <option value="partly-cloudy">Parcial</option>
              <option value="overcast">Nublado</option>
            </select>
          </label>
          <label className="field">
            <span>Luzes internas</span>
            <select value={scene.environment?.interiorLights ?? 'auto'} onChange={(e) => dispatch([{ op: 'setEnvironment', patch: { interiorLights: e.target.value as 'on' } }])}>
              <option value="auto">Automático</option>
              <option value="on">Ligadas</option>
              <option value="off">Desligadas</option>
            </select>
          </label>
        </div>
      </Section>
      {sel ? <Inspector scene={scene} /> : <p className="muted pad">Clique em algo na planta ou no 3D para ver e editar as medidas.</p>}
    </aside>
  )
}

function Inspector({ scene }: { scene: Scene }) {
  const sel = useEditor((s) => s.selection)!
  const dispatch = useEditor((s) => s.dispatch)
  const select = useEditor((s) => s.select)
  const objectSlot = useEditor((s) => s.objectSlot)
  const setObjectSlot = useEditor((s) => s.setObjectSlot)
  const del = (op: 'removeRoom' | 'removeWall' | 'removeOpening' | 'removeObject' | 'removeZone', id: string) => {
    dispatch([{ op, id } as never])
    select(null)
  }
  const Delete = ({ op, id }: { op: Parameters<typeof del>[0]; id: string }) => (
    <button className="btn danger" onClick={() => del(op, id)}>
      <Icon name="trash" size={16} /> Remover
    </button>
  )

  if (sel.kind === 'room') {
    const r = findRoom(scene, sel.id)
    if (!r) return null
    const b = bbox(r.entity.polygon)
    const rect = r.entity.polygon.length === 4
    return (
      <Section title="Ambiente">
        <TextInput label="Nome" value={r.entity.name} onCommit={(name) => dispatch([{ op: 'updateRoom', id: sel.id, patch: { name } }])} />
        {rect ? (
          <>
            <div className="row">
              <LenInput label="Largura" value={b.width} min={0.5} onCommit={(width) => dispatch([{ op: 'resizeRoom', id: sel.id, width }])} />
              <LenInput label="Profundidade" value={b.depth} min={0.5} onCommit={(depth) => dispatch([{ op: 'resizeRoom', id: sel.id, depth }])} />
            </div>
            <div className="row">
              <LenInput label="Posição X" value={b.minX} onCommit={(x) => dispatch([{ op: 'moveRoom', id: sel.id, dx: x - b.minX, dz: 0 }])} />
              <LenInput label="Posição Z" value={b.minZ} onCommit={(z) => dispatch([{ op: 'moveRoom', id: sel.id, dx: 0, dz: z - b.minZ }])} />
            </div>
          </>
        ) : (
          <p className="muted">Polígono de {r.entity.polygon.length} lados.</p>
        )}
        <p className="muted">Área {fmtArea(polygonArea(r.entity.polygon))} · {wallsOfRoom(r.container, sel.id).length} paredes</p>
        <div className="row">
          <Swatch scene={scene} material={r.entity.floor?.material} size={40} />
          <span className="muted">Piso: {resolveMaterial(r.entity.floor?.material, scene).name}. Escolha outro na paleta.</span>
        </div>
        <p className="muted small">Telhado sobre este ambiente:</p>
        <RoomRoofButtons roomId={sel.id} />
        <Delete op="removeRoom" id={sel.id} />
      </Section>
    )
  }

  if (sel.kind === 'zone') {
    const z = findZone(scene, sel.id)
    if (!z) return null
    const b = bbox(z.entity.polygon)
    return (
      <Section title={`Zona (${z.entity.kind})`}>
        <TextInput label="Nome" value={z.entity.name ?? ''} onCommit={(name) => dispatch([{ op: 'updateZone', id: sel.id, patch: { name } }])} />
        {z.entity.polygon.length === 4 && (
          <div className="row">
            <LenInput label="Largura" value={b.width} min={0.3} onCommit={(w) => dispatch([{ op: 'updateZone', id: sel.id, patch: { polygon: [[b.minX, b.minZ], [b.minX + w, b.minZ], [b.minX + w, b.maxZ], [b.minX, b.maxZ]] } }])} />
            <LenInput label="Profundidade" value={b.depth} min={0.3} onCommit={(d) => dispatch([{ op: 'updateZone', id: sel.id, patch: { polygon: [[b.minX, b.minZ], [b.maxX, b.minZ], [b.maxX, b.minZ + d], [b.minX, b.minZ + d]] } }])} />
          </div>
        )}
        {z.entity.kind === 'pool' && <LenInput label="Profundidade da água" value={z.entity.depth ?? 1.4} min={0.3} onCommit={(poolDepth) => dispatch([{ op: 'updateZone', id: sel.id, patch: { poolDepth } }])} />}
        <LenInput label="Elevação" value={z.entity.elevation ?? 0} onCommit={(elevation) => dispatch([{ op: 'updateZone', id: sel.id, patch: { elevation } }])} />
        <p className="muted">Área {fmtArea(polygonArea(z.entity.polygon))}</p>
        <Delete op="removeZone" id={sel.id} />
      </Section>
    )
  }

  if (sel.kind === 'wall') {
    const w = findWall(scene, sel.id)
    if (!w) return null
    const len = wallLength(w.entity)
    const s = w.entity
    return (
      <Section title="Parede">
        <div className="row">
          <LenInput
            label="Comprimento"
            value={len}
            min={0.1}
            onCommit={(L) => {
              const k = L / len
              dispatch([{ op: 'updateWall', id: s.id, patch: { end: [s.start[0] + (s.end[0] - s.start[0]) * k, s.start[1] + (s.end[1] - s.start[1]) * k] } }])
            }}
          />
          <LenInput label="Espessura" value={s.thickness ?? 0.15} min={0.02} onCommit={(thickness) => dispatch([{ op: 'updateWall', id: s.id, patch: { thickness } }])} />
        </div>
        <LenInput label="Altura" value={s.height ?? (w.container as { height?: number }).height ?? 2.7} min={0.3} onCommit={(height) => dispatch([{ op: 'updateWall', id: s.id, patch: { height } }])} />
        <div className="row faces">
          <button className="face" onClick={() => select({ kind: 'wall', id: s.id, side: 'left' })} data-on={sel.side === 'left'}>
            <Swatch scene={scene} material={s.finish?.left} size={28} /> Esquerda
          </button>
          <button className="face" onClick={() => select({ kind: 'wall', id: s.id, side: 'right' })} data-on={sel.side === 'right'}>
            <Swatch scene={scene} material={s.finish?.right} size={28} /> Direita
          </button>
        </div>
        <p className="muted">A paleta pinta a face escolhida (ou as duas).</p>
        <div className="row">
          {(['door', 'window'] as const).map((k) => (
            <button key={k} className="btn ghost" onClick={() => dispatch([{ op: 'addOpening', wallId: s.id, kind: k, offset: len / 2 }])}>
              + {k === 'door' ? 'Porta' : 'Janela'}
            </button>
          ))}
        </div>
        <Delete op="removeWall" id={s.id} />
      </Section>
    )
  }

  if (sel.kind === 'opening') {
    const o = findOpening(scene, sel.id)
    if (!o) return null
    const wall = findWall(scene, o.entity.wallId)
    return (
      <Section title="Abertura">
        <label className="field wide">
          <span>Tipo</span>
          <select value={o.entity.kind} onChange={(e) => dispatch([{ op: 'updateOpening', id: sel.id, patch: { kind: e.target.value as 'door' } }])}>
            {['door', 'double-door', 'sliding-door', 'garage-door', 'window', 'sliding-window', 'fixed-window', 'passage'].map((k) => (
              <option key={k} value={k}>{OPENING_LABEL[k]}</option>
            ))}
          </select>
        </label>
        <div className="row">
          <LenInput label="Largura" value={o.entity.width} min={0.3} onCommit={(width) => dispatch([{ op: 'updateOpening', id: sel.id, patch: { width } }])} />
          <LenInput label="Altura" value={o.entity.height} min={0.3} onCommit={(height) => dispatch([{ op: 'updateOpening', id: sel.id, patch: { height } }])} />
        </div>
        <div className="row">
          <LenInput label="Peitoril" value={o.entity.sill ?? 0} min={0} onCommit={(sill) => dispatch([{ op: 'updateOpening', id: sel.id, patch: { sill } }])} />
          <LenInput label="Posição (centro)" value={o.entity.offset} onCommit={(offset) => dispatch([{ op: 'updateOpening', id: sel.id, patch: { offset } }])} />
        </div>
        {wall && <p className="muted">Parede de {wallLength(wall.entity).toFixed(2)} m</p>}
        <TreatmentControls openingId={sel.id} />
        <Delete op="removeOpening" id={sel.id} />
      </Section>
    )
  }

  if (sel.kind === 'object') {
    const o = findObject(scene, sel.id)
    if (!o) return null
    const e = o.entity
    const d = objectDims(e)
    const cat = getCatalogItem(e.catalogId)
    const mats = objectMaterials(e)
    const slotKeys = Object.keys(mats)
    const slotCur = objectSlot || slotKeys[0]
    const patch = (p: Record<string, unknown>) => dispatch([{ op: 'updateObject', id: e.id, patch: p as never }], { gesture: false })
    return (
      <Section title={cat ? nameOf(cat.name) : 'Objeto'}>
        <TextInput label="Nome" value={e.name ?? ''} placeholder={cat ? nameOf(cat.name) : ''} onCommit={(name) => patch({ name })} />
        <div className="row">
          <LenInput label="Largura" value={d.width} min={0.02} onCommit={(width) => patch({ dimensions: { ...d, width } })} />
          <LenInput label="Altura" value={d.height} min={0.01} onCommit={(height) => patch({ dimensions: { ...d, height } })} />
          <LenInput label="Prof." value={d.depth} min={0.02} onCommit={(depth) => patch({ dimensions: { ...d, depth } })} />
        </div>
        <div className="row">
          <LenInput label="X" value={e.position[0]} onCommit={(x) => patch({ x })} />
          <LenInput label="Z" value={e.position[2]} onCommit={(z) => patch({ z })} />
          <LenInput label="Altura da base" value={e.position[1]} min={0} onCommit={(y) => patch({ y })} />
        </div>
        <div className="row">
          <NumInput label="Rotação" suffix="°" value={e.rotationDeg ?? 0} step={15} min={-360} max={360} onCommit={(rotationDeg) => patch({ rotationDeg })} />
          <button className="btn ghost" onClick={() => patch({ rotationDeg: (e.rotationDeg ?? 0) + 90 })}>
            <Icon name="rotate" size={16} /> +90°
          </button>
          {cat && (
            <button className="btn ghost" onClick={() => patch({ dimensions: { ...cat.dimensions } })} title="Voltar às medidas do catálogo">
              Medidas padrão
            </button>
          )}
        </div>
        <div className="slots">
          {slotKeys.map((k) => (
            <button key={k} className={'slotbtn' + (k === slotCur ? ' on' : '')} onClick={() => setObjectSlot(k)} title="A paleta aplica neste item">
              <Swatch scene={scene} material={mats[k]} size={30} />
              <span>{cat?.materialSlots?.[k]?.label ? nameOf(cat.materialSlots[k].label as string) : k}</span>
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => dispatch([{ op: 'duplicateObject', id: e.id }])}>
            <Icon name="copy" size={16} /> Duplicar
          </button>
          <button className="btn ghost" onClick={() => patch({ locked: !e.locked })}>{e.locked ? 'Destravar' : 'Travar'}</button>
        </div>
        <GroupControls obj={e} container={o.container} />
        <Delete op="removeObject" id={e.id} />
      </Section>
    )
  }

  if (sel.kind === 'roof' || sel.kind === 'slab' || sel.kind === 'annotation') return <ExtraInspector scene={scene} />

  return (
    <Section title="Terreno">
      <p className="muted">{scene.site?.boundary ? 'Escolha um solo na paleta (Outros) para o terreno.' : 'Sem terreno.'}</p>
    </Section>
  )
}

const OPENING_LABEL: Record<string, string> = {
  door: 'Porta',
  'double-door': 'Porta dupla',
  'sliding-door': 'Porta de correr',
  'garage-door': 'Portão de garagem',
  window: 'Janela',
  'sliding-window': 'Janela de correr',
  'fixed-window': 'Janela fixa',
  passage: 'Passagem',
}
