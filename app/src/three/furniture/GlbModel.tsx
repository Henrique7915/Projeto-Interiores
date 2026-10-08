import { Component, useMemo, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { metersUV, type Vec3 } from './parts'

/** URL de um modelo do catálogo (`models/x.glb`), relativa à página para funcionar no GitHub Pages. */
export const glbUrl = (model: string) => new URL(`assets/${model}`, document.baseURI).href

interface Part {
  geo: THREE.BufferGeometry
  /** nome do slot do catálogo (nome do material no GLB), ou null para manter o material do arquivo */
  slot: string | null
  own: THREE.Material
}

/**
 * Modelo glTF do Blender (assets/blender/modelos.py). Origem no centro da base, frente +Z.
 * - Estica o modelo até `size` (medidas da cena), então móveis redimensionáveis continuam valendo.
 * - O nome do material no GLB é o slot do catálogo: o material escolhido na cena entra no lugar.
 * - UVs são gerados em metros aqui, depois do esticamento, para a textura manter a escala real.
 */
export function GlbMesh({ url, size, slots, material }: { url: string; size: Vec3; slots: ReadonlySet<string>; material: (slot: string) => THREE.Material }) {
  const gltf = useGLTF(url, false)
  const parts = useMemo<Part[]>(() => {
    const src = gltf.scene
    src.updateMatrixWorld(true)
    const nat = new THREE.Box3().setFromObject(src).getSize(new THREE.Vector3())
    const k = new THREE.Matrix4().makeScale(size[0] / Math.max(nat.x, 1e-3), size[1] / Math.max(nat.y, 1e-3), size[2] / Math.max(nat.z, 1e-3))
    const out: Part[] = []
    src.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const geo = mesh.geometry.clone()
      geo.applyMatrix4(mesh.matrixWorld)
      geo.applyMatrix4(k)
      geo.deleteAttribute('uv')
      metersUV(geo)
      const own = mesh.material as THREE.Material
      own.side = THREE.DoubleSide
      out.push({ geo, slot: slots.has(own.name) ? own.name : null, own })
    })
    return out
    // slots é estável por item; só recalcula ao trocar o arquivo ou as medidas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, size[0], size[1], size[2]])
  return (
    <group>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geo} material={p.slot ? material(p.slot) : p.own} castShadow receiveShadow />
      ))}
    </group>
  )
}

/** Se o GLB não carregar (arquivo ausente, rede), mostra o desenhista procedural no lugar. */
export class GlbBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.warn('[design3d] modelo GLB indisponível, usando o procedural:', err)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
