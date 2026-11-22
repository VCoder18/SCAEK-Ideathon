import { useEffect, useMemo, useRef, useState } from 'react'
import { useWidth } from '../components/charts'
import { Badge, Icon, Panel, Stat } from '../components/ui'
import { fmt, hhmm, SHELL_LEN, shellTemp } from '../lib/sim'

const ROWS = 180
const COLS = 144
const TMIN = 150
const TMAX = 420
const STOPS: [number, [number, number, number]][] = [
  [0, [16, 20, 46]],
  [0.25, [62, 38, 120]],
  [0.48, [166, 48, 110]],
  [0.68, [232, 92, 52]],
  [0.85, [250, 172, 52]],
  [1, [255, 244, 200]],
]
function ramp(v: number): [number, number, number] {
  const p = Math.max(0, Math.min(1, (v - TMIN) / (TMAX - TMIN)))
  for (let i = 1; i < STOPS.length; i++) {
    if (p <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1]
      const [b, cb] = STOPS[i]
      const f = (p - a) / (b - a)
      return [0, 1, 2].map((k) => ca[k] + (cb[k] - ca[k]) * f) as [number, number, number]
    }
  }
  return STOPS[STOPS.length - 1][1]
}
const rgb = (v: number) => `rgb(${ramp(v).map(Math.round).join(',')})`
const ZONES = [
  { from: 0, to: 6, label: 'Sortie' },
  { from: 6, to: 30, label: 'Cuisson' },
  { from: 30, to: 48, label: 'Transition' },
  { from: 48, to: 72, label: 'Calcination' },
]

type PlayMode = 'live' | 'pause' | 'replay'

