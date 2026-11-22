import { useEffect, useState } from 'react'

/* ------------------------------------------------------------------ */
/* Simulateur déterministe : chaque variable est une fonction pure du  */
/* temps (minute absolue), ce qui permet historique, prévision et rejeu */
/* ------------------------------------------------------------------ */

export function hash(n: number) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function vnoise(t: number, seed: number) {
  const i = Math.floor(t)
  const f = t - i
  const a = hash(i + seed * 7919.1)
  const b = hash(i + 1 + seed * 7919.1)
  const u = f * f * (3 - 2 * f)
  return (a + (b - a) * u) * 2 - 1
}

function fbm(t: number, seed: number, smooth: boolean) {
  let v =
    vnoise(t / 4, seed) * (smooth ? 0.12 : 0.45) +
    vnoise(t / 13, seed + 0.31) * 0.35 +
    vnoise(t / 41, seed + 0.67) * 0.55
  if (!smooth) v += (hash(t * 1.618 + seed * 31.7) - 0.5) * 0.35
  return v
}

export interface VarDef {
  label: string
  short: string
  unit: string
  base: number
  amp: number
  seed: number
  dec: number
  tag: string
}

export const VARS = {
  co: { label: 'CO sortie four', short: 'CO', unit: 'ppm', base: 140, amp: 45, seed: 1, dec: 0, tag: 'K2-AI-101' },
  o2: { label: 'O₂ sortie four', short: 'O₂', unit: '%', base: 2.4, amp: 0.35, seed: 2, dec: 2, tag: 'K2-AI-102' },
  nox: { label: 'NOx', short: 'NOx', unit: 'mg/Nm³', base: 820, amp: 90, seed: 3, dec: 0, tag: 'K2-AI-103' },
  tBurn: { label: 'T° zone de cuisson', short: 'T cuisson', unit: '°C', base: 1452, amp: 14, seed: 4, dec: 0, tag: 'K2-TI-210' },
  tCalc: { label: 'T° précalcinateur', short: 'T précalc.', unit: '°C', base: 878, amp: 7, seed: 5, dec: 0, tag: 'K2-TI-305' },
  tSec: { label: 'T° air secondaire', short: 'T air sec.', unit: '°C', base: 1040, amp: 22, seed: 6, dec: 0, tag: 'K2-TI-412' },
  draft: { label: 'Tirage ventilateur ID', short: 'Tirage ID', unit: 'mbar', base: -58, amp: 2.2, seed: 7, dec: 1, tag: 'K2-PI-501' },
  dpC4: { label: 'ΔP cyclone C4', short: 'ΔP C4', unit: 'mbar', base: 11.5, amp: 0.9, seed: 8, dec: 1, tag: 'K2-PDI-504' },
  dpC5: { label: 'ΔP cyclone C5', short: 'ΔP C5', unit: 'mbar', base: 9.2, amp: 0.8, seed: 9, dec: 1, tag: 'K2-PDI-505' },
  feed: { label: 'Débit farine', short: 'Farine', unit: 't/h', base: 322, amp: 4, seed: 10, dec: 0, tag: 'K2-FI-020' },
  speed: { label: 'Vitesse four', short: 'Vitesse', unit: 'tr/min', base: 3.85, amp: 0.05, seed: 11, dec: 2, tag: 'K2-SI-110' },
  torque: { label: 'Couple four', short: 'Couple', unit: 'kN·m', base: 612, amp: 18, seed: 12, dec: 0, tag: 'K2-WI-111' },
  current: { label: 'Intensité moteur four', short: 'Intensité', unit: 'A', base: 418, amp: 12, seed: 13, dec: 0, tag: 'K2-II-112' },
  fcao: { label: 'Chaux libre estimée', short: 'CaO libre', unit: '%', base: 1.18, amp: 0.22, seed: 14, dec: 2, tag: 'SS-CAO-01' },
  thermal: { label: 'Consommation thermique', short: 'Thermique', unit: 'kcal/kg', base: 768, amp: 8, seed: 15, dec: 0, tag: 'KPI-TH' },
  elec: { label: 'Consommation électrique', short: 'Électrique', unit: 'kWh/t', base: 28.6, amp: 0.6, seed: 16, dec: 1, tag: 'KPI-EL' },
  prod: { label: 'Production clinker', short: 'Production', unit: 't/j', base: 4780, amp: 60, seed: 17, dec: 0, tag: 'KPI-PR' },
  stab: { label: 'Indice de stabilité', short: 'Stabilité', unit: '%', base: 84, amp: 5, seed: 18, dec: 0, tag: 'KPI-ST' },
} satisfies Record<string, VarDef>

