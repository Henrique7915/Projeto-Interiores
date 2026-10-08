import { bbox, getCatalog, getCatalogItem, nameOf, findRoof, findSlabOpening, findAnnotation, findOpening, groupOfObject, resolveMaterial, type Container, type Scene, type SceneObject } from '../core'
import { addLevelAbove, addRoofOver, addStairs } from '../state/actions'
import { activeLevelOf, useEditor } from '../state/store'
import { Icon, LenInput, NumInput, Section, Swatch, TextInput } from './common'

const ROOF_KINDS = [
  { id: 'gable', label: 'Duas águas' },
  { id: 'hip', label: 'Quatro águas' },
  { id: 'shed', label: 'Uma água' },
  { id: 'flat', label: 'Laje plana' },
] as const

/** Seção da esquerda: andar em edição, telhado e escada. */
export function StructureSection() {
  const scene = useEditor((s) => s.scene)
  const activeId = useEditor((s) => s.activeLevel)
  const dispatch = useEditor((s) => s.dispatch)
  const lvl = activeLevelOf(scene, activeId)
  if (!lvl) return null
  const idx = scene.levels.indexOf(lvl)
  return (
    <Section title="Andares, telhado e escada">
      <TextInput label="Andar em edição" value={lvl.name} onCommit={(name) => dispatch([{ op: 'updateLevel', id: lvl.id, patch: { name } }])} />
      <div className="row">
        <LenInput label="Pé-direito" value={lvl.height} min={1.8} onCommit={(height) => dispatch([{ op: 'updateLevel', id: lvl.id, patch: { height } }])} />
        <label className="field">
          <span>Piso a</span>
          <b className="static">{lvl.elevation.toFixed(2).replace('.', ',')} m</b>
        </label>
      </div>
      <div className="row">
        <button className="btn" onClick={addLevelAbove}>
          <Icon name="plus" size={15} /> Andar em cima
        </button>
        {scene.levels.length > 1 && (
          <button className="btn ghost" onClick={() => dispatch([{ op: 'removeLevel', id: lvl.id }])} title="Remove o andar com tudo que há nele (Ctrl+Z desfaz)">
            <Icon name="trash" size={15} /> Remover
          </button>
        )}
      </div>
      <p className="muted small">Telhado sobre {lvl.rooms?.length ? 'o ambiente selecionado (ou todos do andar)' : 'os ambientes do andar'}:</p>
      <div className="chips">
        {ROOF_KINDS.map((k) => (
          <button key={k.id} className="btn ghost" onClick={() => addRoofOver(k.id)}>
            <Icon name="roof" size={15} /> {k.label}
          </button>
        ))}
      </div>
      <p className="muted small">Escada neste andar{idx < scene.levels.length - 1 ? ' (fura o piso do andar de cima)' : ''}:</p>
      <div className="chips">
        <button className="btn ghost" onClick={() => addStairs('stairs/straight')}>
          <Icon name="stairs" size={15} /> Reta
        </button>
        <button className="btn ghost" onClick={() => addStairs('stairs/l-shaped')}>
          <Icon name="stairs" size={15} /> Em L
        </button>
      </div>
    </Section>
  )
}

/** Botões de telhado dentro do painel do ambiente. */
export function RoomRoofButtons({ roomId }: { roomId: string }) {
  const dispatch = useEditor((s) => s.dispatch)
  const setRoofMode = useEditor((s) => s.setRoofMode)
  return (
    <div className="chips">
      {ROOF_KINDS.slice(0, 3).map((k) => (
        <button key={k.id} className="btn ghost" onClick={() => (dispatch([{ op: 'addRoof', kind: k.id, roomId }]), setRoofMode('show'))}>
          <Icon name="roof" size={15} /> {k.label}
        </button>
      ))}
    </div>
  )
}