export function Scanner({
  now,
  thresholds,
  setThresholds,
}: {
  now: number
  thresholds: { alert: number; crit: number }
  setThresholds: (t: { alert: number; crit: number }) => void
}) {
  const [play, setPlay] = useState<PlayMode>('live')
  const [cursor, setCursor] = useState(now)
  const [speed, setSpeed] = useState('12')
  const [replayComplete, setReplayComplete] = useState(false)
  const [heatmapHeight, setHeatmapHeight] = useState(380)
  const viewT = play === 'live' ? now : cursor
  const sliderProgress = Math.max(0, Math.min(100, ((viewT - (now - 1440)) / 1440) * 100))

  useEffect(() => {
    const updateHeight = () => setHeatmapHeight(Math.max(380, Math.min(500, Math.round(window.innerHeight * 0.56))))
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  useEffect(() => {
    if (play !== 'replay') return
    const id = setInterval(() => setCursor((c) => c + 1), 1000 / Number(speed))
    return () => clearInterval(id)
  }, [play, speed])

  useEffect(() => {
    if (play !== 'replay' || cursor < now) return
    setCursor(now)
    setReplayComplete(true)
    setPlay('pause')
  }, [cursor, now, play])

  const grid = useMemo(() => {
    const g = new Float32Array(ROWS * COLS)
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) g[r * COLS + c] = shellTemp(((c + 0.5) / COLS) * SHELL_LEN, viewT - r)
    return g
  }, [viewT])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(COLS, ROWS)
    for (let i = 0; i < grid.length; i++) {
      const [r, g, b] = ramp(grid[i])
      img.data[i * 4] = r
      img.data[i * 4 + 1] = g
      img.data[i * 4 + 2] = b
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [grid])

  const profile = Array.from({ length: COLS }, (_, c) => grid[c])
  const envelope = Array.from({ length: COLS }, (_, c) => {
    let mx = 0
    for (let r = 0; r < ROWS; r++) mx = Math.max(mx, grid[r * COLS + c])
    return mx
  })
  let maxI = 0
  profile.forEach((v, i) => v > profile[maxI] && (maxI = i))
  const maxT = profile[maxI]
  const maxX = ((maxI + 0.5) / COLS) * SHELL_LEN
  const above = (() => {
    let n = 0
    for (let r = 0; r < ROWS; r++) {
      let m = 0
      for (let c = 0; c < COLS; c++) m = Math.max(m, grid[r * COLS + c])
      if (m > thresholds.alert) n++
    }
    return n
  })()
  const tone = maxT > thresholds.crit ? 'crit' : maxT > thresholds.alert ? 'warn' : 'ok'
  const zoneExposure = ZONES.map((zone) => {
    const firstCol = Math.floor((zone.from / SHELL_LEN) * COLS)
    const lastCol = Math.ceil((zone.to / SHELL_LEN) * COLS)
    let alertMinutes = 0
    let criticalMinutes = 0
    for (let r = 0; r < ROWS; r++) {
      let zoneMax = -Infinity
      for (let c = firstCol; c < lastCol; c++) zoneMax = Math.max(zoneMax, grid[r * COLS + c])
      if (zoneMax > thresholds.crit) criticalMinutes++
      else if (zoneMax > thresholds.alert) alertMinutes++
    }
    return { ...zone, alertMinutes, criticalMinutes }
  })

  const [hover, setHover] = useState<{ x: number; r: number } | null>(null)

  return (
    <div className="grid grid-cols-12 gap-4">
      <Panel
        code="E.1"
        title="Cartographie thermique de la virole"
        subtitle="Position axiale (m) × temps — ligne du haut = instant affiché"
        className="col-span-12 xl:col-span-8"
        right={
          <Badge tone={play === 'live' ? 'ok' : 'ai'}>
            {play === 'live' ? 'Temps réel' : play === 'pause' ? 'En pause' : 'Rejeu'} · {hhmm(viewT)}
          </Badge>
        }
      >
        <div className="flex gap-3">
          <div className="relative flex-1">
            <div className="flex">
              <div className="flex w-11 flex-col justify-between py-0.5 pr-2 text-right font-mono text-[10px] text-dim" style={{ height: heatmapHeight }}>
                {[0, 30, 60, 90, 120, 150, 179].map((r) => (
                  <span key={r}>{hhmm(viewT - r)}</span>
                ))}
              </div>
              <div
                className="relative flex-1 cursor-crosshair overflow-hidden rounded-sm border border-line"
                style={{ height: heatmapHeight }}
                onMouseMove={(e) => {
                  const b = e.currentTarget.getBoundingClientRect()
                  setHover({
                    x: ((e.clientX - b.left) / b.width) * SHELL_LEN,
                    r: Math.floor(((e.clientY - b.top) / b.height) * ROWS),
                  })
                }}
                onMouseLeave={() => setHover(null)}
              >
                <canvas ref={canvasRef} width={COLS} height={ROWS} className="absolute inset-0 size-full" />
                {ZONES.slice(1).map((z) => (
                  <div key={z.from} className="absolute top-0 bottom-0 border-l border-dashed border-white/20" style={{ left: `${(z.from / SHELL_LEN) * 100}%` }} />
                ))}
                {hover && (
                  <>
                    <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/60" style={{ left: `${(hover.x / SHELL_LEN) * 100}%` }} />
                    <div className="pointer-events-none absolute right-0 left-0 h-px bg-white/60" style={{ top: `${(hover.r / ROWS) * 100}%` }} />
                    <div
                      className="pointer-events-none absolute rounded border border-line bg-panel-2/95 px-2 py-1 font-mono text-[11px] text-fg"
                      style={{
                        left: `min(calc(${(hover.x / SHELL_LEN) * 100}% + 10px), calc(100% - 150px))`,
                        top: `min(calc(${(hover.r / ROWS) * 100}% + 10px), calc(100% - 40px))`,
                      }}
                    >
                      {fmt(hover.x, 1)} m · {hhmm(viewT - hover.r)} ·{' '}
                      <span className="text-warn">{fmt(shellTemp(hover.x, viewT - hover.r))} °C</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="ml-11 flex justify-between pt-1 font-mono text-[10px] text-dim">
              {[0, 12, 24, 36, 48, 60, 72].map((x) => (
                <span key={x}>{x} m</span>
              ))}
            </div>
            <div className="ml-11 flex pt-1 text-[10px] uppercase tracking-wider text-dim">
              {ZONES.map((z) => (
                <span key={z.from} style={{ width: `${((z.to - z.from) / SHELL_LEN) * 100}%` }} className="truncate">
                  {z.label}
                </span>
              ))}
            </div>
          </div>
          <ColorScale thresholds={thresholds} height={heatmapHeight} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <div className="flex gap-1">
            <CtlButton active={play === 'replay'} onClick={() => {
              if (play === 'replay') {
                setPlay('pause')
                return
              }
              if (play === 'live' || replayComplete || cursor >= now) {
                setCursor(now - 1440)
                setReplayComplete(false)
              }
              setPlay('replay')
            }} label={play === 'replay' ? 'Pause' : 'Rejouer'}>
              {play === 'replay' ? Icon.pause : Icon.play}
            </CtlButton>
            <CtlButton
              active={play === 'pause'}
              onClick={() => {
                setCursor(viewT)
                setReplayComplete(false)
                setPlay('pause')
              }}
              label="Figer"
            >
              {Icon.pause}
            </CtlButton>
            <CtlButton active={play === 'live'} onClick={() => setPlay('live')} label="Direct">
              {Icon.live}
            </CtlButton>
          </div>
          <div className="relative flex h-8 min-w-[200px] flex-1 items-center px-2">
            <div className="pointer-events-none absolute right-2 left-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-ai" style={{ width: `${sliderProgress}%` }} />
            </div>
            <input
              type="range"
              min={now - 1440}
              max={now}
              value={viewT}
              onChange={(e) => {
                const v = Number(e.target.value)
                setCursor(v)
                setReplayComplete(false)
                setPlay(v >= now ? 'live' : 'pause')
              }}
              className="playback-slider relative z-10 w-full"
              aria-label="Position dans l’historique"
            />
          </div>
          <span className="w-24 text-right font-mono text-[11px] text-mute">
            {viewT === now ? 'maintenant' : `−${fmtDur(now - viewT)}`}
          </span>
          <div role="group" aria-label="Vitesse de lecture" className="inline-flex rounded-md border border-line bg-panel-2 p-0.5">
            {(['2', '4', '12'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={speed === v} onClick={() => setSpeed(v)} className={`rounded px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ai ${speed === v ? 'bg-ai text-white shadow-sm' : 'text-mute hover:text-fg'}`}>
                ×{v}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <div className="col-span-12 flex flex-col gap-4 xl:col-span-4">
        <Panel code="E.2" title="État de la virole" right={<Badge tone={tone}>{tone === 'ok' ? 'Normal' : tone === 'warn' ? 'Alerte' : 'Critique'}</Badge>}>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Maximum instantané" value={fmt(maxT)} unit="°C" tone={tone === 'ok' ? undefined : tone} />
            <Stat label="Position" value={fmt(maxX, 1)} unit="m" />
            <Stat label="Au-dessus du seuil (3 h)" value={fmtDur(above)} />
            <Stat label="Max fenêtre 3 h" value={fmt(Math.max(...envelope))} unit="°C" />
          </div>
        </Panel>
        <Panel code="E.3" title="Seuils d’alerte exploitant" subtitle="Appliqués à la cartographie, au profil et aux alarmes">
          <div className="grid grid-cols-2 gap-3">
            <ThresholdInput label="Alerte" tone="warn" value={thresholds.alert} onChange={(v) => setThresholds({ ...thresholds, alert: Math.min(v, thresholds.crit - 5) })} />
            <ThresholdInput label="Critique" tone="crit" value={thresholds.crit} onChange={(v) => setThresholds({ ...thresholds, crit: Math.max(v, thresholds.alert + 5) })} />
          </div>
        </Panel>
        <Panel code="E.5" title="Durée des dépassements" subtitle="Temps au-dessus des seuils sur 3 h, par zone" className="min-h-0 flex-1">
          <div className="flex h-full flex-col justify-between gap-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-mute">
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-warn" />Alerte seule</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-crit" />Critique</span>
            </div>
            {zoneExposure.map((zone) => (
              <div key={zone.label}>
                <div className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="font-medium text-fg">{zone.label}</span>
                  <span className="font-mono tabular-nums text-fg">{fmtDur(zone.alertMinutes + zone.criticalMinutes)} au-dessus</span>
                </div>
                <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-line" aria-label={`${zone.label} : ${fmtDur(zone.alertMinutes)} en alerte seule, ${fmtDur(zone.criticalMinutes)} en critique`}>
                  <div className="h-full bg-warn" style={{ width: `${(zone.alertMinutes / ROWS) * 100}%` }} />
                  <div className="h-full bg-crit" style={{ width: `${(zone.criticalMinutes / ROWS) * 100}%` }} />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[10.5px]">
                  <span className="text-warn">{fmtDur(zone.alertMinutes)} alerte</span>
                  <span className="text-crit">{fmtDur(zone.criticalMinutes)} critique</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel code="E.4" title="Profil axial instantané" subtitle={`Température de virole à ${hhmm(viewT)} et enveloppe maximale sur 3 h`} className="col-span-12">
        <AxialProfile profile={profile} envelope={envelope} thresholds={thresholds} />
      </Panel>
    </div>
  )
}

function fmtDur(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}

function CtlButton({ children, onClick, active, label }: { children: React.ReactNode; onClick: () => void; active: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[12px] transition-colors ${active ? 'border-ai bg-ai text-white shadow-sm' : 'border-line text-mute hover:border-ai/50 hover:text-fg'}`}
    >
      {children}
      {label}
    </button>
  )
}

function ThresholdInput({ label, value, onChange, tone }: { label: string; value: number; onChange: (v: number) => void; tone: 'warn' | 'crit' }) {
  return (
    <label className="block">
      <span className={`text-[10.5px] uppercase tracking-wider ${tone === 'warn' ? 'text-warn' : 'text-crit'}`}>{label}</span>
      <div className="mt-1 flex items-center rounded border border-line bg-bg focus-within:border-ai/60">
        <input
          type="number"
          step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full bg-transparent px-2 py-1.5 font-mono text-[14px] text-fg outline-none"
        />
        <span className="pr-2 text-[11px] text-dim">°C</span>
      </div>
    </label>
  )
}

function ColorScale({ thresholds, height: H }: { thresholds: { alert: number; crit: number }; height: number }) {
  const pos = (v: number) => H - ((v - TMIN) / (TMAX - TMIN)) * H
  return (
    <div className="relative w-16 shrink-0" style={{ height: H }}>
      <div
        className="absolute top-0 left-0 w-3 rounded-sm"
        style={{
          height: H,
          background: `linear-gradient(to top, ${STOPS.map(([p]) => `${rgb(TMIN + p * (TMAX - TMIN))} ${p * 100}%`).join(',')})`,
        }}
      />
      {[150, 200, 250, 300, 350, 400].map((v) => (
        <span key={v} className="absolute left-4 -translate-y-1/2 font-mono text-[10px] text-dim" style={{ top: pos(v) }}>
          {v}
        </span>
      ))}
      {[
        { v: thresholds.alert, c: 'bg-warn', t: 'text-warn' },
        { v: thresholds.crit, c: 'bg-crit', t: 'text-crit' },
      ].map((s) => (
        <div key={s.t} className="absolute left-0 flex -translate-y-1/2 items-center" style={{ top: pos(s.v) }}>
          <span className={`h-0.5 w-4 ${s.c}`} />
          <span className={`ml-7 font-mono text-[10px] font-medium ${s.t}`}>{s.v}</span>
        </div>
      ))}
      <span className="absolute -bottom-5 left-0 text-[10px] text-dim">°C</span>
    </div>
  )
}

function AxialProfile({ profile, envelope, thresholds }: { profile: number[]; envelope: number[]; thresholds: { alert: number; crit: number } }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const H = 200
  const m = { l: 44, r: 12, t: 10, b: 24 }
  const iw = Math.max(10, w - m.l - m.r)
  const ih = H - m.t - m.b
  const x = (i: number) => m.l + ((i + 0.5) / profile.length) * iw
  const y = (v: number) => m.t + ih - ((v - TMIN) / (TMAX - TMIN)) * ih
  const line = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  return (
    <div ref={ref}>
      {w > 0 && (
        <svg width={w} height={H}>
          <defs>
            <linearGradient id="prof" x1="0" x2="0" y1="1" y2="0">
              {STOPS.map(([p]) => (
                <stop key={p} offset={p} stopColor={rgb(TMIN + p * (TMAX - TMIN))} />
              ))}
            </linearGradient>
          </defs>
          {[150, 200, 250, 300, 350, 400].map((v) => (
            <g key={v}>
              <line x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} className="stroke-line" />
              <text x={m.l - 6} y={y(v) + 3} textAnchor="end" className="fill-dim font-mono text-[10px]">
                {v}
              </text>
            </g>
          ))}
          {[0, 12, 24, 36, 48, 60, 72].map((d) => (
            <text key={d} x={m.l + (d / SHELL_LEN) * iw} y={H - 6} textAnchor="middle" className="fill-dim font-mono text-[10px]">
              {d} m
            </text>
          ))}
          <path d={`${line(profile)}L${x(profile.length - 1)},${y(TMIN)}L${x(0)},${y(TMIN)}Z`} fill="url(#prof)" fillOpacity={0.22} />
          <path d={line(envelope)} fill="none" className="stroke-mute" strokeDasharray="3 3" />
          <path d={line(profile)} fill="none" stroke="var(--color-chart-5)" strokeWidth={1.75} />
          {[
            { v: thresholds.alert, c: 'var(--color-warn)', l: 'Alerte' },
            { v: thresholds.crit, c: 'var(--color-crit)', l: 'Critique' },
          ].map((s) => (
            <g key={s.l}>
              <line x1={m.l} x2={m.l + iw} y1={y(s.v)} y2={y(s.v)} stroke={s.c} strokeDasharray="6 4" />
              <text x={m.l + iw - 4} y={y(s.v) - 4} textAnchor="end" fill={s.c} className="text-[10px]">
                {s.l} {s.v} °C
              </text>
            </g>
          ))}
          {profile.map((v, i) =>
            v > thresholds.alert ? <circle key={i} cx={x(i)} cy={y(v)} r={2} fill={v > thresholds.crit ? 'var(--color-crit)' : 'var(--color-warn)'} /> : null,
          )}
        </svg>
      )}
      <div className="mt-1 flex gap-5 text-[11px] text-mute">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3" style={{ background: 'var(--color-chart-5)' }} /> Profil instantané
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t border-dashed border-mute" /> Enveloppe max 3 h
        </span>
      </div>
    </div>
  )
}
