import { useState } from 'react'
import { bbox, polygonArea, resolveMaterial, type Scene } from '../core'
import { fmtArea } from '../lib/units'
import { moods, addRoomAuto, setMood } from '../state/actions'
import { useEditor, type PaintTarget } from '../state/store'
import { Section, Swatch, TextInput, NumInput } from './common'

interface Slot {
  id: PaintTarget
  label: string
  caption: string
  material?: string
}

function slotsOf(scene: Scene): Slot[] {
  const rooms = scene.levels.flatMap((l) => l.rooms ?? [])
  const walls = scene.levels.flatMap((l) => l.walls ?? [])
  const objs = [...scene.levels.flatMap((l) => l.objects ?? []), ...(scene.site?.objects ?? [])]
  const out: Slot[] = []
  if (rooms.length) {
    out.push({ id: 'floors', label: 'Piso', caption: 'Pisos', material: rooms[0].floor?.material })
    out.push({ id: 'wallsInside', label: 'Paredes', caption: 'Paredes internas', material: walls.find((w) => w.finish?.right)?.finish?.right })
    out.push({ id: 'wallsOutside', label: 'Fachada', caption: 'Paredes externas', material: walls.find((w) => w.finish?.left)?.finish?.left })
  }
  if (scene.site) out.push({ id: 'ground', label: 'Solo', caption: 'Solo do terreno', material: scene.site.groundMaterial })
  if (objs.length) {
    out.push({ id: 'furnitureMain', label: 'Móveis', caption: 'Estrutura dos móveis', material: undefined })
    out.push({ id: 'furnitureAccent', label: 'Estofados', caption: 'Estofados e detalhes', material: undefined })
  }
  return out
}

function moodLine(scene: Scene): string {
  const rooms = scene.levels.flatMap((l) => l.rooms ?? [])
  const w = scene.levels.flatMap((l) => l.walls ?? []).find((x) => x.finish?.right)?.finish?.right
  const f = rooms[0]?.floor?.material
  const t = scene.environment?.timeOfDay ?? '12:00'
  const parts: string[] = []
  if (w) parts.push(`paredes ${resolveMaterial(w, scene).name.toLowerCase()}`)
  if (f) parts.push(`piso ${resolveMaterial(f, scene).name.toLowerCase()}`)
  parts.push(`luz das ${t}`)
  return parts.join(', ') + '.'
}

export function LeftPanel() {
  const scene = useEditor((s) => s.scene)
  const paintTarget = useEditor((s) => s.paintTarget)
  const setPaintTarget = useEditor((s) => s.setPaintTarget)
  const dispatch = useEditor((s) => s.dispatch)
  const slots = slotsOf(scene)
  const rooms = scene.levels.flatMap((l) => l.rooms ?? [])
  const total = rooms.reduce((a, r) => a + polygonArea(r.polygon), 0)
  const [w, setW] = useState(4)
  const [d, setD] = useState(3.5)
  const [nm, setNm] = useState('Novo ambiente')

  return (
    <aside className="panel left">
      <div className="intro">
        <TextInput value={scene.name} onCommit={(name) => dispatch([{ op: 'setMeta', patch: { name } }])} label="Projeto" />
        <p className="muted">
          Escolha um material embaixo e clique numa superfície (ou num item do moodboard) para aplicar. {rooms.length > 0 && <>Área interna: <b>{fmtArea(total)}</b>.</>}
        </p>
      </div>

      <div className="moods">
        {moods().map((m) => (
          <button key={m.id} className={'mood' + (scene.environment?.mood === m.id ? ' on' : '')} onClick={() => setMood(m.id)}>
            <strong>{m.name}</strong>
            <small>{m.sub}</small>
          </button>
        ))}
      </div>
      <p className="mood-line">{moodLine(scene)}</p>

      <Section title="Moodboard" right={<small className="muted">clique para escolher</small>}>
        <div className="moodboard">
          {slots.map((s) => (
            <button key={s.id} className={'slot' + (paintTarget === s.id ? ' on' : '')} onClick={() => setPaintTarget(paintTarget === s.id ? null : s.id)} title={s.caption}>
              {s.material ? <Swatch scene={scene} material={s.material} size={52} /> : <span className="swatch ph" style={{ width: 52, height: 52 }}>◦</span>}
              <span className="cap">{s.label}</span>
              <span className="nm">{s.material ? resolveMaterial(s.material, scene).name : 'vários'}</span>
            </button>
          ))}
          {!slots.length && <p className="muted">Crie um ambiente para montar o moodboard.</p>}
        </div>
      </Section>

      <Section title="Novo ambiente">
        <TextInput value={nm} onCommit={setNm} label="Nome" />
        <div className="row">
          <NumInput label="Largura (m)" value={w} onCommit={setW} min={0.5} step={0.1} />
          <NumInput label="Profundidade (m)" value={d} onCommit={setD} min={0.5} step={0.1} />
        </div>
        <div className="row">
          <button className="btn" onClick={() => addRoomAuto(nm, w, d)}>+ Ambiente interno</button>
          <button className="btn ghost" onClick={() => addRoomAuto(nm, w, d, true)}>+ Área externa</button>
        </div>
        {!scene.site && (
          <button className="btn ghost" onClick={() => dispatch([{ op: 'setSite', width: 20, depth: 30 }])}>
            + Terreno 20 × 30 m
          </button>
        )}
        {rooms.length > 0 && (
          <ul className="list">
            {rooms.map((r) => {
              const b = bbox(r.polygon)
              return (
                <li key={r.id}>
                  <button onClick={() => useEditor.getState().select({ kind: 'room', id: r.id })}>
                    {r.name} <small>{b.width.toFixed(2)} × {b.depth.toFixed(2)} m</small>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </aside>
  )
}