export type VarKey = keyof typeof VARS

/* ------------------------------ Événements ------------------------------ */

export type EventKind = 'combustion' | 'thermique' | 'tirage' | 'alimentation'
export type Severity = 'critique' | 'alerte'

export interface KilnEvent {
  id: string
  t: number
  kind: EventKind
  severity: Severity
  label: string
  detail: string
  vars: VarKey[]
}

const EV_PERIOD = 71
const KINDS: EventKind[] = ['combustion', 'thermique', 'tirage', 'alimentation']

const EV_META: Record<
  EventKind,
  { label: string; detail: string; vars: VarKey[]; effects: Partial<Record<VarKey, number>> }
> = {
  combustion: {
    label: 'Pic de CO sortie four',
    detail: 'Combustion incomplète : CO au-dessus du seuil, O₂ en baisse.',
    vars: ['co', 'o2', 'nox'],
    effects: { co: 360, o2: -0.9, nox: -190, tBurn: -12, thermal: 9, stab: -9 },
  },
  thermique: {
    label: 'Refroidissement zone de cuisson',
    detail: 'Baisse de la température de cuisson et de l’air secondaire.',
    vars: ['tBurn', 'tSec', 'fcao'],
    effects: { tBurn: -42, tSec: -55, torque: -26, current: -14, fcao: 0.55, stab: -12 },
  },
  tirage: {
    label: 'Variation de tirage — cyclone C4',
    detail: 'Montée de ΔP C4 compatible avec un début de colmatage.',
    vars: ['draft', 'dpC4', 'dpC5'],
    effects: { draft: -6, dpC4: 4.2, dpC5: 2.6, o2: 0.5, elec: 0.9, stab: -7 },
  },
  alimentation: {
    label: 'Chute du débit farine',
    detail: 'Perte d’alimentation transitoire, couple et intensité en baisse.',
    vars: ['feed', 'torque', 'current'],
    effects: { feed: -26, current: -28, torque: -34, tCalc: 16, prod: -160, stab: -10 },
  },
}

function eventForSlot(k: number): KilnEvent | null {
  if (hash(k * 3.7 + 1.3) < 0.35) return null
  const kind = KINDS[Math.floor(hash(k * 5.3 + 2.1) * 4) % 4]
  const t = k * EV_PERIOD + Math.floor(hash(k * 1.9 + 3.3) * 40)
  const severity: Severity = hash(k * 2.3 + 0.7) > 0.62 ? 'critique' : 'alerte'
  const { label, detail, vars } = EV_META[kind]
  return { id: `EV-${String(k).slice(-5)}`, t, kind, severity, label, detail, vars }
}

export function eventsBetween(a: number, b: number): KilnEvent[] {
  const out: KilnEvent[] = []
  for (let k = Math.floor(a / EV_PERIOD) - 1; k <= Math.floor(b / EV_PERIOD); k++) {
    const e = eventForSlot(k)
    if (e && e.t >= a && e.t <= b) out.push(e)
  }
  return out
}

function pulse(d: number) {
  if (d < -25 || d > 70) return 0
  if (d < 0) return 0.22 * ((d + 25) / 25) ** 2 // signaux précurseurs
  return (0.22 + 0.78 * (1 - Math.exp(-(d + 0.6) / 1.6))) * Math.exp(-d / 11)
}

