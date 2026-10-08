import { useEffect, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { resolveMaterial, type Scene } from '../core'
import { fmtLen, parseLen } from '../lib/units'
import { useEditor } from '../state/store'

/* ───── ícones (traços simples, 24×24) ───── */
const P: Record<string, string> = {
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  download: 'M12 3v12m0 0-4-4m4 4 4-4M5 21h14',
  upload: 'M12 15V3m0 0L8 7m4-4 4 4M5 21h14',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  camera: 'M4 8h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-6v-1c0-1.5 3-1.5 3-4a3 3 0 0 0-6 0M12 18v.01',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  cursor: 'M5 3l14 8-6 2-2 6z',
  room: 'M4 4h16v16H4z',
  wall: 'M3 12h18M3 8h18M3 16h18',
  door: 'M6 21V4h9l3 3v14M6 21h12M13 12v.01',
  window: 'M5 4h14v16H5zM5 12h14M12 4v16',
  ruler: 'M3 17 17 3l4 4L7 21zM8 12l2 2m1-5 2 2m1-5 2 2',
  rotate: 'M21 12a9 9 0 1 1-3-6.7M21 4v5h-5',
  grid: 'M4 4h16v16H4zM4 12h16M12 4v16',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5',
  split: 'M3 5h18v14H3zM12 5v14',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
  sunrise: 'M12 5v3M5.6 9.6l1.4 1.4M3 17h18M18.4 9.6 17 11M7 17a5 5 0 0 1 10 0M8 21h8',
  lamp: 'M9 21h6M12 21v-8M6 13h12l-2-8H8z',
  send: 'M4 12 20 4l-6 16-3-7z',
  plug: 'M9 2v5m6-5v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5',
  file: 'M6 3h9l4 4v14H6zM14 3v5h5',
  chat: 'M4 5h16v11H9l-5 4z',
  menu: 'M4 7h16M4 12h16M4 17h16',
}
export function Icon({ name, size = 18 }: { name: keyof typeof P | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[name] ?? P.cube} />
    </svg>
  )
}

export function IconButton({ icon, label, onClick, active, disabled, size }: { icon: string; label: string; onClick?: () => void; active?: boolean; disabled?: boolean; size?: number }) {
  return (
    <button type="button" className={'ibtn' + (active ? ' on' : '')} title={label} aria-label={label} onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={size} />
    </button>
  )
}

/* ───── toast ───── */
interface ToastState {
  msg?: string
  kind?: 'ok' | 'err'
  show: (msg: string, kind?: 'ok' | 'err') => void
}
let toastTimer: ReturnType<typeof setTimeout> | undefined
export const useToast = create<ToastState>((set) => ({
  show: (msg, kind = 'ok') => {
    set({ msg, kind })
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => set({ msg: undefined }), 3500)
  },
}))
export const toast = (m: string, k?: 'ok' | 'err') => useToast.getState().show(m, k)
export function Toaster() {
  const { msg, kind } = useToast()
  return msg ? <div className={'toast ' + (kind ?? 'ok')}>{msg}</div> : null
}

/* ───── campo de medida (aceita "3,2", "320cm", "10ft") ───── */
export function LenInput({ value, onCommit, label, min, suffix, step = 0.05 }: { value: number; onCommit: (m: number) => void; label?: string; min?: number; suffix?: string; step?: number }) {
  const unit = useEditor((s) => s.unit)
  const [text, setText] = useState(fmtLen(value, unit, true))
  const focus = useRef(false)
  useEffect(() => {
    if (!focus.current) setText(fmtLen(value, unit, true))
  }, [value, unit])
  const commit = () => {
    focus.current = false
    const v = parseLen(text, unit)
    if (v === undefined || (min !== undefined && v < min)) return setText(fmtLen(value, unit, true))
    onCommit(Math.round(v * 1000) / 1000)
  }
  const bump = (dir: 1 | -1) => {
    const v = Math.max(min ?? -1e6, Math.round((value + dir * step) * 1000) / 1000)
    onCommit(v)
  }
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <div className="num">
        <input
          value={text}
          inputMode="decimal"
          onFocus={(e) => ((focus.current = true), e.target.select())}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'ArrowUp') (e.preventDefault(), bump(1))
            if (e.key === 'ArrowDown') (e.preventDefault(), bump(-1))
          }}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  )
}

export function NumInput({ value, onCommit, label, suffix, step = 1, min, max }: { value: number; onCommit: (n: number) => void; label?: string; suffix?: string; step?: number; min?: number; max?: number }) {
  const [text, setText] = useState(String(Math.round(value * 100) / 100))
  const focus = useRef(false)
  useEffect(() => {
    if (!focus.current) setText(String(Math.round(value * 100) / 100))
  }, [value])
  const commit = () => {
    focus.current = false
    const v = Number(text.replace(',', '.'))
    if (!Number.isFinite(v) || (min !== undefined && v < min) || (max !== undefined && v > max)) return setText(String(value))
    onCommit(v)
  }
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <div className="num">
        <input
          value={text}
          inputMode="decimal"
          onFocus={(e) => ((focus.current = true), e.target.select())}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'ArrowUp') (e.preventDefault(), onCommit(value + step))
            if (e.key === 'ArrowDown') (e.preventDefault(), onCommit(value - step))
          }}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  )
}

export function TextInput({ value, onCommit, label, placeholder }: { value: string; onCommit: (v: string) => void; label?: string; placeholder?: string }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <label className="field wide">
      {label && <span>{label}</span>}
      <input className="txt" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={() => text !== value && onCommit(text)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    </label>
  )
}

export function Swatch({ scene, material, size = 36, selected, onClick, title }: { scene: Scene; material?: string; size?: number; selected?: boolean; onClick?: () => void; title?: string }) {
  const m = resolveMaterial(material, scene)
  const bg =
    m.category === 'wood'
      ? `repeating-linear-gradient(100deg, ${m.color} 0 6px, color-mix(in srgb, ${m.color} 82%, #000) 6px 7px)`
      : m.category === 'fabric' || m.category === 'leather'
        ? `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${m.color} 88%, #fff), ${m.color})`
        : m.category === 'stone' || m.category === 'ceramic' || m.category === 'concrete'
          ? `linear-gradient(135deg, ${m.color}, color-mix(in srgb, ${m.color} 80%, #000))`
          : m.color
  return (
    <button type="button" className={'swatch' + (selected ? ' sel' : '')} style={{ width: size, height: size, background: bg }} onClick={onClick} title={title ?? m.name} aria-label={title ?? m.name} />
  )
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="sec">
      <header>
        <h3>{title}</h3>
        {right}
      </header>
      {children}
    </section>
  )
}

export function download(name: string, data: Blob | string, type = 'application/json') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
