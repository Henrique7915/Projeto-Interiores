import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { MaterialSlots, Scene } from '../../../schema/types'
import { toRenderScene } from './adapter/toRender'
import { FurnitureModel } from './furniture/FurnitureModel'

export interface ObjectPreviewProps {
  /** id do catálogo, ex.: "sofa/modern-l" */
  catalogId: string
  /** troca de materiais por slot (ids `categoria/nome`) */
  materials?: MaterialSlots
  /** medidas [largura, altura, profundidade]; sem valor usa as do catálogo */
  size?: { width: number; height: number; depth: number }
  /** permite girar com o mouse (painel de detalhe). Falso gera uma miniatura estática. */
  orbit?: boolean
  /** acende luminárias */
  lit?: boolean
  className?: string
  style?: React.CSSProperties
}

/** Miniatura/prévia 3D de um item do catálogo, com fundo transparente. */
export function ObjectPreview({ catalogId, materials, size, orbit = false, lit = false, className, style }: ObjectPreviewProps) {
  const obj = useMemo(() => {
    const scene: Scene = {
      format: 'design3d.scene', version: '0.1.0', id: 'preview', name: 'preview', units: 'm',
      levels: [{ id: 'l', name: 'l', elevation: 0, height: 3, objects: [{ id: 'o', catalogId, position: [0, 0, 0], materials, dimensions: size }] }],
    }
    return toRenderScene(scene).objects[0]
  }, [catalogId, materials, size])

  const [w, h, d] = obj.size
  const radius = Math.hypot(w, h, d) / 2
  const dist = radius / Math.sin(THREE.MathUtils.degToRad(15)) * 1.05
  const az = THREE.MathUtils.degToRad(35), el = THREE.MathUtils.degToRad(26)
  const pos: [number, number, number] = [Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist + h / 2, Math.cos(az) * Math.cos(el) * dist]

  return (
    <Canvas
      className={className}
      style={style}
      shadows
      dpr={[1, 2]}
      camera={{ fov: 30, position: pos, near: 0.1, far: 100 }}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ camera }) => camera.lookAt(0, h * 0.48, 0)}
    >
      <hemisphereLight args={['#dfe9ff', '#6b5a4a', 1.1]} />
      <directionalLight position={[3, 6, 4]} intensity={2.6} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} />
      <directionalLight position={[-4, 3, -2]} intensity={0.6} color="#ffd9b0" />
      <FurnitureModel obj={obj} glow={lit ? 1 : 0} />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={Math.max(w, d) * 2.4} blur={2.4} far={Math.max(1, h)} />
      {orbit && <OrbitControls target={[0, h * 0.48, 0]} enablePan={false} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2 - 0.05} />}
    </Canvas>
  )
}
