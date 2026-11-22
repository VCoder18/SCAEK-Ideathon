import { useState } from 'react'
import { TimeChart, useWidth } from '../components/charts'
import { Badge, Panel, Segmented, Stat } from '../components/ui'
import { fcaoUncert, fcSeries, FCAO_TARGET, FCAO_TOL, fmt, hhmm, isLab, labValue, mean, signed, timesFor, value } from '../lib/sim'

export function Quality({ now }: { now: number }) {
  const [win, setWin] = useState('720')
  const hist = Number(win)
  const times = timesFor(now, hist, 60)
  const est = times.map((t) => (t <= now ? value('fcao', t) : null))
  const lo = times.map((t, i) => (est[i] == null ? null : est[i]! - fcaoUncert(t)))
  const hi = times.map((t, i) => (est[i] == null ? null : est[i]! + fcaoUncert(t)))
  const lab = times.map((t) => (t <= now && isLab(t) ? labValue(t) : null))
  const fc = fcSeries('fcao', times, now)

  // historique des erreurs : 36 derniers prélèvements
  const lastLab = now - ((((now - 20) % 60) + 60) % 60)
  const samples = Array.from({ length: 36 }, (_, i) => lastLab - (35 - i) * 60).map((t) => ({
    t,
    lab: labValue(t),
    pred: value('fcao', t),
    err: labValue(t) - value('fcao', t),
  }))
  const errs = samples.map((s) => s.err)
  const mae = mean(errs.map(Math.abs))
  const bias = mean(errs)
  const rmse = Math.sqrt(mean(errs.map((e) => e * e)))
  const within = errs.filter((e) => Math.abs(e) <= 0.2).length / errs.length
  const last = samples[samples.length - 1]
  const curEst = value('fcao', now)
  const inTol = curEst >= FCAO_TOL[0] && curEst <= FCAO_TOL[1]

  return (
    <div className="grid grid-cols-12 gap-4">
      <Panel
        code="C.1"
        title="Chaux libre — estimation continue et laboratoire"
        subtitle="Capteur logiciel (ligne), analyses laboratoire (points), consigne et zone de tolérance, bande d’incertitude"
        className="col-span-12 xl:col-span-9 xl:h-full"
        right={
          <Segmented
            value={win}
            onChange={setWin}
            options={[
              { value: '360', label: '6 h' },
              { value: '720', label: '12 h' },
              { value: '1440', label: '24 h' },
            ]}
          />
        }
      >
        <TimeChart
          times={times}
          nowT={now}
          height={340}
          domains={{ L0: [0.4, 2.2] }}
          zones={[{ axis: 'L0', from: FCAO_TOL[0], to: FCAO_TOL[1], color: 'rgba(76,195,138,0.06)', label: `Tolérance ${fmt(FCAO_TOL[0], 1)}–${fmt(FCAO_TOL[1], 1)} %` }]}
          lines={[
            { axis: 'L0', value: FCAO_TARGET, color: 'var(--color-ok)', label: `Cible ${fmt(FCAO_TARGET, 1)} %` },
            { axis: 'L0', value: FCAO_TOL[1], color: 'var(--color-warn)' },
            { axis: 'L0', value: FCAO_TOL[0], color: 'var(--color-warn)' },
          ]}
          series={[
            { key: 'est', label: 'Estimation', unit: '%', color: 'var(--color-ai)', axis: 'L0', values: est, band: { lo, hi }, dec: 2, width: 1.75 },
            { key: 'fc', label: 'Prévision', unit: '%', color: 'var(--color-ai)', axis: 'L0', values: fc.mid, band: fc, kind: 'dash', dec: 2, legend: false },
            { key: 'lab', label: 'Laboratoire', unit: '%', color: 'var(--color-fg)', axis: 'L0', values: lab, kind: 'points', dec: 2 },
          ]}
        />
      </Panel>

      <div className="col-span-12 flex flex-col gap-4 xl:col-span-3 xl:h-full">
        <Panel title="Estimation actuelle" className="min-h-0 flex-1" right={<Badge tone={inTol ? 'ok' : 'crit'}>{inTol ? 'Dans la tolérance' : 'Hors tolérance'}</Badge>}>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[34px] leading-none text-fg">{fmt(curEst, 2)}</span>
            <span className="text-dim">%</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Prévue +30 min" value={fmt(fc.mid[hist - 1 + 30], 2)} unit="%" />
            <div className="min-w-0">
              <div className="text-[10.5px] uppercase tracking-wider text-dim">Prévue +60 min</div>
              <div className="mt-0.5 flex items-baseline justify-between gap-2 font-data text-[15px] tabular-nums text-fg">
                <span>{fmt(fc.mid[hist + 59], 2)}<span className="ml-1 font-sans text-[11px] text-dim">%</span></span>
                <span className="shrink-0 text-[12px] text-mute">± {fmt(fcaoUncert(now), 2)}</span>
              </div>
            </div>
          </div>
        </Panel>
        <Panel title="Dernière analyse laboratoire" className="min-h-0 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Prélèvement" value={hhmm(last.t)} />
            <Stat label="Mesure" value={fmt(last.lab, 2)} unit="%" />
            <Stat label="Prédiction" value={fmt(last.pred, 2)} unit="%" />
            <Stat label="Écart" value={signed(last.err, 2)} unit="%" tone={Math.abs(last.err) > 0.2 ? 'warn' : undefined} />
          </div>
          <p className="mt-3 text-[11.5px] text-mute">
            Prochain prélèvement à <span className="font-mono text-fg">{hhmm(last.t + 60)}</span>. La bande d’incertitude
            s’élargit avec le temps écoulé depuis le dernier recalage.
          </p>
        </Panel>
      </div>

      <Panel
        code="C.2"
        title="Historique des erreurs prédiction / laboratoire"
        subtitle="Écart = laboratoire − estimation au moment du prélèvement · 36 derniers échantillons"
        className="col-span-12"
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <ErrorBars samples={samples} />
          <div className="grid grid-cols-2 content-start gap-4 border-line lg:border-l lg:pl-6">
            <Stat label="MAE" value={fmt(mae, 3)} unit="%" />
            <Stat label="RMSE" value={fmt(rmse, 3)} unit="%" />
            <Stat label="Biais moyen" value={signed(bias, 3)} unit="%" tone={Math.abs(bias) > 0.05 ? 'warn' : undefined} />
            <Stat label="Écart ≤ 0,2 %" value={fmt(within * 100)} unit="%" />
            <p className="col-span-2 text-[11.5px] text-mute">
              Un biais persistant au-delà de ±0,05 % déclenche une proposition de recalage du capteur logiciel, soumise à
              validation.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  )
}

