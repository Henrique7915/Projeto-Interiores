import type { Scene } from '../core'

/** Armazenamento local de projetos (IndexedDB), com reserva em localStorage. */
const DB = 'design3d'
const STORE = 'projects'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' })
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface ProjectRecord {
  id: string
  name: string
  updatedAt: string
  scene: Scene
}

export async function saveProject(scene: Scene): Promise<void> {
  const rec: ProjectRecord = { id: scene.id, name: scene.name, updatedAt: new Date().toISOString(), scene }
  try {
    await tx('readwrite', (s) => s.put(rec))
  } catch {
    try {
      localStorage.setItem('d3d.scene.' + scene.id, JSON.stringify(rec))
    } catch {
      /* sem armazenamento disponível */
    }
  }
  try {
    localStorage.setItem('d3d.last', scene.id)
  } catch {
    /* ignore */
  }
}
export async function listProjects(): Promise<ProjectRecord[]> {
  try {
    const all = await tx<ProjectRecord[]>('readonly', (s) => s.getAll())
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } catch {
    return []
  }
}
export async function loadProject(id: string): Promise<Scene | undefined> {
  try {
    return (await tx<ProjectRecord | undefined>('readonly', (s) => s.get(id)))?.scene
  } catch {
    try {
      const raw = localStorage.getItem('d3d.scene.' + id)
      return raw ? (JSON.parse(raw) as ProjectRecord).scene : undefined
    } catch {
      return undefined
    }
  }
}
export async function deleteProject(id: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(id))
  } catch {
    /* ignore */
  }
}
export const lastProjectId = () => {
  try {
    return localStorage.getItem('d3d.last') ?? undefined
  } catch {
    return undefined
  }
}

/** Preferências simples por navegador (chave de API fica só aqui, nunca na cena nem no link). */
export const prefs = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem('d3d.pref.' + k)
      return v == null ? d : (JSON.parse(v) as T)
    } catch {
      return d
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem('d3d.pref.' + k, JSON.stringify(v))
    } catch {
      /* ignore */
    }
  },
}
