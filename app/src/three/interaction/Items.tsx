import { memo, useEffect, useMemo, useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Point2 as Vec2, Point3 as Vec3 } from '../../../../schema/types'
import type { ObjectPatch, ScenePick, RObject, RWall } from '../render/types'
import { FurnitureModel } from '../furniture/FurnitureModel'
import { useLampLevel } from '../lighting/Lighting'
import { wallDir, wallLength, wallNormalRight } from '../geometry/walls'

interface Props {
  objects: RObject[]
  walls: RWall[]
  /** retângulo (x0, z0, x1, z1) onde o centro do móvel pode ficar */
  bounds: [number, number, number, number]
  selectedId: string | null
  /** luzes internas: auto segue a hora; on/off forçam */
  interiorLights: 'auto' | 'on' | 'off'
  onPick?: (p: ScenePick | null) => void
  onDragEnd?: (id: string, patch: ObjectPatch) => void
  snap?: number
  lowQuality?: boolean
}

/** metade da extensão de um retângulo rotacionado projetada num eixo unitário */
function halfExtentAlong(size: Vec3, rotY: number, axis: Vec2) {
  const c = Math.cos(rotY), s = Math.sin(rotY)
  // eixos locais x e z no mundo
  const ax: Vec2 = [c, -s], az: Vec2 = [s, c]
  return (size[0] / 2) * Math.abs(ax[0] * axis[0] + ax[1] * axis[1]) + (size[2] / 2) * Math.abs(az[0] * axis[0] + az[1] * axis[1])
}

/** Cola o móvel na parede quando chega perto (< 8 cm) */
export function snapToWalls(p: Vec2, rotY: number, size: Vec3, walls: RWall[]): Vec2 {
  let [x, z] = p
  for (const w of walls) {
    const L = wallLength(w)
    const d = wallDir(w)
    const n = wallNormalRight(w)
    const rel: Vec2 = [x - w.a[0], z - w.a[1]]
    const along = rel[0] * d[0] + rel[1] * d[1]
    if (along < -0.2 || along > L + 0.2) continue
    const dist = rel[0] * n[0] + rel[1] * n[1] // distância assinada ao eixo da parede
    const reach = halfExtentAlong(size, rotY, n) + w.thickness / 2
    const gap = Math.abs(dist) - reach
    if (gap > -0.15 && gap < 0.08) {
      const sgn = Math.sign(dist) || 1
      const target = sgn * reach
      x += n[0] * (target - dist)
      z += n[1] * (target - dist)
    }
  }
  return [x, z]
}

function SelectionBox({ size }: { size: Vec3 }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(size[0] + 0.04, size[1] + 0.04, size[2] + 0.04)), [size])
  return (
    <lineSegments userData={{ noExport: true }} geometry={geo} position={[0, size[1] / 2, 0]} renderOrder={20}>
      <lineBasicMaterial color="#ffb347" depthTest={false} transparent opacity={0.95} />
    </lineSegments>
  )
}

const ItemNode = memo(function ItemNode({ obj, selected, glow, lowQuality, register, onDown }: {
  obj: RObject
  selected: boolean
  glow: number
  lowQuality?: boolean
  register: (id: string, g: THREE.Group | null) => void
  onDown: (obj: RObject, e: ThreeEvent<PointerEvent>) => void
}) {
  return (
    <group
      ref={(g) => register(obj.id, g)}
      position={obj.position}
      rotation={[0, obj.rotationY, 0]}
      scale={obj.mirror ? [-1, 1, 1] : 1}
      onPointerDown={(e) => onDown(obj, e)}
      onClick={(e) => e.stopPropagation()}
      onPointerOver={() => (document.body.style.cursor = obj.locked ? 'pointer' : 'grab')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <FurnitureModel obj={obj} glow={glow} lowQuality={lowQuality} />
      {selected && <SelectionBox size={obj.size} />}
    </group>
  )
})

export function Items({ objects, walls, bounds, selectedId, interiorLights, onPick, onDragEnd, snap = 0.05, lowQuality }: Props) {
  const { camera, gl, controls } = useThree()
  const groups = useRef(new Map<string, THREE.Group>())
  const lamp = useLampLevel((s) => s.lamp)
  const glow = interiorLights === 'on' ? 1 : interiorLights === 'off' ? 0 : lamp
  const latest = useRef({ walls, bounds, snap, onDragEnd })
  latest.current = { walls, bounds, snap, onDragEnd }

  const register = useMemo(() => (id: string, g: THREE.Group | null) => {
    if (g) groups.current.set(id, g)
    else groups.current.delete(id)
  }, [])

  const cleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => cleanup.current?.(), [])

  const onDown = useMemo(() => (item: RObject, e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.stopPropagation()
    onPick?.({ type: 'object', id: item.id })
    if (item.locked) return
    const g = groups.current.get(item.id)
    if (!g) return

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -item.position[1])
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const hit = new THREE.Vector3()
    const rayAt = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      return ray.ray.intersectPlane(plane, hit)
    }
    const start = rayAt(e.nativeEvent)
    if (!start) return
    const grab: Vec2 = [item.position[0] - start.x, item.position[2] - start.z]
    const down: Vec2 = [e.nativeEvent.clientX, e.nativeEvent.clientY]
    let moved = false
    let last: Vec3 = item.position
    const size = item.size

    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) < 4) return
      if (!moved) {
        moved = true
        if (controls) (controls as unknown as { enabled: boolean }).enabled = false
        document.body.style.cursor = 'grabbing'
      }
      const p = rayAt(ev)
      if (!p) return
      const { snap: s, bounds: b, walls: ws } = latest.current
      let x = p.x + grab[0], z = p.z + grab[1]
      if (s > 0) { x = Math.round(x / s) * s; z = Math.round(z / s) * s }
      if (item.mount === 'floor' || item.mount === 'surface') [x, z] = snapToWalls([x, z], item.rotationY, size, ws)
      x = THREE.MathUtils.clamp(x, b[0], b[2])
      z = THREE.MathUtils.clamp(z, b[1], b[3])
      last = [x, item.position[1], z]
      g.position.set(...last)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      cleanup.current = null
      document.body.style.cursor = ''
      if (controls) (controls as unknown as { enabled: boolean }).enabled = true
      if (moved) latest.current.onDragEnd?.(item.id, { position: last })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    cleanup.current = up
  }, [camera, gl, controls, onPick])

  return (
    <group>
      {objects.filter((o) => !o.hidden).map((o) => (
        <ItemNode key={o.id} obj={o} selected={o.id === selectedId} glow={glow} lowQuality={lowQuality} register={register} onDown={onDown} />
      ))}
    </group>
  )
}