/** Cortina/persiana de uma janela ou porta. */
export function TreatmentControls({ openingId }: { openingId: string }) {
  const scene = useEditor((s) => s.scene)
  const dispatch = useEditor((s) => s.dispatch)
  const o = findOpening(scene, openingId)?.entity
  if (!o) return null
  const t = o.treatment
  const fabrics = Object.entries(getCatalog().materials ?? {})
    .filter(([id, m]) => id.startsWith('fabric/') || (m as { category?: string }).category === 'fabric')
    .slice(0, 8)
  return (
    <>
      <label className="field wide">
        <span>Cortina ou persiana</span>
        <select value={t?.kind ?? 'none'} onChange={(e) => dispatch([{ op: 'setTreatment', id: openingId, kind: e.target.value as 'none', ...(e.target.value !== 'none' && !t ? { open: 0.6 } : {}) }])}>
          <option value="none">Nenhuma</option>
          <option value="curtain">Cortina</option>
          <option value="sheer">Voal</option>
          <option value="blind">Persiana</option>
          <option value="roller">Rolô</option>
        </select>
      </label>
      {t && (
        <>
          <label className="field wide">
            <span>Aberta: {Math.round((t.open ?? 0) * 100)}%</span>
            <input className="slider" type="range" min={0} max={1} step={0.05} value={t.open ?? 0} onChange={(e) => dispatch([{ op: 'setTreatment', id: openingId, kind: t.kind, open: Number(e.target.value) }])} />
          </label>
          <div className="swatches">
            {fabrics.map(([id]) => (
              <Swatch key={id} scene={scene} material={id} size={26} selected={t.material === id} title={resolveMaterial(id, scene).name} onClick={() => dispatch([{ op: 'setTreatment', id: openingId, kind: t.kind, material: id }])} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

/** Agrupar móveis para mover juntos. */
export function GroupControls({ obj, container }: { obj: SceneObject; container: Container }) {
  const dispatch = useEditor((s) => s.dispatch)
  const g = groupOfObject(container, obj.id)
  const others = (container.objects ?? []).filter((o) => o.id !== obj.id && !o.hidden)
  if (g)
    return (
      <div className="row">
        <span className="muted">
          <Icon name="group" size={14} /> Grupo{g.name ? ` “${g.name}”` : ''} com {g.objectIds.length - 1} {g.objectIds.length === 2 ? 'item' : 'itens'}: mover um move todos.
        </span>
        <button className="btn ghost" onClick={() => dispatch([{ op: 'ungroup', id: g.id }])}>
          Desfazer grupo
        </button>
      </div>
    )
  if (!others.length) return null
  return (
    <label className="field wide">
      <span>Mover junto com…</span>
      <select
        value=""
        onChange={(e) => {
          const other = others.find((o) => o.id === e.target.value)
          if (!other) return
          const og = groupOfObject(container, other.id)
          dispatch([{ op: 'groupObjects', objectIds: [obj.id, ...(og ? og.objectIds : [other.id])] }])
        }}
      >
        <option value="">Agrupar com outro móvel</option>
        {others.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name ?? (getCatalogItem(o.catalogId) ? nameOf(getCatalogItem(o.catalogId)!.name) : o.catalogId)}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Painéis de telhado, vão de escada e cota/texto. */
export function ExtraInspector({ scene }: { scene: Scene }) {
  const sel = useEditor((s) => s.selection)
  const dispatch = useEditor((s) => s.dispatch)
  const select = useEditor((s) => s.select)
  if (!sel) return null
  const remove = (op: 'removeRoof' | 'removeSlabOpening' | 'removeAnnotation', id: string) => (
    <button
      className="btn danger"
      onClick={() => {
        dispatch([{ op, id }])
        select(null)
      }}
    >
      <Icon name="trash" size={16} /> Remover
    </button>
  )

  if (sel.kind === 'roof') {
    const r = findRoof(scene, sel.id)?.entity
    if (!r) return null
    const patch = (p: Record<string, unknown>) => dispatch([{ op: 'updateRoof', id: r.id, patch: p as never }])
    const b = bbox(r.polygon)
    return (
      <Section title="Telhado">
        <label className="field wide">
          <span>Tipo</span>
          <select value={r.kind} onChange={(e) => patch({ kind: e.target.value })}>
            {ROOF_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        {r.kind !== 'flat' && (
          <div className="row">
            <NumInput label="Inclinação" suffix="°" value={r.pitchDeg ?? 30} min={0} max={70} step={5} onCommit={(pitchDeg) => patch({ pitchDeg })} />
            <label className="field">
              <span>Cumeeira</span>
              <select value={(r.ridgeDeg ?? 0) % 180 === 0 ? 0 : 90} onChange={(e) => patch({ ridgeDeg: Number(e.target.value) })}>
                <option value={0}>Ao longo de X</option>
                <option value={90}>Ao longo de Z</option>
              </select>
            </label>
          </div>
        )}
        <div className="row">
          <LenInput label="Beiral" value={r.overhang ?? 0.4} min={0} onCommit={(overhang) => patch({ overhang })} />
          <LenInput label="Altura da base" value={r.baseHeight ?? 0} min={0} onCommit={(baseHeight) => patch({ baseHeight })} />
        </div>
        <p className="muted">
          {b.width.toFixed(2)} × {b.depth.toFixed(2)} m. Escolha o material na paleta (Outros → telhas).
        </p>
        <div className="row">
          <Swatch scene={scene} material={r.material} size={36} />
          <span className="muted">{resolveMaterial(r.material, scene).name}</span>
        </div>
        {remove('removeRoof', r.id)}
      </Section>
    )
  }

  if (sel.kind === 'slab') {
    const so = findSlabOpening(scene, sel.id)?.entity
    if (!so) return null
    const b = bbox(so.polygon)
    const rect = (x0: number, z0: number, w: number, d: number): [number, number][] => [[x0, z0], [x0 + w, z0], [x0 + w, z0 + d], [x0, z0 + d]]
    const patch = (p: Record<string, unknown>) => dispatch([{ op: 'updateSlabOpening', id: so.id, patch: p as never }])
    return (
      <Section title="Vão no piso (escada)">
        <div className="row">
          <LenInput label="Largura" value={b.width} min={0.4} onCommit={(w) => patch({ polygon: rect(b.minX, b.minZ, w, b.depth) })} />
          <LenInput label="Profundidade" value={b.depth} min={0.4} onCommit={(d) => patch({ polygon: rect(b.minX, b.minZ, b.width, d) })} />
        </div>
        <div className="row">
          <LenInput label="X" value={b.minX} onCommit={(x) => patch({ polygon: rect(x, b.minZ, b.width, b.depth) })} />
          <LenInput label="Z" value={b.minZ} onCommit={(z) => patch({ polygon: rect(b.minX, z, b.width, b.depth) })} />
        </div>
        <label className="check">
          <input type="checkbox" checked={so.railing ?? false} onChange={(e) => patch({ railing: e.target.checked })} /> Guarda-corpo em volta
        </label>
        <p className="muted">Ponha a escada no andar de baixo, embaixo deste vão.</p>
        {remove('removeSlabOpening', so.id)}
      </Section>
    )
  }

  if (sel.kind === 'annotation') {
    const a = findAnnotation(scene, sel.id)?.entity
    if (!a) return null
    const patch = (p: Record<string, unknown>) => dispatch([{ op: 'updateAnnotation', id: a.id, patch: p as never }])
    return (
      <Section title={a.kind === 'dimension' ? 'Cota' : 'Texto'}>
        <TextInput label={a.kind === 'dimension' ? 'Texto (vazio = medida)' : 'Texto'} value={a.text ?? ''} onCommit={(text) => patch({ text: text || undefined })} />
        {a.kind === 'dimension' && <LenInput label="Afastamento da linha" value={a.offset ?? 0.4} onCommit={(offset) => patch({ offset })} />}
        {remove('removeAnnotation', a.id)}
      </Section>
    )
  }
  return null
}
