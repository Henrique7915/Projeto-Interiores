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
 * Modelo glTF (assets/blender/modelos.py ou gerador de IA). Origem no centro da base, frente +Z.
 * - Centraliza pela caixa do modelo inteiro: centro em x/z = 0 e base em y = 0, mesmo se o arquivo vier deslocado.
 * - Estica o modelo até `size` (medidas da cena), então móveis redimensionáveis continuam valendo.
 * - O nome do material no GLB é o slot do catálogo: o material escolhido na cena entra no lugar,
 *   com UVs em metros (depois do esticamento, para a escala real).
 * - Material sem slot mantém o material e as UVs do arquivo, então a textura embutida aparece.
 */
export function GlbMesh({ url, size, slots, material }: { url: string; size: Vec3; slots: ReadonlySet<string>; material: (slot: string) => THREE.Material }) {
  const gltf = useGLTF(url, false)
  const parts = useMemo<Part[]>(() => {
    const src = gltf.scene
    src.updateMatrixWorld(true)
    const raw: { geo: THREE.BufferGeometry; own: THREE.Material }[] = []
    src.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const geo = mesh.geometry.clone()
      geo.applyMatrix4(mesh.matrixWorld)
      const own = mesh.material as THREE.Material
      own.side = THREE.DoubleSide
      raw.push({ geo, own })
    })
    // caixa do modelo inteiro (já com as transformações dos nós)
    const box = new THREE.Box3()
    for (const r of raw) {
      r.geo.computeBoundingBox()
      if (r.geo.boundingBox) box.union(r.geo.boundingBox)
    }
    const nat = box.getSize(new THREE.Vector3())
    const c = box.getCenter(new THREE.Vector3())
    const sx = size[0] / Math.max(nat.x, 1e-3), sy = size[1] / Math.max(nat.y, 1e-3), sz = size[2] / Math.max(nat.z, 1e-3)
    return raw.map(({ geo, own }) => {
      geo.translate(-c.x, -box.min.y, -c.z)
      geo.scale(sx, sy, sz)
      const slot = slots.has(own.name) ? own.name : null
      if (slot) {
        geo.deleteAttribute('uv')
        metersUV(geo)
      }
      return { geo, slot, own }
    })
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
