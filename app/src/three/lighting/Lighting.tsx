import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Environment, Lightformer, Line } from '@react-three/drei'
import * as THREE from 'three'
import { create } from 'zustand'
import { atmosphereAt, bodyAt, timeFromRay } from './daylight'

/** Nível das luminárias (0..1), atualizado conforme a hora animada. Lido pelos móveis. */
export const useLampLevel = create<{ lamp: number; set: (v: number) => void }>((set) => ({ lamp: 0, set: (lamp) => set({ lamp }) }))

interface Props {
  /** hora alvo (0..24); a luz anima suavemente até ela */
  time: number
  center: THREE.Vector3
  radius: number
  shadows: boolean
  onTimeChange?: (t: number) => void
  showGizmo?: boolean
  northDeg?: number
  sky?: 'clear' | 'partly-cloudy' | 'overcast'
  exposure?: number
}

const shortest = (from: number, to: number) => {
  let d = (to - from) % 24
  if (d > 12) d -= 24
  if (d < -12) d += 24
  return d
}

export function Lighting({ time, center, radius, shadows, onTimeChange, showGizmo = true, northDeg = 0, sky = 'clear', exposure = 1 }: Props) {
  const { scene, gl } = useThree()
  const sun = useRef<THREE.DirectionalLight>(null!)
  const hemi = useRef<THREE.HemisphereLight>(null!)
  const cur = useRef(time)
  const gizmo = useRef<THREE.Group>(null!)
  const glow = useRef<THREE.Mesh>(null!)
  const dragging = useRef(false)
  const setLamp = useLampLevel((s) => s.set)
  const lastLamp = useRef(-1)
  const R = radius * 2.1

  useEffect(() => {
    scene.background = new THREE.Color('#000')
  }, [scene])

  useFrame((_, dt) => {
    const d = shortest(cur.current, time)
    // durante o arraste seguimos o ponteiro direto; fora dele animamos
    cur.current = dragging.current || Math.abs(d) < 0.001 ? time : (cur.current + d * Math.min(1, dt * 4) + 24) % 24
    const t = cur.current
    const atm = atmosphereAt(t)
    const body = bodyAt(t, northDeg)

    // o astro que ilumina: sol enquanto está acima do horizonte, depois a lua
    const dir = new THREE.Vector3(...body.dir)
    const horizonFade = body.kind === 'sun' ? THREE.MathUtils.smoothstep(body.elevation, 0.0, 0.18) : 1
    sun.current.position.copy(center).addScaledVector(dir, R)
    sun.current.target.position.copy(center)
    sun.current.target.updateMatrixWorld()
    sun.current.color.copy(atm.sun)
    const skyFactor = sky === 'overcast' ? 0.3 : sky === 'partly-cloudy' ? 0.8 : 1
    sun.current.intensity = atm.sunIntensity * skyFactor * (body.kind === 'sun' ? Math.max(horizonFade, 0.25) : 1)

    hemi.current.color.copy(atm.sky)
    hemi.current.groundColor.copy(atm.ground)
    hemi.current.intensity = atm.hemiIntensity * 0.9 * (sky === 'overcast' ? 1.35 : 1)
    ;(scene.background as THREE.Color).copy(atm.bg)
    if (!scene.fog) scene.fog = new THREE.Fog(atm.bg.getHex(), radius * 7, radius * 18)
    ;(scene.fog as THREE.Fog).color.copy(atm.bg)
    scene.environmentIntensity = atm.env * 0.55
    gl.toneMappingExposure = atm.exposure * exposure

    if (Math.abs(atm.lamp - lastLamp.current) > 0.02) {
      lastLamp.current = atm.lamp
      setLamp(atm.lamp)
    }

    if (gizmo.current) {
      gizmo.current.position.copy(center).addScaledVector(dir, R * 0.92)
      glow.current.scale.setScalar(body.kind === 'sun' ? 1 : 0.7)
      ;(glow.current.material as THREE.MeshBasicMaterial).color.set(body.kind === 'sun' ? '#ffd58a' : '#cdd8ff')
    }
  })

  const arc = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const kind = bodyAt(time, northDeg).kind
    const t0 = kind === 'sun' ? 6 : 19.5
    const t1 = kind === 'sun' ? 19.5 : 30
    for (let t = t0; t <= t1 + 0.01; t += 0.25) {
      const b = bodyAt(t, northDeg)
      pts.push(new THREE.Vector3(...b.dir).multiplyScalar(R * 0.92).add(center))
    }
    return pts
    // recalcula só ao trocar entre sol e lua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyAt(time, northDeg).kind, center, R, northDeg])

  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    dragging.current = true
    if (controls) controls.enabled = false
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return
    const t = timeFromRay(e.ray, center, R * 0.92, northDeg)
    onTimeChange?.(Math.round(t * 20) / 20)
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    dragging.current = false
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
  }

  const b = radius * 1.25
  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-b}
        shadow-camera-right={b}
        shadow-camera-top={b}
        shadow-camera-bottom={-b}
        shadow-camera-near={0.5}
        shadow-camera-far={R * 3}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <Environment resolution={128} background={false}>
        <Lightformer form="rect" intensity={2} position={[0, 6, 4]} scale={[14, 6, 1]} />
        <Lightformer form="rect" intensity={1} position={[-6, 3, -3]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="ring" intensity={0.8} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={6} />
      </Environment>

      {showGizmo && (
        <>
          <Line points={arc} color="#ffe2a8" lineWidth={1} dashed dashSize={0.5} gapSize={0.5} transparent opacity={0.28} />
          <group ref={gizmo} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerOver={() => (document.body.style.cursor = 'grab')} onPointerOut={() => (document.body.style.cursor = '')}>
            <mesh ref={glow}>
              <sphereGeometry args={[radius * 0.05, 24, 16]} />
              <meshBasicMaterial color="#ffd58a" toneMapped={false} />
            </mesh>
            <mesh>
              <sphereGeometry args={[radius * 0.16, 12, 8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        </>
      )}
    </>
  )
}
