import { TimeChart, Sparkline } from '../components/charts'
import { Badge, Dot, Panel, Stat, type Tone } from '../components/ui'
import {
  eventsBetween,
  fcSeries,
  FCAO_TOL,
  FCAO_TARGET,
  fmt,
  hhmm,
  histSeries,
  mean,
  shellTemp,
  signed,
  timesFor,
  value,
  VARS,
  type VarKey,
} from '../lib/sim'
import { AUTH_META, effectiveStatus, MODE_META, RECOS, STATUS_META, type DriveMode, type RecoStatus } from '../lib/recos'

type KpiKey = 'thermal' | 'elec' | 'prod' | 'stab'
export const KPI_DEFS: { key: KpiKey; target: number; better: 'low' | 'high'; tol: number }[] = [
  { key: 'thermal', target: 760, better: 'low', tol: 0.015 },
  { key: 'elec', target: 28.0, better: 'low', tol: 0.03 },
  { key: 'prod', target: 4800, better: 'high', tol: 0.015 },
  { key: 'stab', target: 85, better: 'high', tol: 0.06 },
]

export function kpiState(v: number, target: number, better: 'low' | 'high', tol: number): { tone: Tone; label: string } {
  const gap = better === 'low' ? (v - target) / target : (target - v) / target
  if (gap <= 0) return { tone: 'ok', label: 'Objectif atteint' }
  if (gap <= tol) return { tone: 'warn', label: 'Proche objectif' }
  return { tone: 'crit', label: 'Hors objectif' }
}

export function KpiCard({ k, now }: { k: (typeof KPI_DEFS)[number]; now: number }) {
  const d = VARS[k.key]
  // valeur lissée sur 15 min pour la lecture, mini-tendance 8 h
  const smooth = (t: number) => mean(Array.from({ length: 15 }, (_, i) => value(k.key, t - i)))
  const v = smooth(now)
  const prev = smooth(now - 60)
  const delta = v - prev
  const st = kpiState(v, k.target, k.better, k.tol)
  const spark = Array.from({ length: 96 }, (_, i) => smooth(now - (95 - i) * 5))
  const improving = k.better === 'low' ? delta < 0 : delta > 0
  const flat = Math.abs(delta) < d.amp * 0.08
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-mute">{d.label}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-[28px] leading-none font-medium tabular-nums text-fg">{fmt(v, d.dec)}</span>
            <span className="text-[12px] text-dim">{d.unit}</span>
          </div>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="text-dim">
          Cible <span className="font-mono text-mute">{fmt(k.target, d.dec)}</span>
          <span className="ml-1.5 text-dim">({k.better === 'low' ? '≤' : '≥'})</span>
        </span>
        <span className={`font-mono ${flat ? 'text-mute' : improving ? 'text-ok' : 'text-crit'}`}>
          <span aria-label={flat ? 'Stable' : delta > 0 ? 'En hausse' : 'En baisse'}>{flat ? 'Stable' : delta > 0 ? 'Hausse' : 'Baisse'}</span> {signed(delta, d.dec)} <span className="font-sans text-dim">/ 1 h</span>
        </span>
      </div>
      <div>
        <Sparkline values={spark} target={k.target} color={st.tone === 'ok' ? 'var(--color-mute)' : `var(--color-${st.tone})`} />
        <div className="mt-1 flex justify-between font-mono text-[9.5px] text-dim">
          <span>−8 h</span>
          <span>maintenant</span>
        </div>
      </div>
    </div>
  )
}

