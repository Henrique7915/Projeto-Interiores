import { useMemo, useState } from 'react'
import { CATEGORY_LABEL, MATERIAL_GROUPS, getCatalog, listMaterials, nameOf, resolveMaterial, type CatalogItem } from '../core'
import { addFurniture, applyMaterial } from '../state/actions'
import { useCatalogVersion } from '../state/hooks'
import { useEditor } from '../state/store'
import { Swatch } from './common'

type Tab = string

export function BottomPalette() {
  const scene = useEditor((s) => s.scene)
  const sel = useEditor((s) => s.selection)
  const [tab, setTab] = useState<Tab>('wood')
  const [cat, setCat] = useState<string>('all')
  const v = useCatalogVersion()
  const materials = useMemo(() => listMaterials(scene), [scene.materials, v])
  const items = useMemo(() => getCatalog().items, [v])
  const group = MATERIAL_GROUPS.find((g) => g.id === tab)
  const shown = group ? materials.filter((m) => group.categories.includes(m.category)) : []
  const cats = useMemo(() => [...new Set(items.map((i) => i.category))], [items])
  const furn: CatalogItem[] = items.filter((i) => cat === 'all' || i.category === cat)
  const current = sel?.kind === 'object' ? undefined : undefined
  void current

  return (
    <div className="palette">
      <div className="tabs">
        {MATERIAL_GROUPS.map((g) => (
          <button key={g.id} className={tab === g.id ? 'on' : ''} onClick={() => setTab(g.id)}>
            {g.label}
          </button>
        ))}
        <span className="sep" />
        <button className={tab === 'furniture' ? 'on' : ''} onClick={() => setTab('furniture')}>
          Móveis
        </button>
      </div>
      {tab !== 'furniture' ? (
        <div className="strip">
          {shown.map((m) => (
            <div key={m.ref} className="chip" onClick={() => applyMaterial(m.ref)}>
              <Swatch scene={scene} material={m.ref} size={56} title={m.name} />
              <span>{m.name}</span>
            </div>
          ))}
          {!shown.length && <p className="muted">Sem materiais nesta categoria.</p>}
        </div>
      ) : (
        <>
          <div className="cats">
            <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>Todos</button>
            {cats.map((c) => (
              <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
                {CATEGORY_LABEL[c] ?? c}
              </button>
            ))}
          </div>
          <div className="strip">
            {furn.map((i) => (
              <div key={i.id} className="chip furn" onClick={() => addFurniture(i.id)} title={`${nameOf(i.name)} — ${i.dimensions.width} × ${i.dimensions.depth} × ${i.dimensions.height} m`}>
                <span className="thumb" style={{ background: resolveMaterial(i.materialSlots ? Object.values(i.materialSlots)[0]?.default : undefined, scene).color }}>
                  {i.thumbnail ? <img src={`./assets/${i.thumbnail}`} alt="" /> : <b>{nameOf(i.name).slice(0, 2)}</b>}
                </span>
                <span>{nameOf(i.name)}</span>
                <small>{i.dimensions.width}×{i.dimensions.depth}</small>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
