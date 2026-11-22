import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { fmt, hhmm, type KilnEvent } from '../lib/sim'

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    setW(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || 1
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(+v.toFixed(10))
  return out
}

function decFor(ticks: number[]) {
  if (ticks.length < 2) return 0
  const s = Math.abs(ticks[1] - ticks[0])
  return s >= 1 ? 0 : s >= 0.1 ? 1 : 2
}

export type AxisId = 'L0' | 'L1' | 'R0' | 'R1'
const AXIS_ORDER: AxisId[] = ['L0', 'L1', 'R0', 'R1']

export interface Series {
  key: string
  label: string
  unit: string
  color: string
  values: (number | null)[]
  axis: AxisId
  dec?: number
  kind?: 'line' | 'dash' | 'points'
  band?: { lo: (number | null)[]; hi: (number | null)[] }
  legend?: boolean
  width?: number
}

export interface Zone {
  axis: AxisId
  from: number
  to: number
  color: string
  label?: string
}
export interface RefLine {
  axis: AxisId
  value: number
  color: string
  label?: string
}
export interface TimeZone {
  from: number
  to: number
  label?: string
  color?: string
}

interface TimeChartProps {
  times: number[]
  series: Series[]
  nowT?: number
  events?: KilnEvent[]
  height?: number
  zones?: Zone[]
  lines?: RefLine[]
  timeZones?: TimeZone[]
  domains?: Partial<Record<AxisId, [number, number]>>
  hoverT?: number | null
  onHover?: (t: number | null) => void
  onEventClick?: (e: KilnEvent) => void
  selectedEventId?: string
  legend?: boolean
}

const AXW = 48