function KilnSchematic({ now }: { now: number }) {
  const v = (k: VarKey) => fmt(value(k, now), VARS[k].dec)
  const label = 'fill-mute text-[9px] uppercase tracking-wider'
  const val = 'fill-fg font-mono text-[11px]'
  return (
    <svg viewBox="0 0 440 170" className="w-full">
      {/* tour de préchauffage */}
      <rect x="20" y="10" width="56" height="120" rx="2" className="fill-panel-2 stroke-line" />
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M${28 + (i % 2) * 18},${18 + i * 27} h22 v10 l-8,12 h-6 l-8,-12z`}
          className="fill-bg stroke-dim"
          strokeWidth="1"
        />
      ))}
      {/* précalcinateur */}
      <rect x="84" y="40" width="16" height="78" rx="2" className="fill-panel-2 stroke-line" />
      <rect x="84" y="40" width="16" height="78" rx="2" fill="url(#calc)" opacity="0.6" />
      {/* four */}
      <g transform="rotate(4 100 128)">
        <rect x="100" y="118" width="250" height="22" rx="3" className="fill-panel-2 stroke-line" />
        <rect x="100" y="118" width="250" height="22" rx="3" fill="url(#kiln)" />
        {[150, 300].map((x) => (
          <rect key={x} x={x} y="114" width="8" height="30" rx="1" className="fill-line" />
        ))}
      </g>
      {/* refroidisseur */}
      <path d="M352 138 h66 v22 h-80z" className="fill-panel-2 stroke-line" />
      <defs>
        <linearGradient id="kiln" x1="0" x2="1">
          <stop offset="0" stopColor="#f0b03f" stopOpacity="0.05" />
          <stop offset="0.7" stopColor="#f07a3f" stopOpacity="0.35" />
          <stop offset="0.95" stopColor="#ffd27a" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="calc" x1="0" x2="0" y1="1" y2="0">
          <stop offset="0" stopColor="#f07a3f" stopOpacity="0.4" />
          <stop offset="1" stopColor="#f07a3f" stopOpacity="0" />
        </linearGradient>
      </defs>

      <text x="20" y="152" className={label}>Préchauffeur</text>
      <text x="108" y="22" className={label}>Précalc.</text>
      <text x="108" y="36" className={val}>{v('tCalc')} °C</text>
      <text x="160" y="62" className={label}>Entrée four</text>
      <text x="160" y="76" className={val}>O₂ {v('o2')} % · CO {v('co')}</text>
      <text x="160" y="90" className={val}>Farine {v('feed')} t/h</text>
      <text x="300" y="62" className={label}>Zone de cuisson</text>
      <text x="300" y="76" className={val}>{v('tBurn')} °C</text>
      <text x="300" y="90" className={val}>{v('speed')} tr/min</text>
      <text x="370" y="128" className={label}>Air sec.</text>
      <text x="356" y="152" className={val}>{v('tSec')} °C</text>
      <line x1="320" y1="96" x2="330" y2="136" className="stroke-dim" strokeDasharray="2 2" />
      <line x1="170" y1="96" x2="150" y2="124" className="stroke-dim" strokeDasharray="2 2" />
    </svg>
  )
}

export interface Alert {
  id: string
  t: number
  severity: 'critique' | 'alerte' | 'info'
  title: string
  detail: string
  source: string
}

export function buildAlerts(now: number, shellAlert: number): Alert[] {
  const out: Alert[] = []
  // point chaud virole
  let maxT = 0
  let maxX = 0
  for (let x = 0; x <= 72; x += 0.5) {
    const v = shellTemp(x, now)
    if (v > maxT) (maxT = v), (maxX = x)
  }
  if (maxT > shellAlert)
    out.push({
      id: 'shell',
      t: now,
      severity: maxT > shellAlert + 30 ? 'critique' : 'alerte',
      title: `Point chaud virole à ${fmt(maxX, 1)} m`,
      detail: `${fmt(maxT)} °C — seuil exploitant ${fmt(shellAlert)} °C`,
      source: 'Scanner virole',
    })
  const f40 = fcSeries('fcao', [now + 40], now).mid[0]!
  if (f40 > FCAO_TOL[1] - 0.15)
    out.push({
      id: 'fcao',
      t: now,
      severity: f40 > FCAO_TOL[1] ? 'critique' : 'alerte',
      title: 'Chaux libre prédite en limite haute',
      detail: `${fmt(f40, 2)} % prévu à +40 min (tolérance ≤ ${fmt(FCAO_TOL[1], 1)} %)`,
      source: 'Capteur logiciel',
    })
  for (const e of eventsBetween(now - 8, now).reverse())
    out.push({ id: e.id, t: e.t, severity: e.severity, title: e.label, detail: e.detail, source: 'Détection anomalies' })
  const rank = { critique: 0, alerte: 1, info: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || b.t - a.t)
}

export function Overview({
  now,
  mode,
  statuses,
  shellAlert,
  latency,
  goTo,
}: {
  now: number
  mode: DriveMode
  statuses: Record<string, RecoStatus>
  shellAlert: number
  latency: number
  goTo: (tab: string) => void
}) {
  const alerts = buildAlerts(now, shellAlert)
  const crit = alerts.filter((a) => a.severity === 'critique').length
  const stab = mean(Array.from({ length: 15 }, (_, i) => value('stab', now - i)))
  const procTone: Tone = crit > 0 ? 'crit' : stab < 80 || alerts.length > 2 ? 'warn' : 'ok'
  const procLabel = procTone === 'ok' ? 'Stable' : procTone === 'warn' ? 'Sous surveillance' : 'Instable'

  const times = timesFor(now, 120, 60)
  const fc = fcSeries('fcao', times, now)
  const fcT = fcSeries('tBurn', times, now)

  return (
    <div className="grid grid-cols-12 gap-4">
      <Panel
        code="A.1"
        title="État global du procédé"
        className="col-span-12 xl:col-span-5 xl:h-full"
        bodyClass="flex flex-1 flex-col p-4"
        right={<Badge tone={procTone}>{procLabel}</Badge>}
      >
        <div className="flex min-h-[180px] flex-1 items-center justify-center py-3">
          <KilnSchematic now={now} />
        </div>
        <div className="mt-3 grid grid-cols-4 gap-3 border-t border-line pt-3">
          <Stat label="Stabilité 15 min" value={fmt(stab)} unit="%" tone={stab < 80 ? 'warn' : undefined} />
          <Stat label="Alarmes actives" value={alerts.length} tone={crit ? 'crit' : alerts.length ? 'warn' : 'ok'} />
          <Stat label="Couple four" value={fmt(value('torque', now))} unit="kN·m" />
          <Stat label="Intensité" value={fmt(value('current', now))} unit="A" />
        </div>
      </Panel>

      <Panel
        code="A.2"
        title="Système IA"
        subtitle="Couche logicielle d’estimation, de prévision et d’aide à la conduite — indépendante des sécurités DCS."
        className="col-span-12 md:col-span-6 xl:col-span-4"
        right={
          <Badge tone="ok">
            <Dot tone="ok" /> Opérationnel
          </Badge>
        }
      >
        <ul className="divide-y divide-line text-[12.5px]">
          {[
            { n: 'Capteur logiciel chaux libre', m: 'MAE 0,11 % · recalé il y a 48 min', tone: 'ok' as Tone },
            { n: 'Modèle dynamique (horizon 60 min)', m: 'R² 0,91 sur 7 jours glissants', tone: 'ok' as Tone },
            { n: 'Optimiseur multi-objectifs', m: `${RECOS.length} recommandations actives`, tone: 'ai' as Tone },
            { n: 'Détection de dérive des données', m: 'Légère dérive ΔP C4 — surveillée', tone: 'warn' as Tone },
          ].map((r) => (
            <li key={r.n} className="flex items-center gap-3 py-2.5 first:pt-0">
              <Dot tone={r.tone} />
              <div className="min-w-0">
                <div className="text-fg">{r.n}</div>
                <div className="text-[11.5px] text-mute">{r.m}</div>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded border border-line bg-bg p-3">
          <div className="text-[10.5px] uppercase tracking-wider text-dim">Mode de conduite actif</div>
          <div className="mt-1 flex items-center gap-2 text-[14px] font-semibold text-ai">{MODE_META[mode].label}</div>
          <p className="mt-0.5 text-[11.5px] text-mute">{MODE_META[mode].desc}</p>
        </div>
      </Panel>

      <Panel
        code="A.3"
        title="Communication DCS"
        className="col-span-12 md:col-span-6 xl:col-span-3"
        right={
          <Badge tone="ok">
            <Dot tone="ok" pulse /> Connecté
          </Badge>
        }
      >
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-[12px]">
          <Stat label="Protocole" value={<span className="text-[13px]">OPC UA</span>} />
          <Stat label="Latence" value={latency} unit="ms" tone={latency > 120 ? 'warn' : undefined} />
          <Stat label="Dernier échange" value={hhmm(now)} />
          <Stat label="Chien de garde" value={<span className="text-[13px]">OK</span>} tone="ok" />
          <Stat label="Tags valides" value="1 247" unit="/ 1 250" />
          <Stat
            label="Écriture consignes"
            value={<span className="text-[13px]">{mode === 'conseil' ? 'Bloquée' : 'Autorisée'}</span>}
            tone={mode === 'conseil' ? undefined : 'ai'}
          />
        </dl>
        <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-[11.5px]">
          {[
            ['Historien', 'Synchronisé'],
            ['LIMS laboratoire', `Dernier lot ${hhmm(now - (((now - 20) % 60) + 60) % 60)}`],
            ['Systèmes de sécurité (SIS)', 'Indépendants — non pilotés'],
          ].map(([a, b]) => (
            <div key={a} className="flex justify-between gap-2">
              <span className="text-mute">{a}</span>
              <span className="text-right text-fg">{b}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_DEFS.map((k) => (
          <KpiCard key={k.key} k={k} now={now} />
        ))}
      </div>

      <Panel
        code="A.4"
        title="Alertes prioritaires"
        subtitle="Triées par criticité puis par ancienneté"
        className="col-span-12 xl:col-span-5"
        bodyClass="p-0"
        right={
          <button onClick={() => goTo('diag')} className="inline-flex items-center justify-center rounded-md border border-ai/35 bg-ai/8 px-3 py-1.5 text-[12px] font-medium text-ai shadow-sm transition-colors hover:border-ai/60 hover:bg-ai/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai">
            Diagnostic
          </button>
        }
      >
        <ul className="max-h-[330px] divide-y divide-line overflow-y-auto">
          {alerts.length === 0 && <li className="p-4 text-[12.5px] text-mute">Aucune alerte active.</li>}
          {alerts.map((a) => (
            <li key={a.id} className="flex gap-3 px-4 py-3">
              <span
                className={`mt-0.5 w-1 shrink-0 self-stretch rounded-full ${a.severity === 'critique' ? 'bg-crit' : 'bg-warn'}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] font-medium text-fg">{a.title}</span>
                  <span className="font-mono text-[11px] text-dim">{hhmm(a.t)}</span>
                </div>
                <div className="text-[11.5px] text-mute">{a.detail}</div>
                <div className="mt-1 text-[10.5px] uppercase tracking-wider text-dim">{a.source}</div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        code="A.5"
        title="Anticipation à 60 minutes"
        subtitle="Température de cuisson et chaux libre estimée, avec bandes d’incertitude"
        className="col-span-12 xl:col-span-7"
      >
        <TimeChart
          times={times}
          nowT={now}
          height={260}
          events={eventsBetween(times[0], now)}
          zones={[{ axis: 'R0', from: FCAO_TOL[0], to: FCAO_TOL[1], color: 'rgba(76,195,138,0.05)' }]}
          lines={[{ axis: 'R0', value: FCAO_TARGET, color: 'rgba(76,195,138,0.6)' }]}
          series={[
            { key: 'tb', label: 'T° cuisson', unit: '°C', color: 'var(--color-chart-5)', axis: 'L0', values: histSeries('tBurn', times, now), dec: 0 },
            { key: 'tbf', label: 'T° cuisson (prév.)', unit: '°C', color: 'var(--color-chart-5)', axis: 'L0', values: fcT.mid, band: fcT, kind: 'dash', legend: false, dec: 0 },
            { key: 'fc', label: 'Chaux libre', unit: '%', color: 'var(--color-chart-2)', axis: 'R0', values: histSeries('fcao', times, now), dec: 2 },
            { key: 'fcf', label: 'Chaux libre (prév.)', unit: '%', color: 'var(--color-chart-2)', axis: 'R0', values: fc.mid, band: fc, kind: 'dash', legend: false, dec: 2 },
          ]}
        />
      </Panel>

      <Panel
        code="A.6"
        title="Recommandations en direct"
        subtitle="Valeurs et statuts recalculés avec le flux procédé."
        className="col-span-12"
        bodyClass="p-0"
        right={
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-ok"><Dot tone="ok" pulse />LIVE · {hhmm(now)}</span>
            <button onClick={() => goTo('reco')} className="inline-flex items-center justify-center rounded-md border border-ai/35 bg-ai/8 px-3 py-1.5 text-[12px] font-medium text-ai shadow-sm transition-colors hover:border-ai/60 hover:bg-ai/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai">
              Explicabilité détaillée
            </button>
          </div>
        }
      >
        <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {RECOS.map((r) => {
            const st = STATUS_META[effectiveStatus(r, statuses[r.id], mode)]
            return (
              <button key={r.id} onClick={() => goTo('reco')} className="p-4 text-left hover:bg-panel-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-dim">
                    {r.id} · {r.objective}
                  </span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <div className="mt-1.5 text-[13.5px] font-medium text-fg">{r.title}</div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-mute">
                  <span>
                    Confiance <span className="font-mono text-fg">{Math.round(r.confidence * 100)} %</span>
                  </span>
                  <span>{AUTH_META[r.auth].label}</span>
                </div>
              </button>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
