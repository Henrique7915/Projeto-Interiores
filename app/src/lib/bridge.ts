import { create } from 'zustand'
import type { Scene } from '../core'
import { useEditor } from '../state/store'
import { captureView } from '../ui/ThreeHost'
import { prefs } from './storage'

/**
 * Conexão do app com o servidor MCP local (ai/): o app e a IA do usuário editam a MESMA cena.
 * - app → bridge: cada edição local é enviada (debounce).
 * - bridge → app: mudanças feitas pela IA entram como um passo de desfazer.
 */
export const DEFAULT_BRIDGE = 'http://127.0.0.1:3737'

interface BridgeState {
  status: 'off' | 'connecting' | 'on'
  url: string
  error?: string
  lastAiChange?: number
}
export const useBridge = create<BridgeState>(() => ({ status: 'off', url: prefs.get('bridgeUrl', DEFAULT_BRIDGE) }))

let es: EventSource | null = null
let unsub: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let lastRemote: Scene | null = null

const put = (url: string, scene: Scene, adopt = false) =>
  fetch(url + '/api/scene', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scene, source: 'app', adopt }) }).then((r) => r.ok)

export function disconnectBridge() {
  es?.close()
  es = null
  unsub?.()
  unsub = null
  prefs.set('bridgeAuto', false)
  useBridge.setState({ status: 'off', error: undefined })
}

export function connectBridge(url = useBridge.getState().url) {
  disconnectBridge()
  prefs.set('bridgeUrl', url)
  useBridge.setState({ status: 'connecting', url, error: undefined })
  let first = true
  es = new EventSource(url + '/api/events')
  es.onerror = () => useBridge.setState({ status: es?.readyState === EventSource.OPEN ? 'on' : 'connecting', error: 'Sem conexão com o servidor MCP. Ele está rodando? (npm run mcp:http)' })
  es.onmessage = async (m) => {
    const ev = JSON.parse(m.data) as { type: string; scene?: Scene; source?: string; id?: string; view?: string }
    useBridge.setState({ status: 'on', error: undefined })
    if (ev.type === 'scene' && ev.scene) {
      const st = useEditor.getState()
      if (first) {
        first = false
        prefs.set('bridgeAuto', true)
        // quem tiver a cena mais recente vence
        const theirs = Date.parse(ev.scene.updatedAt ?? '') || 0
        const ours = Date.parse(st.scene.updatedAt ?? '') || 0
        if (theirs > ours) {
          lastRemote = ev.scene
          st.setScene(ev.scene, { keepHistory: true, remote: true })
        } else await put(url, st.scene, true).catch(() => undefined)
        startPushing(url)
        return
      }
      if (ev.source === 'app') return
      lastRemote = ev.scene
      st.setScene(ev.scene, { keepHistory: true, remote: true })
      useBridge.setState({ lastAiChange: Date.now() })
    } else if (ev.type === 'snapshot-request' && ev.id) {
      try {
        const blob = await captureView()
        const buf = new Uint8Array(await blob.arrayBuffer())
        let bin = ''
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
        await fetch(`${url}/api/snapshot/${ev.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ png: btoa(bin) }) })
      } catch {
        /* sem vista 3D aberta: o servidor avisa a IA por timeout */
      }
    }
  }
}

function startPushing(url: string) {
  unsub?.()
  unsub = useEditor.subscribe((s, prev) => {
    const gestureEnded = !!prev.gesture && !s.gesture
    if ((s.scene === prev.scene && !gestureEnded) || s.scene === lastRemote || s.gesture) return
    clearTimeout(timer)
    timer = setTimeout(() => void put(url, useEditor.getState().scene).catch(() => undefined), 250)
  })
}

/** Reconecta sozinho se o usuário já conectou antes neste navegador. */
export function autoConnectBridge() {
  if (prefs.get('bridgeAuto', false)) connectBridge()
}