function ErrorBars({ samples }: { samples: { t: number; err: number }[] }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const H = 170
  const m = { l: 40, r: 8, t: 10, b: 22 }
  const iw = Math.max(10, w - m.l - m.r)
  const ih = H - m.t - m.b
  const D = 0.4
  const y = (v: number) => m.t + ih / 2 - (v / D) * (ih / 2)
  const bw = iw / samples.length
  return (
    <div ref={ref} className="relative">
      {w > 0 && (
        <svg width={w} height={H}>
          <rect x={m.l} width={iw} y={y(0.2)} height={y(-0.2) - y(0.2)} fill="rgba(76,195,138,0.05)" />
          {[-0.4, -0.2, 0, 0.2, 0.4].map((v) => (
            <g key={v}>
              <line x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-mute' : 'stroke-line'} strokeDasharray={v === 0 ? undefined : '2 4'} />
              <text x={m.l - 6} y={y(v) + 3} textAnchor="end" className="fill-dim font-mono text-[10px]">
                {signed(v, 1)}
              </text>
            </g>
          ))}
          {samples.map((s, i) => {
            const big = Math.abs(s.err) > 0.2
            return (
              <g key={s.t} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={m.l + i * bw} y={m.t} width={bw} height={ih} fill="transparent" />
                <rect
                  x={m.l + i * bw + bw * 0.2}
                  width={bw * 0.6}
                  y={Math.min(y(0), y(s.err))}
                  height={Math.abs(y(s.err) - y(0))}
                  fill={big ? 'var(--color-warn)' : 'var(--color-chart-2)'}
                  fillOpacity={hover === i ? 1 : 0.7}
                />
                {i % 6 === 0 && (
                  <text x={m.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" className="fill-dim font-mono text-[10px]">
                    {hhmm(s.t)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
      {hover != null && (
        <div
          className="pointer-events-none absolute top-0 rounded border border-line bg-panel-2 px-2 py-1 font-mono text-[11px] text-fg"
          style={{ left: Math.min(w - 120, m.l + hover * bw) }}
        >
          {hhmm(samples[hover].t)} · {signed(samples[hover].err, 3)} %
        </div>
      )}
    </div>
  )
}
