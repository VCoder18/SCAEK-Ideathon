import { useEffect, useRef, useState } from 'react'
import { Dot, Segmented, ThemeToggle } from './components/ui'
import { hash, hhmm, useSimClock } from './lib/sim'
import { MODE_META, RECOS, effectiveStatus, type DriveMode, type RecoStatus } from './lib/recos'
import { buildAlerts, Overview } from './views/Overview'
import { Trends } from './views/Trends'
import { Quality } from './views/Quality'
import { Scanner } from './views/Scanner'
import { Diagnostics } from './views/Diagnostics'
import { Recommendations } from './views/Recommendations'
import { Login } from './views/Login'

const TABS = [
  { id: 'overview', label: 'Vue générale' },
  { id: 'trends', label: 'Tendances' },
  { id: 'quality', label: 'Qualité clinker' },
  { id: 'shell', label: 'Scanner de virole' },
  { id: 'diag', label: 'Diagnostic' },
  { id: 'reco', label: 'Recommandations' },
]

export default function App() {
  const now = useSimClock()
  const [tab, setTab] = useState('overview')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('pyrosage-theme') as 'dark' | 'light') || 'dark')
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem('pyrosage-authenticated') === 'true')
  const [mode, setMode] = useState<DriveMode>('validation')
  const [statuses, setStatuses] = useState<Record<string, RecoStatus>>(() =>
    Object.fromEntries(RECOS.map((r) => [r.id, 'en_attente' as RecoStatus])),
  )
  const [thresholds, setThresholds] = useState({ alert: 330, crit: 370 })
  const latency = 34 + Math.floor(hash(now * 0.77) * 28)

  const alerts = buildAlerts(now, thresholds.alert)
  const activeAnomaly = alerts
    .filter((a) => a.id === 'shell' || a.id === 'fcao' || (a.id.startsWith('EV-') && now - a.t <= 8))
    .sort((a, b) => Number(b.severity === 'critique') - Number(a.severity === 'critique') || b.t - a.t)[0]
  const [latchedAnomaly, setLatchedAnomaly] = useState<typeof activeAnomaly>(null)
  const clearAnomalySince = useRef<number | null>(null)
  const crit = alerts.filter((a) => a.severity === 'critique').length
  const pending = RECOS.filter((r) => effectiveStatus(r, statuses[r.id], mode) === 'en_attente').length
  const [autoHandover, setAutoHandover] = useState<{ id: string; title: string; detail: string; at: number } | null>(null)

  useEffect(() => {
    if (activeAnomaly) {
      clearAnomalySince.current = null
      setLatchedAnomaly(activeAnomaly)
      return
    }
    if (!latchedAnomaly) return
    if (clearAnomalySince.current === null) clearAnomalySince.current = now
    else if (now - clearAnomalySince.current >= 10) {
      clearAnomalySince.current = null
      setLatchedAnomaly(null)
    }
  }, [activeAnomaly?.id, now])

  useEffect(() => {
    if (mode === 'auto' && latchedAnomaly) {
      setMode('validation')
      setAutoHandover({ id: latchedAnomaly.id, title: latchedAnomaly.title, detail: latchedAnomaly.detail, at: now })
    }
  }, [mode, latchedAnomaly?.id])

  function changeMode(next: DriveMode) {
    if (next === 'auto' && latchedAnomaly) {
      setMode('validation')
      setAutoHandover({ id: latchedAnomaly.id, title: latchedAnomaly.title, detail: latchedAnomaly.detail, at: now })
      return
    }
    setMode(next)
  }

  if (!authenticated) {
    return (
      <div data-theme={theme} className="min-h-screen bg-bg text-fg">
        <div className="flex justify-end p-5">
          <ThemeToggle theme={theme} onToggle={() => setTheme((v) => { const next = v === 'dark' ? 'light' : 'dark'; localStorage.setItem('pyrosage-theme', next); return next })} />
        </div>
        <Login onLogin={() => { sessionStorage.setItem('pyrosage-authenticated', 'true'); setAuthenticated(true) }} />
      </div>
    )
  }

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto grid max-w-[1680px] grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-5 py-3 lg:grid-cols-[1fr_auto_1fr] lg:gap-x-6">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 32 32" className="size-8">
              <rect width="32" height="32" rx="6" className="fill-panel-2" />
              <rect x="6" y="14" width="20" height="6" rx="1.5" transform="rotate(-8 16 17)" className="fill-mute" />
              <circle cx="25" cy="15.5" r="3" className="fill-warn" />
              <path d="M8 10h3M8 24h16" className="stroke-dim" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div>
              <div className="font-sans text-[17px] font-bold tracking-tight text-fg">PyroSage</div>
              <div className="text-[11px] text-mute">Four rotatif n° 2 · Ligne clinker</div>
            </div>
          </div>

          <div className="col-span-2 row-start-2 flex justify-center lg:col-span-1 lg:col-start-2 lg:row-start-1">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-dim">Mode de conduite</span>
              <Segmented
                value={mode}
                onChange={changeMode}
                options={(Object.keys(MODE_META) as DriveMode[]).map((m) => ({ value: m, label: MODE_META[m].label }))}
              />
            </div>
          </div>
          <div className="col-start-2 row-start-1 ml-auto flex items-center gap-4 lg:col-start-3">
            <div className="hidden border-l border-line pl-4 text-right sm:block">
              <div className="font-mono text-[18px] leading-none text-fg tabular-nums">{hhmm(now)}</div>
              <div className="mt-1 text-[10px] text-dim">Données simulées ×15</div>
            </div>
            <ThemeToggle theme={theme} onToggle={() => setTheme((v) => { const next = v === 'dark' ? 'light' : 'dark'; localStorage.setItem('pyrosage-theme', next); return next })} />
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1680px] gap-1 overflow-x-auto px-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-[12.5px] transition-colors ${
                tab === t.id ? 'text-fg' : 'text-mute hover:text-fg'
              }`}
            >
              {t.label}
              {t.id === 'reco' && pending > 0 && (
                <span className="rounded-sm bg-ai/15 px-1.5 font-mono text-[10px] text-ai">{pending}</span>
              )}
              {t.id === 'diag' && crit > 0 && <span className="size-1.5 rounded-full bg-crit" />}
              {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-ai" />}
            </button>
          ))}
        </nav>
        {autoHandover && (
          <div role="alert" className="mx-auto flex max-w-[1680px] items-center gap-3 border-t border-crit/30 bg-crit/10 px-5 py-2.5">
            <Dot tone="crit" pulse />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-crit">Automatique suspendu · contrôle rendu à l’opérateur</div>
              <div className="truncate text-[11.5px] text-mute">{autoHandover.title} — {autoHandover.detail} · {hhmm(autoHandover.at)}</div>
            </div>
            <button type="button" onClick={() => setAutoHandover(null)} className="shrink-0 rounded border border-crit/30 px-2.5 py-1 text-[11px] font-medium text-crit hover:bg-crit/10">Acquitter</button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1680px] px-5 py-5">
        {tab === 'overview' && (
          <Overview now={now} mode={mode} statuses={statuses} shellAlert={thresholds.alert} latency={latency} goTo={setTab} />
        )}
        {tab === 'trends' && <Trends now={now} />}
        {tab === 'quality' && <Quality now={now} />}
        {tab === 'shell' && <Scanner now={now} thresholds={thresholds} setThresholds={setThresholds} />}
        {tab === 'diag' && <Diagnostics now={now} />}
        {tab === 'reco' && (
          <Recommendations
            now={now}
            mode={mode}
            statuses={statuses}
            activeAnomaly={latchedAnomaly ? { id: latchedAnomaly.id, title: latchedAnomaly.title, detail: latchedAnomaly.detail } : null}
            onTakeover={() => setMode('validation')}
            setStatus={(id, s) => setStatuses((p) => ({ ...p, [id]: s }))}
          />
        )}
      </main>
    </div>
  )
}

