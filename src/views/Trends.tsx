import { useState } from 'react'
import { TimeChart, type AxisId, type Series } from '../components/charts'
import { Panel, Segmented } from '../components/ui'
import { eventsBetween, fcSeries, histSeries, timesFor, VARS, type VarKey } from '../lib/sim'

const GROUPS: { code: string; title: string; subtitle: string; vars: { key: VarKey; axis: AxisId; color: string }[] }[] = [
  {
    code: 'B.1',
    title: 'Combustion',
    subtitle: 'CO, O₂ et NOx en sortie de four',
    vars: [
      { key: 'co', axis: 'L0', color: 'var(--color-chart-1)' },
      { key: 'o2', axis: 'R0', color: 'var(--color-chart-2)' },
      { key: 'nox', axis: 'R1', color: 'var(--color-chart-3)' },
    ],
  },
  {
    code: 'B.2',
    title: 'Thermique',
    subtitle: 'Températures de cuisson, précalcinateur et air secondaire',
    vars: [
      { key: 'tBurn', axis: 'L0', color: 'var(--color-chart-5)' },
      { key: 'tCalc', axis: 'R0', color: 'var(--color-chart-4)' },
      { key: 'tSec', axis: 'R1', color: 'var(--color-chart-1)' },
    ],
  },
  {
    code: 'B.3',
    title: 'Tirage',
    subtitle: 'Tirage du ventilateur ID et pressions différentielles des cyclones',
    vars: [
      { key: 'draft', axis: 'L0', color: 'var(--color-chart-2)' },
      { key: 'dpC4', axis: 'R0', color: 'var(--color-chart-5)' },
      { key: 'dpC5', axis: 'R1', color: 'var(--color-chart-3)' },
    ],
  },
  {
    code: 'B.4',
    title: 'Alimentation et cinématique',
    subtitle: 'Débit farine, vitesse, couple et intensité du four',
    vars: [
      { key: 'feed', axis: 'L0', color: 'var(--color-chart-4)' },
      { key: 'speed', axis: 'L1', color: 'var(--color-chart-2)' },
      { key: 'torque', axis: 'R0', color: 'var(--color-chart-5)' },
      { key: 'current', axis: 'R1', color: 'var(--color-chart-3)' },
    ],
  },
]

export function Trends({ now }: { now: number }) {
  const [win, setWin] = useState('240')
  const [showFc, setShowFc] = useState(true)
  const [showEv, setShowEv] = useState(true)
  const [hover, setHover] = useState<number | null>(null)
  const hist = Number(win)
  const fcLen = showFc ? Math.min(60, Math.round(hist / 4)) : 0
  const times = timesFor(now, hist, fcLen)
  const events = showEv ? eventsBetween(times[0], now) : []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[12.5px] text-mute">
          Variables superposées sur une même base temporelle, chacune avec son axe dédié. Résolution 1 minute, curseur
          synchronisé entre les graphiques. Les repères verticaux indiquent l’heure d’un incident ; les seuils de procédé sont horizontaux.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Toggle on={showEv} set={setShowEv} label="Marqueurs d’alarme" />
          <Toggle on={showFc} set={setShowFc} label="Prévision" />
          <Segmented
            value={win}
            onChange={setWin}
            options={[
              { value: '60', label: '1 h' },
              { value: '120', label: '2 h' },
              { value: '240', label: '4 h' },
              { value: '480', label: '8 h' },
            ]}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        {GROUPS.map((g) => {
          const series: Series[] = []
          for (const v of g.vars) {
            const d = VARS[v.key]
            series.push({ key: v.key, label: d.short, unit: d.unit, color: v.color, axis: v.axis, values: histSeries(v.key, times, now), dec: d.dec })
            if (fcLen) {
              const f = fcSeries(v.key, times, now)
              series.push({ key: v.key + 'f', label: d.short + ' (prév.)', unit: d.unit, color: v.color, axis: v.axis, values: f.mid, band: f, kind: 'dash', legend: false, dec: d.dec })
            }
          }
          return (
            <Panel key={g.code} code={g.code} title={g.title} subtitle={g.subtitle}>
              <TimeChart times={times} series={series} nowT={fcLen ? now : undefined} events={events} height={240} hoverT={hover} onHover={setHover} />
            </Panel>
          )
        })}
      </div>
    </div>
  )
}

export function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => set(!on)} className="flex items-center gap-2 text-[12px] text-mute hover:text-fg">
      <span className={`relative h-4 w-7 rounded-full transition-colors ${on ? 'bg-ai/70' : 'bg-line'}`}>
        <span className={`absolute top-0.5 size-3 rounded-full bg-fg transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  )
}
