import type { DisplayUnit } from '../state/store'

const nf = (n: number, d: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d })

/** Formata um comprimento em metros para a unidade de exibição. */
export function fmtLen(m: number, unit: DisplayUnit = 'm', short = false): string {
  if (unit === 'cm') return `${nf(m * 100, 1)}${short ? '' : ' cm'}`
  if (unit === 'ft') {
    const totalIn = (m / 0.0254) | 0
    const ft = Math.floor(totalIn / 12)
    const inch = Math.round((m / 0.0254) % 12)
    return inch === 12 ? `${ft + 1}′` : `${ft}′ ${inch}″`
  }
  return `${nf(m, 2)}${short ? '' : ' m'}`
}

/** Interpreta texto do usuário ("3,2", "320cm", "3.2 m", "10ft", "10'6") → metros. Sem unidade usa a unidade de exibição. */
export function parseLen(text: string, unit: DisplayUnit = 'm'): number | undefined {
  const t = text.trim().toLowerCase().replace(',', '.')
  if (!t) return undefined
  const ftIn = /^(-?\d+(?:\.\d+)?)\s*(?:'|ft|′)\s*(\d+(?:\.\d+)?)?\s*(?:"|in|″)?$/.exec(t)
  if (ftIn) return (Number(ftIn[1]) * 12 + Number(ftIn[2] ?? 0)) * 0.0254
  const m = /^(-?\d+(?:\.\d+)?)\s*(mm|cm|m|ft|in)?$/.exec(t)
  if (!m) return undefined
  const v = Number(m[1])
  const u = m[2] ?? (unit === 'ft' ? 'ft' : unit)
  return u === 'mm' ? v / 1000 : u === 'cm' ? v / 100 : u === 'ft' ? v * 0.3048 : u === 'in' ? v * 0.0254 : v
}

export const fmtArea = (m2: number) => `${nf(m2, 2)} m²`
