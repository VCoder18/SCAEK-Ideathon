import { useState } from 'react'
import { TimeChart, useWidth, type AxisId } from '../components/charts'
import { Badge, Panel } from '../components/ui'
import { eventsBetween, fmt, hhmm, histSeries, pearson, signed, timesFor, value, VARS, type KilnEvent, type VarKey } from '../lib/sim'

const COLORS = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)']
const AXES: AxisId[] = ['L0', 'R0', 'R1']

export function Diagnostics({ now }: { now: number }) {
  const events = eventsBetween(now - 720, now).reverse()
  const [selId, setSelId] = useState<string | null>(null)
  const sel = events.find((e) => e.id === selId) ?? events[0]

  return (
    <div className="grid grid-cols-12 gap-4">
      <Panel code="F.1" title="Journal des anomalies" subtitle="12 dernières heures" className="col-span-12 lg:col-span-4" bodyClass="p-0">
        <ul className="max-h-[440px] divide-y divide-line overflow-y-auto">
          {events.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => setSelId(e.id)}
                className={`flex w-full gap-3 px-4 py-2.5 text-left transition-colors ${sel?.id === e.id ? 'bg-panel-2' : 'hover:bg-panel-2/50'}`}
              >
                <span className={`mt-1.5 size-2 shrink-0 rotate-45 ${e.severity === 'critique' ? 'bg-crit' : 'bg-warn'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <span className="truncate text-[12.5px] text-fg">{e.label}</span>
                    <span className="font-mono text-[11px] text-dim">{hhmm(e.t)}</span>
                  </div>
                  <div className="text-[11px] text-mute">
                    {e.id} · {e.kind}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      {sel && <IncidentContext e={sel} now={now} />}

      <ShiftComparison />
      <Pareto />
      <CorrelationMatrix now={now} />
    </div>
  )
}

function IncidentContext({ e, now }: { e: KilnEvent; now: number }) {
  const end = Math.min(now, e.t + 20)
  const times = timesFor(end, end - (e.t - 60) + 1)
  const at = (k: VarKey, dt: number) => value(k, e.t + dt)
  return (
    <Panel
      code="F.2"
      title={`Contexte avant incident — ${e.label}`}
      subtitle={e.detail}
      className="col-span-12 lg:col-span-8"
      right={<Badge tone={e.severity === 'critique' ? 'crit' : 'warn'}>{e.severity}</Badge>}
    >
      <TimeChart
        times={times}
        height={240}
        events={[e]}
        selectedEventId={e.id}
        timeZones={[{ from: e.t - 60, to: e.t, label: 'Fenêtre pré-incident (−60 min)', color: 'rgba(240,176,63,0.04)' }]}
        series={e.vars.map((k, i) => ({
          key: k,
          label: VARS[k].short,
          unit: VARS[k].unit,
          color: COLORS[i],
          axis: AXES[i],
          values: histSeries(k, times, now),
          dec: VARS[k].dec,
        }))}
      />
      <table className="mt-4 w-full text-[12px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-wider text-dim">
            <th className="pb-2 font-medium">Variable</th>
            <th className="pb-2 text-right font-medium">−60 min</th>
            <th className="pb-2 text-right font-medium">−20 min</th>
            <th className="pb-2 text-right font-medium">−5 min</th>
            <th className="pb-2 text-right font-medium">Incident</th>
            <th className="pb-2 text-right font-medium">Dérive de −20 à 0</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line font-mono">
          {e.vars.map((k, i) => {
            const d = VARS[k]
            const drift = at(k, 0) - at(k, -20)
            return (
              <tr key={k}>
                <td className="py-1.5 font-sans text-fg">
                  <span className="mr-2 inline-block size-1.5 rounded-full align-middle" style={{ background: COLORS[i] }} />
                  {d.label} <span className="text-dim">({d.unit})</span>
                </td>
                {[-60, -20, -5, 0].map((dt) => (
                  <td key={dt} className="py-1.5 text-right text-mute">
                    {fmt(at(k, dt), d.dec)}
                  </td>
                ))}
                <td className={`py-1.5 text-right ${Math.abs(drift) > d.amp * 0.5 ? 'text-warn' : 'text-mute'}`}>{signed(drift, d.dec)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Panel>
  )
}

const SHIFTS = [
  { name: 'Équipe A', sub: '06:00–14:00', thermal: 762, fcaoSd: 0.16, stab: 87, alarms: 4, reco: 0.82 },
  { name: 'Équipe B', sub: '14:00–22:00', thermal: 771, fcaoSd: 0.22, stab: 82, alarms: 9, reco: 0.64 },
  { name: 'Équipe C', sub: '22:00–06:00', thermal: 766, fcaoSd: 0.19, stab: 85, alarms: 6, reco: 0.71 },
]
const PERIODS = [
  { name: 'Semaine en cours', sub: 'Mix farine M-12 · coke 70 %', thermal: 766, fcaoSd: 0.19, stab: 85, alarms: 19, reco: 0.72 },
  { name: 'S-2 comparable', sub: 'Mix farine M-12 · coke 70 %', thermal: 774, fcaoSd: 0.24, stab: 81, alarms: 27, reco: 0.58 },
  { name: 'Référence mars', sub: 'Mix M-11 · coke 65 %', thermal: 759, fcaoSd: 0.15, stab: 88, alarms: 14, reco: 0.79 },
]

function ShiftComparison() {
  const cols: { k: keyof (typeof SHIFTS)[number]; label: string; unit: string; dec: number; better: 'low' | 'high'; fmtv?: (v: number) => string }[] = [
    { k: 'thermal', label: 'Conso thermique', unit: 'kcal/kg', dec: 0, better: 'low' },
    { k: 'fcaoSd', label: 'σ chaux libre', unit: '%', dec: 2, better: 'low' },
    { k: 'stab', label: 'Stabilité', unit: '%', dec: 0, better: 'high' },
    { k: 'alarms', label: 'Alarmes', unit: '', dec: 0, better: 'low' },
    { k: 'reco', label: 'Recos suivies', unit: '%', dec: 0, better: 'high', fmtv: (v) => fmt(v * 100) },
  ]
  return (
    <Panel
      code="F.3"
      title="Comparaison des équipes et périodes"
      subtitle="Les deux vues restent visibles : les postes sur 7 jours et les périodes de production avec leur contexte matière et combustible."
      className="col-span-12"
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <ComparisonTable title="Équipes" description="Postes 06–14 h, 14–22 h et 22–06 h sur les 7 derniers jours." rows={SHIFTS} cols={cols} />
        <ComparisonTable title="Périodes" description="Semaines comparables ; le mélange farine et combustible donne le contexte." rows={PERIODS} cols={cols} />
      </div>
      <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-[11.5px] leading-relaxed">
        <p className="flex flex-wrap gap-x-1"><span className="font-semibold text-ok">Vert :</span><span className="text-mute">valeur la plus favorable.</span><span className="ml-2 font-semibold text-warn">Orange :</span><span className="text-mute">valeur la moins favorable dans chaque tableau.</span></p>
        <p className="text-mute">Les écarts reflètent aussi les conditions de marche (qualité farine, arrêts, météo) ; ils ne constituent pas une évaluation individuelle.</p>
      </div>
    </Panel>
  )
}

function ComparisonTable({ title, description, rows, cols }: { title: string; description: string; rows: typeof SHIFTS; cols: { k: keyof (typeof SHIFTS)[number]; label: string; unit: string; dec: number; better: 'low' | 'high'; fmtv?: (v: number) => string }[] }) {
  return <section className="min-w-0">
    <div className="mb-2">
      <h3 className="text-[13px] font-semibold text-fg">{title}</h3>
      <p className="mt-0.5 text-[11.5px] text-mute">{description}</p>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-[12px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-wider text-dim">
            <th className="pb-2 font-medium" />
            {cols.map((c) => <th key={c.k} className="align-top pb-2 text-right font-medium"><div className="flex min-h-9 flex-col justify-between"><span>{c.label}</span><span className="normal-case tracking-normal text-dim">{c.unit || '\u00a0'}</span></div></th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => <tr key={r.name}>
            <td className="py-2.5"><div className="text-fg">{r.name}</div><div className="text-[11px] text-dim">{r.sub}</div></td>
            {cols.map((c) => {
              const vals = rows.map((x) => x[c.k] as number)
              const v = r[c.k] as number
              const best = c.better === 'low' ? Math.min(...vals) : Math.max(...vals)
              const worst = c.better === 'low' ? Math.max(...vals) : Math.min(...vals)
              return <td key={c.k} className={`py-2.5 text-right font-mono ${v === best ? 'text-ok' : v === worst ? 'text-warn' : 'text-mute'}`}>{c.fmtv ? c.fmtv(v) : fmt(v, c.dec)}</td>
            })}
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>
}

const CORR_VARS: VarKey[] = ['co', 'o2', 'nox', 'tBurn', 'tCalc', 'tSec', 'draft', 'dpC4', 'feed', 'current', 'fcao']

function corrColor(r: number) {
  const strength = 14 + Math.min(1, Math.abs(r)) * 30
  const color = r >= 0 ? 'var(--color-corr-positive)' : 'var(--color-corr-negative)'
  return `color-mix(in srgb, ${color} ${strength}%, var(--color-panel))`
}

function CorrelationMatrix({ now }: { now: number }) {
  const [hover, setHover] = useState<[number, number] | null>(null)
  const times = timesFor(now, 360)
  const data = CORR_VARS.map((k) => times.map((t) => value(k, t)))
  const M = CORR_VARS.map((_, i) => CORR_VARS.map((_, j) => (i === j ? 1 : pearson(data[i], data[j]))))
  const n = CORR_VARS.length
  return (
    <Panel
      code="F.4"
      title="Matrice de corrélation"
      subtitle="Outil d’investigation · corrélations sur 6 h, à interpréter comme des pistes et non comme des causes."
      className="col-span-12"
    >
      <div className="flex gap-4">
        <div className="grid flex-1 gap-px" style={{ gridTemplateColumns: `72px repeat(${n}, minmax(0,1fr))` }}>
          <div />
          {CORR_VARS.map((k, j) => (
            <div key={k} className={`truncate pb-1 text-center text-[10px] ${hover?.[1] === j ? 'text-fg' : 'text-dim'}`}>
              {VARS[k].short}
            </div>
          ))}
          {CORR_VARS.map((k, i) => (
            <Row key={k} label={VARS[k].short} active={hover?.[0] === i}>
              {M[i].map((r, j) => (
                <div
                  key={j}
                  onMouseEnter={() => setHover([i, j])}
                  onMouseLeave={() => setHover(null)}
                  className={`flex aspect-square items-center justify-center rounded-[2px] font-mono text-[9.5px] ${hover?.[0] === i && hover?.[1] === j ? 'ring-1 ring-fg' : ''}`}
                  style={{ background: i === j ? 'var(--color-panel-2)' : corrColor(r), color: 'var(--color-fg)' }}
                >
                  <span className="font-medium">{i === j ? '' : fmt(r, 1).replace('-', '−')}</span>
                </div>
              ))}
            </Row>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10.5px] text-dim">
          −1
          <span className="h-2 w-32 rounded-sm" style={{ background: 'linear-gradient(to right, var(--color-corr-negative), var(--color-panel-2), var(--color-corr-positive))' }} />
          +1
        </div>
        <div className="h-4 font-mono text-[11px] text-mute">
          {hover && hover[0] !== hover[1] && (
            <>
              {VARS[CORR_VARS[hover[0]]].short} × {VARS[CORR_VARS[hover[1]]].short} : r = {fmt(M[hover[0]][hover[1]], 2)}
            </>
          )}
        </div>
      </div>
      <p className="mt-2 rounded border border-line bg-bg px-3 py-2 text-[11.5px] text-mute">
        Une corrélation statistique ne prouve pas un lien causal. Vérifiez les mécanismes physiques et le contexte du procédé avant d’agir.
      </p>
    </Panel>
  )
}

function Row({ label, active, children }: { label: string; active: boolean; children: React.ReactNode }) {
  return (
    <>
      <div className={`flex items-center truncate pr-2 text-[10.5px] ${active ? 'text-fg' : 'text-dim'}`}>{label}</div>
      {children}
    </>
  )
}

const PARETO = [
  { cause: 'Défaut ventilateur ID', h: 38 },
  { cause: 'Colmatage cyclone C4', h: 27 },
  { cause: 'Anneau / croûtage', h: 19 },
  { cause: 'Coupure réseau électrique', h: 11 },
  { cause: 'Alimentation farine', h: 8 },
  { cause: 'Réfractaire', h: 6 },
  { cause: 'Autres', h: 4 },
]

function Pareto() {
  const [ref, w] = useWidth<HTMLDivElement>()
  const total = PARETO.reduce((s, p) => s + p.h, 0)
  let cum = 0
  const rows = PARETO.map((p) => ((cum += p.h), { ...p, cum: cum / total }))
  const H = 240
  const m = { l: 36, r: 40, t: 12, b: 56 }
  const iw = Math.max(10, w - m.l - m.r)
  const ih = H - m.t - m.b
  const bw = iw / rows.length
  const yH = (h: number) => m.t + ih - (h / 40) * ih
  const yP = (p: number) => m.t + ih - p * ih
  return (
    <Panel code="F.5" title="Pareto des causes d’arrêt" subtitle={`Heures d’arrêt four · 12 derniers mois · total ${total} h · source GMAO`} className="col-span-12">
      <div ref={ref}>
        {w > 0 && (
          <svg width={w} height={H}>
            {[0, 10, 20, 30, 40].map((v) => (
              <g key={v}>
                <line x1={m.l} x2={m.l + iw} y1={yH(v)} y2={yH(v)} className="stroke-line" />
                <text x={m.l - 6} y={yH(v) + 3} textAnchor="end" className="fill-dim font-mono text-[10px]">
                  {v} h
                </text>
                <text x={m.l + iw + 6} y={yP(v / 40) + 3} className="fill-dim font-mono text-[10px]">
                  {v * 2.5} %
                </text>
              </g>
            ))}
            <line x1={m.l} x2={m.l + iw} y1={yP(0.8)} y2={yP(0.8)} stroke="var(--color-warn)" strokeOpacity={0.6} strokeDasharray="5 4" />
            <text x={m.l + iw - 4} y={yP(0.8) - 4} textAnchor="end" className="fill-warn text-[10px]">
              80 %
            </text>
            {rows.map((r, i) => (
              <g key={r.cause}>
                <rect x={m.l + i * bw + bw * 0.18} width={bw * 0.64} y={yH(r.h)} height={yH(0) - yH(r.h)} fill={r.cum <= 0.8 ? 'var(--color-chart-2)' : 'var(--color-dim)'} rx={1} />
                <text x={m.l + i * bw + bw / 2} y={yH(r.h) - 5} textAnchor="middle" className="fill-fg font-mono text-[10.5px]">
                  {r.h}
                </text>
                <foreignObject x={m.l + i * bw} y={H - m.b + 6} width={bw} height={m.b - 6}>
                  <div className="px-1 text-center text-[10.5px] leading-tight text-mute">{r.cause}</div>
                </foreignObject>
              </g>
            ))}
            <polyline
              points={rows.map((r, i) => `${m.l + i * bw + bw / 2},${yP(r.cum)}`).join(' ')}
              fill="none"
              stroke="var(--color-chart-5)"
              strokeWidth={1.5}
            />
            {rows.map((r, i) => (
              <circle key={i} cx={m.l + i * bw + bw / 2} cy={yP(r.cum)} r={3} fill="var(--color-panel)" stroke="var(--color-chart-5)" strokeWidth={1.5} />
            ))}
          </svg>
        )}
      </div>
    </Panel>
  )
}