export function TimeChart({
  times,
  series,
  nowT,
  events = [],
  height = 220,
  zones = [],
  lines = [],
  timeZones = [],
  domains = {},
  hoverT,
  onHover,
  onEventClick,
  selectedEventId,
  legend = true,
}: TimeChartProps) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [localHover, setLocalHover] = useState<number | null>(null)
  const [hoveredEvent, setHoveredEvent] = useState<KilnEvent | null>(null)
  const [hidden, setHidden] = useState<string[]>([])
  const visibleSeries = series.filter((s) => !hidden.includes(s.key) && !hidden.includes(s.key.endsWith('f') ? s.key.slice(0, -1) : s.key))
  const hv = onHover ? (hoverT ?? null) : localHover
  const setHv = onHover ?? setLocalHover

  const axes = AXIS_ORDER.filter((a) => visibleSeries.some((s) => s.axis === a))
  const left = axes.filter((a) => a[0] === 'L')
  const right = axes.filter((a) => a[0] === 'R')
  const m = { l: 6 + left.length * AXW, r: 6 + right.length * AXW, t: 18, b: 22 }
  const iw = Math.max(10, w - m.l - m.r)
  const ih = height - m.t - m.b
  const t0 = times[0]
  const t1 = times[times.length - 1]
  const x = (t: number) => m.l + ((t - t0) / (t1 - t0 || 1)) * iw

  const dom: Partial<Record<AxisId, [number, number]>> = {}
  for (const a of axes) {
    if (domains[a]) {
      dom[a] = domains[a]
      continue
    }
    let lo = Infinity
    let hi = -Infinity
    const push = (v: number | null) => {
      if (v == null) return
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    for (const s of visibleSeries.filter((s) => s.axis === a)) {
      s.values.forEach(push)
      s.band?.lo.forEach(push)
      s.band?.hi.forEach(push)
    }
    zones.filter((z) => z.axis === a).forEach((z) => (push(z.from), push(z.to)))
    lines.filter((l) => l.axis === a).forEach((l) => push(l.value))
    const pad = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.1
    dom[a] = [lo - pad, hi + pad]
  }
  const y = (a: AxisId, v: number) => {
    const [d0, d1] = dom[a]!
    return m.t + ih - ((v - d0) / (d1 - d0 || 1)) * ih
  }

  const path = (s: Series, vals: (number | null)[]) => {
    let d = ''
    let pen = false
    vals.forEach((v, i) => {
      if (v == null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(times[i]).toFixed(1)},${y(s.axis, v).toFixed(1)}`
      pen = true
    })
    return d
  }
  const area = (s: Series) => {
    if (!s.band) return ''
    const idx = s.band.lo.map((v, i) => (v != null && s.band!.hi[i] != null ? i : -1)).filter((i) => i >= 0)
    if (!idx.length) return ''
    const top = idx.map((i) => `${x(times[i]).toFixed(1)},${y(s.axis, s.band!.hi[i]!).toFixed(1)}`)
    const bot = idx
      .slice()
      .reverse()
      .map((i) => `${x(times[i]).toFixed(1)},${y(s.axis, s.band!.lo[i]!).toFixed(1)}`)
    return `M${top.join('L')}L${bot.join('L')}Z`
  }

  const span = t1 - t0
  const step = [5, 10, 15, 30, 60, 120, 240].find((s) => (iw / span) * s >= 70) ?? 240
  const tTicks: number[] = []
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) tTicks.push(t)

  const firstAxis = axes[0]
  const gridTicks = firstAxis ? niceTicks(dom[firstAxis]![0], dom[firstAxis]![1]) : []

  const onMove = (ev: React.MouseEvent<SVGRectElement>) => {
    const r = ev.currentTarget.getBoundingClientRect()
    const t = Math.round(t0 + ((ev.clientX - r.left) / r.width) * span)
    const cursorX = ev.clientX - r.left
    const nearEvent = visibleEvents.find((event) => Math.abs(x(event.t) - m.l - cursorX) <= 10)
    setHoveredEvent(nearEvent ?? null)
    setHv(nearEvent?.t ?? Math.max(t0, Math.min(t1, t)))
  }

  const hIdx = hv != null ? hv - t0 : -1
  const visibleEvents = events.filter((e) => e.t >= t0 && e.t <= t1)

  return (
    <div className="flex flex-col gap-2">
      {legend && (
        <div className="flex flex-wrap justify-center gap-2 text-[12px]">
          {series
            .filter((s) => s.legend !== false)
            .map((s) => {
              const showIdx = hIdx >= 0 ? hIdx : lastIdx(s.values)
              const v = showIdx >= 0 ? s.values[showIdx] : null
              return (
                <button type="button" key={s.key} onClick={() => setHidden((h) => h.includes(s.key) ? h.filter((k) => k !== s.key) : [...h, s.key])} aria-pressed={!hidden.includes(s.key)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors ${hidden.includes(s.key) ? 'border-line bg-bg text-dim opacity-60' : 'border-line bg-panel-2 text-fg hover:border-ai'}`}>
                  <span
                    className={s.kind === 'points' ? 'size-2 self-center rounded-full' : 'h-0.5 w-3 self-center'}
                    style={{ background: s.color }}
                  />
                  <span>{s.label}</span>
                  {!hidden.includes(s.key) && <><span className="font-mono tabular-nums">{fmt(v, s.dec ?? 1)}</span><span className="text-mute">{s.unit}</span></>}
                </button>
              )
            })}
        </div>
      )}
      <div ref={ref} className="relative w-full" style={{ height }}>
        {w > 0 && (
          <svg width={w} height={height} className="block overflow-visible">
            {/* zones temporelles (contexte, prévision) */}
            {timeZones.map((z, i) => (
              <g key={i}>
                <rect
                  x={x(Math.max(t0, z.from))}
                  y={m.t}
                  width={Math.max(0, x(Math.min(t1, z.to)) - x(Math.max(t0, z.from)))}
                  height={ih}
                  fill={z.color ?? 'rgba(122,167,255,0.05)'}
                />
                {z.label && (
                  <text x={x(Math.max(t0, z.from)) + 6} y={m.t + 12} className="fill-dim text-[10px]">
                    {z.label}
                  </text>
                )}
              </g>
            ))}
            {nowT != null && nowT < t1 && (
              <g>
                <rect x={x(nowT)} y={m.t} width={x(t1) - x(nowT)} height={ih} fill="rgba(122,167,255,0.045)" />
                <text x={x(nowT) + 6} y={m.t + 12} className="fill-ai text-[10px] uppercase tracking-wider">
                  Prévision
                </text>
              </g>
            )}
            {/* grille */}
            {gridTicks.map((v) => (
              <line key={v} x1={m.l} x2={m.l + iw} y1={y(firstAxis!, v)} y2={y(firstAxis!, v)} className="stroke-line" />
            ))}
            {tTicks.map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={m.t} y2={m.t + ih} className="stroke-line" strokeDasharray="2 4" />
                <text x={x(t)} y={height - 6} textAnchor="middle" className="fill-dim font-mono text-[10px]">
                  {hhmm(t)}
                </text>
              </g>
            ))}
            {/* zones et lignes de référence */}
            {zones.map((z, i) => (
              <g key={i}>
                <rect
                  x={m.l}
                  width={iw}
                  y={y(z.axis, z.to)}
                  height={Math.max(0, y(z.axis, z.from) - y(z.axis, z.to))}
                  fill={z.color}
                />
                {z.label && (
                  <text x={m.l + iw - 6} y={y(z.axis, z.to) + 12} textAnchor="end" className="fill-dim text-[10px]">
                    {z.label}
                  </text>
                )}
              </g>
            ))}
            {lines.map((l, i) => (
              <g key={i}>
                <line
                  x1={m.l}
                  x2={m.l + iw}
                  y1={y(l.axis, l.value)}
                  y2={y(l.axis, l.value)}
                  stroke={l.color}
                  strokeDasharray="6 4"
                  strokeWidth={1.2}
                />
                {l.label && (
                  <text x={m.l + 6} y={y(l.axis, l.value) - 5} fill={l.color} className="text-[10px]">
                    {l.label}
                  </text>
                )}
              </g>
            ))}
            {/* bandes d'incertitude */}
              {visibleSeries.map((s) =>
              s.band ? <path key={s.key + 'b'} d={area(s)} fill={s.color} fillOpacity={0.13} /> : null,
            )}
            {/* séries */}
            {visibleSeries.map((s) =>
              s.kind === 'points' ? (
                <g key={s.key}>
                  {s.values.map((v, i) =>
                    v == null ? null : (
                      <circle
                        key={i}
                        cx={x(times[i])}
                        cy={y(s.axis, v)}
                        r={4}
                        fill="var(--color-panel)"
                        stroke={s.color}
                        strokeWidth={2}
                      />
                    ),
                  )}
                </g>
              ) : (
                <path
                  key={s.key}
                  d={path(s, s.values)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.width ?? 1.5}
                  strokeDasharray={s.kind === 'dash' ? '4 3' : undefined}
                  strokeLinejoin="round"
                />
              ),
            )}
            {/* axes */}
            {axes.map((a) => {
              const side = a[0] === 'L' ? -1 : 1
              const i = Number(a[1])
              const ax = side < 0 ? m.l - i * AXW : m.l + iw + i * AXW
              const s0 = visibleSeries.find((s) => s.axis === a)!
              const ticks = niceTicks(dom[a]![0], dom[a]![1])
              const dec = decFor(ticks)
              return (
                <g key={a}>
                  <line x1={ax} x2={ax} y1={m.t} y2={m.t + ih} stroke={s0.color} strokeOpacity={0.5} />
                  {ticks.map((v) => (
                    <text
                      key={v}
                      x={ax + side * 5}
                      y={y(a, v) + 3}
                      textAnchor={side < 0 ? 'end' : 'start'}
                      fill={s0.color}
                      fillOpacity={0.85}
                      className="font-mono text-[10px]"
                    >
                      {fmt(v, dec)}
                    </text>
                  ))}
                  <text
                    x={ax + side * 5}
                    y={m.t - 6}
                    textAnchor={side < 0 ? 'end' : 'start'}
                    fill={s0.color}
                    className="text-[10px] font-medium"
                  >
                    {s0.unit}
                  </text>
                </g>
              )
            })}
            {/* marqueurs d'événement superposés aux séries pour rester visibles */}
            {visibleEvents.map((e) => {
              const c = e.severity === 'critique' ? 'var(--color-crit)' : 'var(--color-warn)'
              const sel = e.id === selectedEventId
              return (
                <g
                  key={e.id}
                  className={onEventClick ? 'cursor-pointer' : ''}
                  onClick={() => onEventClick?.(e)}
                >
                  <line
                    x1={x(e.t)}
                    x2={x(e.t)}
                    y1={m.t}
                    y2={m.t + ih}
                    stroke={c}
                    strokeOpacity={sel ? 1 : e.severity === 'critique' ? 0.9 : 0.72}
                    strokeWidth={sel ? 1.8 : e.severity === 'critique' ? 1.6 : 1.4}
                  />
                  <path
                    d={`M${x(e.t)},${m.t - 14} l5,5 l-5,5 l-5,-5z`}
                    fill={c}
                    stroke={sel ? 'var(--color-fg)' : 'var(--color-bg)'}
                    strokeWidth={1.25}
                  >
                    <title>{`${hhmm(e.t)} · ${e.label}`}</title>
                  </path>
                </g>
              )
            })}
            {nowT != null && nowT >= t0 && nowT <= t1 && (
              <line x1={x(nowT)} x2={x(nowT)} y1={m.t - 4} y2={m.t + ih} className="stroke-mute" strokeWidth={1} />
            )}
            {/* survol */}
            {hv != null && (
              <line x1={x(hv)} x2={x(hv)} y1={m.t} y2={m.t + ih} className="stroke-fg" strokeOpacity={0.5} />
            )}
            {hv != null &&
              visibleSeries.map((s) => {
                const v = s.values[hIdx]
                return v == null || s.kind === 'points' ? null : (
                  <circle key={s.key + 'h'} cx={x(hv)} cy={y(s.axis, v)} r={3} fill={s.color} />
                )
              })}
            <rect
              x={m.l}
              y={m.t}
              width={iw}
              height={ih}
              fill="transparent"
              onMouseMove={onMove}
              onMouseLeave={() => { setHv(null); setHoveredEvent(null) }}
            />
          </svg>
        )}
        {hv != null && w > 0 && (
          <div
            className="pointer-events-none absolute top-5 z-10 rounded border border-line bg-panel-2/95 px-2.5 py-1.5 text-[11px] shadow-xl backdrop-blur"
            style={x(hv) > w / 2 ? { right: w - x(hv) + 10 } : { left: x(hv) + 10 }}
          >
            <div className="mb-1 font-mono text-mute">
              {hhmm(hv)}
              {nowT != null && hv > nowT && <span className="ml-1.5 text-ai">+{hv - nowT} min</span>}
            </div>
            {visibleSeries.map((s) => {
              const v = s.values[hIdx]
              if (v == null) return null
              const lo = s.band?.lo[hIdx]
              const hi = s.band?.hi[hIdx]
              return (
                <div key={s.key} className="flex items-center gap-2 whitespace-nowrap">
                  <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                  <span className="text-mute">{s.label}</span>
                  <span className="ml-auto pl-3 font-mono text-fg">
                    {fmt(v, s.dec ?? 1)}
                    {lo != null && hi != null && <span className="text-dim"> ±{fmt((hi - lo) / 2, s.dec ?? 1)}</span>}
                  </span>
                  <span className="text-dim">{s.unit}</span>
                </div>
              )
            })}
            {(hoveredEvent ? [hoveredEvent] : visibleEvents.filter((e) => Math.abs(e.t - hv) <= 1)).map((e) => (
              <div key={e.id} className="mt-2 max-w-[320px] border-t border-line pt-1.5">
                <div className={`font-medium ${e.severity === 'critique' ? 'text-crit' : 'text-warn'}`}>
                  {e.severity === 'critique' ? 'Alarme critique' : 'Événement'} · {e.label}
                </div>
                {e.detail && <div className="mt-0.5 whitespace-normal text-mute">{e.detail}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function lastIdx(v: (number | null)[]) {
  for (let i = v.length - 1; i >= 0; i--) if (v[i] != null) return i
  return -1
}

export function Sparkline({
  values,
  color = 'var(--color-mute)',
  height = 36,
  target,
}: {
  values: number[]
  color?: string
  height?: number
  target?: number
}) {
  const W = 200
  const all = target != null ? [...values, target] : values
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const y = (v: number) => height - 3 - ((v - lo) / (hi - lo || 1)) * (height - 6)
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`)
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }}>
      {target != null && (
        <line x1={0} x2={W} y1={y(target)} y2={y(target)} className="stroke-dim" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      )}
      <path d={`M0,${height} L${pts.join(' L')} L${W},${height}Z`} fill={color} fillOpacity={0.08} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function Legend({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-mute">{children}</div>
}