export function value(key: VarKey, t: number, smooth = false): number {
  const d = VARS[key]
  let v = d.base + d.amp * fbm(t, d.seed, smooth)
  const k0 = Math.floor((t - 70) / EV_PERIOD) - 1
  const k1 = Math.floor((t + 25) / EV_PERIOD)
  for (let k = k0; k <= k1; k++) {
    const e = eventForSlot(k)
    if (!e) continue
    const eff = EV_META[e.kind].effects[key]
    if (eff) v += eff * pulse(t - e.t) * (smooth ? 0.7 : 1)
  }
  return v
}

export function forecastAt(key: VarKey, t: number, now: number) {
  const d = VARS[key]
  const off = value(key, now) - value(key, now, true)
  const mid = value(key, t, true) + off * Math.exp(-(t - now) / 12)
  const u = d.amp * (0.12 + 0.09 * Math.sqrt(Math.max(0, t - now)))
  return { mid, lo: mid - u, hi: mid + u }
}

/* ------------------------------ Séries ------------------------------ */

export function timesFor(now: number, hist: number, fc = 0) {
  return Array.from({ length: hist + fc }, (_, i) => now - hist + 1 + i)
}

export function histSeries(key: VarKey, times: number[], now: number) {
  return times.map((t) => (t <= now ? value(key, t) : null))
}

export function fcSeries(key: VarKey, times: number[], now: number) {
  const mid: (number | null)[] = []
  const lo: (number | null)[] = []
  const hi: (number | null)[] = []
  for (const t of times) {
    if (t < now) {
      mid.push(null), lo.push(null), hi.push(null)
    } else {
      const f = forecastAt(key, t, now)
      mid.push(f.mid), lo.push(f.lo), hi.push(f.hi)
    }
  }
  return { mid, lo, hi }
}

/* ------------------------------ Qualité ------------------------------ */

export const FCAO_TARGET = 1.2
export const FCAO_TOL: [number, number] = [0.8, 1.6]

export const isLab = (t: number) => ((t % 60) + 60) % 60 === 20
export const labValue = (t: number) => value('fcao', t) + (hash(t * 1.37 + 5) - 0.5) * 0.3 + 0.03
export const fcaoUncert = (t: number) => 0.07 + 0.0025 * ((((t - 20) % 60) + 60) % 60)

/* ------------------------------ Virole ------------------------------ */

export const SHELL_LEN = 72
export function shellTemp(x: number, t: number) {
  const base = 214 + 95 * Math.exp(-(((x - 17) / 9) ** 2)) + 55 * Math.exp(-(((x - 42) / 13) ** 2)) - 40 * (x / 72)
  const hot = (62 + 46 * Math.sin(t / 140)) * Math.exp(-(((x - 26) / 2.2) ** 2))
  const warm = (20 + 14 * Math.sin(t / 61 + 1)) * Math.exp(-(((x - 51) / 3.5) ** 2))
  const n = vnoise(x * 0.7 + t * 0.13, 40) * 11 + (hash(x * 31.1 + t * 7.3) - 0.5) * 7
  return base + hot + warm + n
}

/* ------------------------------ Horloge ------------------------------ */

export const SIM_START = Math.floor(Date.now() / 60000)
export const TICK_MS = 4000

/** Une minute procédé simulée toutes les 4 s (accéléré ×15). */
export function useSimClock() {
  const [t, setT] = useState(SIM_START)
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), TICK_MS)
    return () => clearInterval(id)
  }, [])
  return t
}

/* ------------------------------ Utilitaires ------------------------------ */

const nfCache = new Map<number, Intl.NumberFormat>()
export function fmt(v: number | null | undefined, dec = 0) {
  if (v == null || Number.isNaN(v)) return '—'
  let f = nfCache.get(dec)
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    nfCache.set(dec, f)
  }
  return f.format(v)
}

export function signed(v: number, dec = 0) {
  return (v > 0 ? '+' : v < 0 ? '−' : '±') + fmt(Math.abs(v), dec)
}

export function hhmm(t: number) {
  const d = new Date(t * 60000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function mean(a: number[]) {
  return a.reduce((s, v) => s + v, 0) / (a.length || 1)
}

export function pearson(a: number[], b: number[]) {
  const ma = mean(a)
  const mb = mean(b)
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return num / Math.sqrt(da * db || 1)
}
