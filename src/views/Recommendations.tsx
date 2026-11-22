import { useState } from 'react'
import { Badge, Icon, Panel } from '../components/ui'
import { fmt, forecastAt, hhmm, shellTemp, signed, value } from '../lib/sim'
import { AUTH_META, effectiveStatus, MODE_META, RECOS, STATUS_META, type DriveMode, type Reco, type RecoStatus } from '../lib/recos'

export function Recommendations({
  now,
  mode,
  statuses,
  activeAnomaly,
  onTakeover,
  setStatus,
}: {
  now: number
  mode: DriveMode
  statuses: Record<string, RecoStatus>
  activeAnomaly: { id: string; title: string; detail: string } | null
  onTakeover: () => void
  setStatus: (id: string, s: RecoStatus) => void
}) {
  const [selId, setSelId] = useState(RECOS[0].id)
  const liveRecos = RECOS.map((r) => refreshReco(r, now))
  const alertRecoId = activeAnomaly ? recommendationForAnomaly(activeAnomaly) : null
  const r = liveRecos.find((x) => x.id === selId) ?? liveRecos[0]
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 lg:sticky lg:top-32 lg:col-span-4 lg:max-h-[calc(100vh-9rem)] lg:self-start lg:overflow-y-auto">
        <div className="mb-3 grid gap-3 rounded-md border border-line bg-panel px-4 py-3 text-[12px] sm:grid-cols-2">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 font-semibold text-fg"><span className="relative inline-flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-ok/60" /><span className="relative size-2 rounded-full bg-ok" /></span>Suivi du procédé</span>
              <span className="font-mono text-[11px] text-dim">En direct · {hhmm(now)}</span>
            </div>
            <p className="mt-1 text-[11.5px] text-mute">Les valeurs et recommandations suivent les mesures du four.</p>
          </div>
          <div className="min-w-0 sm:border-l sm:border-line sm:pl-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-dim">Mode de conduite</div>
            <div className="mt-0.5 font-semibold text-ai">{MODE_META[mode].label}</div>
            <p className="mt-0.5 text-[11.5px] text-mute">{MODE_META[mode].desc}</p>
          </div>
        </div>
        {activeAnomaly && (
          <button type="button" onClick={() => alertRecoId && setSelId(alertRecoId)} className="mb-3 w-full rounded-md border border-crit/35 bg-crit/8 px-3 py-2.5 text-left transition-colors hover:bg-crit/12" aria-label={`Ouvrir la recommandation liée à l’anomalie : ${activeAnomaly.title}`}>
            <div className="text-[11px] font-semibold text-crit">Anomalie de procédé · à examiner</div>
            <div className="mt-0.5 text-[12px] font-medium text-fg">{activeAnomaly.title}</div>
            <p className="mt-0.5 text-[11px] text-mute">{activeAnomaly.detail}</p>
            <p className="mt-1 text-[11px] font-medium text-crit">{mode === 'validation' ? 'Le contrôle est en Copilote : examinez la situation avant toute validation.' : mode === 'conseil' ? 'Le mode Conseiller n’envoie aucune consigne au DCS.' : 'Une alerte entraîne le retour en Copilote.'}</p>
            <span className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-crit">Ouvrir la recommandation liée <span aria-hidden="true" className="inline-flex size-3.5">{Icon.arrow}</span></span>
          </button>
        )}
        <div className="mt-3 flex flex-col gap-3">
        {liveRecos.map((x) => {
          const eff = effectiveStatus(x, statuses[x.id], mode)
          const st = liveStatus(eff, mode, x.auth, alertRecoId === x.id)
          return (
            <button
              key={x.id}
              onClick={() => setSelId(x.id)}
              aria-pressed={x.id === selId}
              className={`rounded-md border p-4 text-left transition-colors ${x.id === selId ? 'border-2 border-ai bg-panel' : 'border-line bg-panel hover:bg-panel-2/60'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-dim">
                  {x.id} · recalculée {hhmm(now)}
                </span>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <div className="mt-1.5 text-[14px] font-medium text-fg">{x.title}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]">
                <Badge tone={x.priority === 'haute' ? 'warn' : 'neutral'}>Priorité {x.priority}</Badge>
                <span className="text-mute">{x.objective}</span>
                <span className="ml-auto font-mono text-mute">{Math.round(x.confidence * 100)} %</span>
              </div>
            </button>
          )
        })}
        </div>
      </div>
      <RecoDetail r={r} now={now} mode={mode} status={statuses[r.id]} anomaly={alertRecoId === r.id} onTakeover={onTakeover} setStatus={(s) => setStatus(r.id, s)} />
    </div>
  )
}

function liveStatus(status: RecoStatus | 'auto', mode: DriveMode, auth: Reco['auth'], anomaly: boolean) {
  if (status !== 'en_attente') return STATUS_META[status]
  if (anomaly) return { label: 'Revue opérateur', tone: 'crit' as const }
  if (mode === 'auto' && auth === 'auto') return { label: 'Ajustement auto en cours', tone: 'ai' as const }
  if (mode === 'conseil') return { label: 'Surveillance active', tone: 'neutral' as const }
  if (mode === 'auto' && auth !== 'auto') return { label: 'Validation humaine requise', tone: 'warn' as const }
  return { label: 'À valider', tone: 'warn' as const }
}

function recommendationForAnomaly(anomaly: { id: string; title: string }) {
  if (anomaly.id === 'shell') return 'R-2419'
  if (anomaly.id === 'fcao' || /farine|refroidissement|cuisson/i.test(anomaly.title)) return 'R-2418'
  return 'R-2417'
}

function refreshReco(r: Reco, now: number): Reco {
  const changes = r.changes.map((change) => {
    let current = change.current
    switch (change.tag) {
      case 'K2-FIC-230': current += (value('o2', now) - 2.4) * 0.35; break
      case 'K2-SIC-501': current += (value('draft', now) + 58) * 1.4; break
      case 'K2-FIC-310': current += (value('tSec', now) - 1040) * 0.007; break
      case 'K2-FIC-020': current = value('feed', now); break
      case 'K2-ZIC-240': current = (value('tBurn', now) - 1452) * 1.5; break
      case 'K2-FIC-241': current += (value('o2', now) - 2.4) * 0.4; break
    }
    current = Math.min(change.max, Math.max(change.min, current))
    const adjustment = change.proposed - change.current
    const proposed = Math.min(change.max, Math.max(change.min, current + adjustment))
    return { ...change, current, proposed }
  })

  const consequences = r.consequences.map((consequence) => {
    const key = consequence.label.includes('thermique') ? 'thermal'
      : consequence.label.includes('O₂') ? 'o2'
      : consequence.label.includes('CO') ? 'co'
      : consequence.label.includes('Chaux libre') ? 'fcao'
      : consequence.label.includes('Production') ? 'prod'
      : consequence.label.includes('stabilité') ? 'stab'
      : null
    if (!key) return consequence
    const horizon = Number(consequence.horizon.match(/\d+/)?.[0] ?? 10)
    const drift = (forecastAt(key, now + horizon, now).mid ?? value(key, now)) - value(key, now)
    const adjustment = drift * 0.25
    return { ...consequence, delta: consequence.delta + adjustment, lo: consequence.lo + adjustment, hi: consequence.hi + adjustment }
  })
  const evidence = r.id === 'R-2417'
    ? [`O₂ actuel : ${fmt(value('o2', now), 2)} %`, `CO actuel : ${fmt(value('co', now))} ppm`, `Consommation thermique : ${fmt(value('thermal', now))} kcal/kg`]
    : r.id === 'R-2418'
      ? [`Chaux libre prévue à +40 min : ${fmt(forecastAt('fcao', now + 40, now).mid, 2)} %`, `Air secondaire actuel : ${fmt(value('tSec', now))} °C`, `Débit farine actuel : ${fmt(value('feed', now))} t/h`]
      : [`Température virole à 26 m : ${fmt(shellTemp(26, now))} °C`, `Température cuisson : ${fmt(value('tBurn', now))} °C`, `Couple four : ${fmt(value('torque', now))} kN·m`]
  return { ...r, changes, consequences, evidence }
}

function Section({ code: _code, title, children }: { code: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-4">
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-mute">
        {title}
      </h3>
      {children}
    </section>
  )
}

function RecoDetail({ r, now, mode, status, anomaly, onTakeover, setStatus }: { r: Reco; now: number; mode: DriveMode; status: RecoStatus; anomaly: boolean; onTakeover: () => void; setStatus: (s: RecoStatus) => void }) {
  const eff = effectiveStatus(r, status, mode)
  const conf = Math.round(r.confidence * 100)
  const constraintsOk = r.constraints.every((c) => c.ok)

  return (
    <Panel
      className="col-span-12 lg:col-span-8"
      bodyClass="p-0"
      title={
        <span className="text-[15px]">
          {r.title}
        </span>
      }
      subtitle={`${r.id} · objectif ${r.objective.toLowerCase()} · mise à jour procédé ${hhmm(now)}`}
      right={<Badge tone={STATUS_META[eff].tone}>{STATUS_META[eff].label}</Badge>}
    >
      <Section code="G.1" title="Variables concernées — valeurs actuelles et proposées">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-dim">
                <th className="pb-2 font-medium">Variable</th>
                <th className="pb-2 text-right font-medium">Actuelle</th>
                <th className="pb-2" />
                <th className="pb-2 text-right font-medium">Proposée</th>
                <th className="pb-2 text-right font-medium">Écart</th>
                <th className="pb-2 pl-6 font-medium">
                  <div>Plage autorisée</div>
                  <div className="mt-1 flex items-center justify-end gap-2 normal-case tracking-normal text-[9px] font-normal text-dim">
                    <span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-mute" />Actuelle</span>
                    <span className="inline-flex items-center gap-1"><i className="size-2 rotate-45 bg-ai" />Proposée</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.changes.map((c) => {
                const rangePosition = (v: number) => 6 + Math.max(0, Math.min(1, (v - c.min) / (c.max - c.min))) * 88
                return (
                  <tr key={c.tag}>
                    <td className="py-2.5">
                      <div className="text-fg">{c.variable}</div>
                      <div className="font-mono text-[10.5px] text-dim">
                        {c.tag} · rampe {c.ramp}
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono text-mute">{fmt(c.current, c.dec)}</td>
                    <td className="px-2 text-center text-dim">{Icon.arrow}</td>
                    <td className="py-2.5 text-right font-mono text-ai">
                      {fmt(c.proposed, c.dec)} <span className="font-sans text-[11px] text-dim">{c.unit}</span>
                    </td>
                    <td className="py-2.5 text-right font-mono text-fg">{signed(c.proposed - c.current, c.dec)}</td>
                    <td className="py-2.5 pl-6">
                      <div className="relative mx-1 h-8 min-w-[148px]" role="img" aria-label={`Plage autorisée de ${fmt(c.min, c.dec)} à ${fmt(c.max, c.dec)} ${c.unit}. Valeur actuelle ${fmt(c.current, c.dec)}, valeur proposée ${fmt(c.proposed, c.dec)}.`}>
                        <div className="absolute inset-x-1 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ai/20" />
                        <span className="absolute top-[3px] size-2.5 -translate-x-1/2 rounded-full border border-panel bg-mute shadow-sm" style={{ left: `${rangePosition(c.current)}%` }} title={`Actuelle : ${fmt(c.current, c.dec)} ${c.unit}`} />
                        <span className="absolute bottom-[3px] size-2.5 -translate-x-1/2 rotate-45 border border-panel bg-ai shadow-sm" style={{ left: `${rangePosition(c.proposed)}%` }} title={`Proposée : ${fmt(c.proposed, c.dec)} ${c.unit}`} />
                      </div>
                      <div className="flex justify-between font-mono text-[10px] text-dim">
                        <span>Min {fmt(c.min, c.dec > 1 ? 1 : c.dec)}</span>
                        <span>Max {fmt(c.max, c.dec > 1 ? 1 : c.dec)} {c.unit}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section code="G.2" title="Raison de la recommandation">
        <p className="max-w-3xl text-[13px] leading-relaxed text-fg/90">{r.reason}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {r.evidence.map((e) => (
            <li key={e} className="rounded border border-line bg-bg px-2.5 py-1 font-mono text-[11px] text-mute">
              {e}
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid lg:grid-cols-2">
        <Section code="G.3" title="Conséquences prédites">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-mute" aria-label="Légende du graphique d’intervalle">
              <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-ai ring-2 ring-bg" />Estimation centrale</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 rounded bg-ai/60" />Intervalle prévu</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-3 w-px bg-mute" />0 = stable</span>
            </div>
            {r.consequences.map((c) => {
              const extent = Math.max(Math.abs(c.lo), Math.abs(c.hi), Math.abs(c.delta), 0.01) * 1.12
              const position = (v: number) => 50 + (v / extent) * 44
              const left = position(Math.min(c.lo, c.hi))
              const right = position(Math.max(c.lo, c.hi))
              const tone = c.good ? 'var(--color-ok)' : 'var(--color-warn)'
              return (
                <div key={c.label} className="rounded-md border border-line bg-bg px-3 py-2.5" role="group" aria-label={`${c.label} : estimation centrale ${signed(c.delta, c.dec)} ${c.unit}, intervalle estimé de ${signed(c.lo, c.dec)} à ${signed(c.hi, c.dec)} ${c.unit}, horizon ${c.horizon}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-[12px] font-medium text-fg">{c.label}</span>
                    <span className={`shrink-0 text-right font-mono text-[12px] font-semibold ${c.good ? 'text-ok' : 'text-warn'}`}>{signed(c.delta, c.dec)} <span className="font-sans text-[10px] font-normal text-dim">{c.unit}</span></span>
                  </div>
                  <div className="relative mx-1 mt-2 h-6" aria-hidden="true">
                    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
                    <div className="absolute top-0 h-full w-px bg-mute/80" style={{ left: '50%' }} />
                    <div className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full" style={{ left: `${left}%`, width: `${right - left}%`, backgroundColor: tone, opacity: 0.65 }} />
                    <span className="absolute top-1/2 h-3.5 w-px -translate-y-1/2" style={{ left: `${left}%`, backgroundColor: tone }} />
                    <span className="absolute top-1/2 h-3.5 w-px -translate-y-1/2" style={{ left: `${right}%`, backgroundColor: tone }} />
                    <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg shadow-sm" style={{ left: `${position(c.delta)}%`, backgroundColor: tone }} />
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 font-mono text-[10px] leading-tight">
                    <span className="text-left text-mute">{signed(c.lo, c.dec)} {c.unit}</span>
                    <span className="text-center text-dim">+{c.horizon}</span>
                    <span className="text-right text-mute">{signed(c.hi, c.dec)} {c.unit}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        <Section code="G.4" title="Contraintes vérifiées">
          <ul className="space-y-2">
            {r.constraints.map((c) => (
              <li key={c.label} className="flex gap-2.5 text-[12px]">
                <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm ${c.ok ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn'}`}>
                  {c.ok ? Icon.check : '!'}
                </span>
                <div>
                  <div className="text-fg">{c.label}</div>
                  <div className="text-[11px] text-mute">{c.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="grid lg:grid-cols-2">
        <Section code="G.5" title="Incertitude associée">
          <div className="flex items-center gap-4">
            <div className="relative size-16 shrink-0">
              <svg viewBox="0 0 36 36" className="size-16 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-line" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke={conf >= 80 ? 'var(--color-ok)' : conf >= 70 ? 'var(--color-ai)' : 'var(--color-warn)'}
                  strokeWidth="3"
                  strokeDasharray={`${(conf / 100) * 97.4} 97.4`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-mono text-[14px] text-fg">{conf}%</span>
            </div>
            <div className="text-[12px]">
              <div className="font-medium text-fg">Confiance du modèle</div>
              <p className="mt-0.5 text-mute">{r.uncertainty}</p>
            </div>
          </div>
        </Section>

        <Section code="G.6" title="Niveau d’autorisation nécessaire">
          <div className="grid grid-cols-3 gap-2">
            {(['auto', 'operateur', 'ingenieur'] as const).map((a) => (
              <div
                key={a}
                className={`flex min-h-[58px] items-center justify-center rounded border px-2 py-2 text-center text-[11px] leading-tight ${a === r.auth ? 'border-ai/60 bg-ai/10 text-ai' : 'border-line text-dim'}`}
              >
                {AUTH_META[a].label}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-mute">{AUTH_META[r.auth].desc}</p>
        </Section>
      </div>

      <ActionBar r={r} now={now} mode={mode} eff={eff} constraintsOk={constraintsOk} anomaly={anomaly} onTakeover={onTakeover} setStatus={setStatus} />
    </Panel>
  )
}

function ActionBar({
  r,
  now,
  mode,
  eff,
  constraintsOk,
  anomaly,
  onTakeover,
  setStatus,
}: {
  r: Reco
  now: number
  mode: DriveMode
  eff: RecoStatus | 'auto'
  constraintsOk: boolean
  anomaly: boolean
  onTakeover: () => void
  setStatus: (s: RecoStatus) => void
}) {
  const primary = 'flex items-center gap-1.5 rounded bg-ai px-3.5 py-2 text-[12.5px] font-semibold text-bg hover:bg-ai/90 disabled:cursor-not-allowed disabled:opacity-40'
  const secondary = 'flex items-center gap-1.5 rounded border border-line px-3.5 py-2 text-[12.5px] text-mute hover:text-fg'

  let note: string
  let actions: React.ReactNode

  if (anomaly && eff === 'en_attente') {
    note = 'Cette recommandation est liée à l’anomalie active. Transmettez-la à l’ingénieur procédé pour analyse; la validation opérationnelle reste de son ressort.'
    actions = <button className={primary} onClick={() => setStatus('escaladee')}>Soumettre à l’ingénieur procédé</button>
  } else if (eff === 'auto') {
    note = `Ajustement mineur appliqué puis maintenu automatiquement dans l’enveloppe autorisée. Suivi et recalcul continus · ${hhmm(now)}.`
    actions = <button className={secondary} onClick={onTakeover}>Reprendre la main</button>
  } else if (eff !== 'en_attente') {
    note =
      `Statut : ${STATUS_META[eff].label.toLowerCase()}.`
    actions = (
      <button className={secondary} onClick={() => setStatus('en_attente')}>
        Rétablir en attente
      </button>
    )
  } else if (mode === 'conseil') {
    note = 'Mode conseiller : la recommandation est informative, aucune consigne ne sera écrite dans le DCS.'
    actions = (
      <>
        <button className={secondary} onClick={() => setStatus('rejetee')}>
          {Icon.cross} Rejeter
        </button>
        <button className={primary} onClick={() => setStatus('prise_en_compte')}>
          {Icon.check} Prendre en compte
        </button>
      </>
    )
  } else if (r.auth === 'ingenieur') {
    note = 'Cette action dépasse l’enveloppe opérateur : elle doit être signée par un ingénieur procédé.'
    actions = (
      <>
        <button className={secondary} onClick={() => setStatus('rejetee')}>
          {Icon.cross} Rejeter
        </button>
        <button className={secondary} onClick={() => setStatus('differee')}>
          Différer
        </button>
        <button className={primary} onClick={() => setStatus('escaladee')}>
          Soumettre à l’ingénieur
        </button>
      </>
    )
  } else {
    note = constraintsOk
      ? 'Toutes les contraintes sont vérifiées. La consigne sera écrite dans le DCS en respectant les rampes.'
      : 'Une contrainte n’est pas satisfaite : transmission bloquée.'
    actions = (
      <>
        <button className={secondary} onClick={() => setStatus('rejetee')}>
          {Icon.cross} Rejeter
        </button>
        <button className={secondary} onClick={() => setStatus('differee')}>
          Différer
        </button>
        <button className={primary} disabled={!constraintsOk} onClick={() => setStatus('appliquee')}>
          {Icon.check} Valider et transmettre au DCS
        </button>
      </>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg/50 px-5 py-4">
      <p className="max-w-md text-[11.5px] text-mute">{note}</p>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}
