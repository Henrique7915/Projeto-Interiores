import { activeLevelOf, useEditor } from '../state/store'
import { addLevelAbove } from '../state/actions'
import { Icon } from './common'

/** Seletor de andar da planta: o mais alto em cima, + para criar um andar novo. */
export function LevelBar() {
  const scene = useEditor((s) => s.scene)
  const activeId = useEditor((s) => s.activeLevel)
  const setActive = useEditor((s) => s.setActiveLevel)
  const active = activeLevelOf(scene, activeId)
  if (!scene.levels.length) return null
  return (
    <div className="level-bar" role="group" aria-label="Andares">
      <button className="lv-add" title="Novo andar em cima" aria-label="Novo andar em cima" onClick={addLevelAbove}>
        <Icon name="plus" size={14} />
      </button>
      {[...scene.levels].reverse().map((l) => (
        <button key={l.id} className={l.id === active?.id ? 'on' : ''} onClick={() => setActive(l.id)} title={`${l.name} · piso a ${l.elevation.toFixed(2).replace('.', ',')} m`}>
          {l.name}
        </button>
      ))}
    </div>
  )
}
