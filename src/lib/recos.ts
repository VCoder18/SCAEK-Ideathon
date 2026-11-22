export type DriveMode = 'conseil' | 'validation' | 'auto'

export const MODE_META: Record<DriveMode, { label: string; short: string; desc: string }> = {
  conseil: {
    label: 'Conseiller',
    short: 'Conseiller',
    desc: 'Vous voyez les pistes proposées. Aucune consigne n’est envoyée au DCS.',
  },
  validation: {
    label: 'Copilote',
    short: 'Copilote',
    desc: 'Les consignes attendent votre validation avant leur envoi au DCS.',
  },
  auto: {
    label: 'Automatique',
    short: 'Automatique',
    desc: 'Les petits réglages autorisés sont appliqués et maintenus. Une anomalie rend la main au Copilote.',
  },
}

export type AuthLevel = 'auto' | 'operateur' | 'ingenieur'
export const AUTH_META: Record<AuthLevel, { label: string; desc: string }> = {
  auto: { label: 'Auto autorisé', desc: 'Dans l’enveloppe d’automatisation approuvée par l’exploitant.' },
  operateur: { label: 'Validation opérateur', desc: 'Validation requise par l’opérateur ou le chef de quart.' },
  ingenieur: { label: 'Validation ingénieur procédé', desc: 'Hors enveloppe automatique : signature ingénieur requise.' },
}

export type RecoStatus = 'en_attente' | 'appliquee' | 'rejetee' | 'differee' | 'escaladee' | 'prise_en_compte'

export const STATUS_META: Record<RecoStatus | 'auto', { label: string; tone: 'ok' | 'warn' | 'crit' | 'ai' | 'neutral' }> = {
  en_attente: { label: 'En attente', tone: 'warn' },
  appliquee: { label: 'Transmise au DCS', tone: 'ok' },
  auto: { label: 'Appliquée auto', tone: 'ai' },
  rejetee: { label: 'Rejetée', tone: 'neutral' },
  differee: { label: 'Différée', tone: 'neutral' },
  escaladee: { label: 'Soumise ingénieur', tone: 'ai' },
  prise_en_compte: { label: 'Prise en compte', tone: 'neutral' },
}

export interface Reco {
  id: string
  title: string
  objective: string
  priority: 'haute' | 'moyenne' | 'basse'
  ageMin: number
  changes: { variable: string; tag: string; unit: string; current: number; proposed: number; min: number; max: number; dec: number; ramp: string }[]
  reason: string
  evidence: string[]
  consequences: { label: string; unit: string; delta: number; lo: number; hi: number; dec: number; good: boolean; horizon: string }[]
  constraints: { label: string; detail: string; ok: boolean }[]
  confidence: number
  uncertainty: string
  auth: AuthLevel
}

export const RECOS: Reco[] = [
  {
    id: 'R-2417',
    title: 'Réduire l’excès d’air de combustion',
    objective: 'Énergie',
    priority: 'moyenne',
    ageMin: 4,
    changes: [
      { variable: 'Combustible tuyère principale', tag: 'K2-FIC-230', unit: 't/h', current: 9.8, proposed: 9.62, min: 8.5, max: 11, dec: 2, ramp: '0,05 t/h / 5 min' },
      { variable: 'Vitesse ventilateur ID', tag: 'K2-SIC-501', unit: '%', current: 82.0, proposed: 81.2, min: 70, max: 92, dec: 1, ramp: '0,4 % / 5 min' },
    ],
    reason:
      'L’O₂ en sortie de four se maintient au-dessus de la cible depuis 40 minutes alors que le CO reste bas : l’excès d’air entraîne des pertes thermiques par les fumées. Le modèle dynamique prévoit que la réduction coordonnée du combustible et du tirage ramène l’O₂ vers 2,2 % sans dégrader la cuisson.',
    evidence: [
      'O₂ moyen 40 min : 2,71 % (cible 2,2 %)',
      'CO moyen 40 min : 128 ppm (limite 500 ppm)',
      'Consommation thermique : +1,1 % au-dessus de l’objectif',
    ],
    consequences: [
      { label: 'Consommation thermique', unit: 'kcal/kg', delta: -9, lo: -14, hi: -4, dec: 0, good: true, horizon: '45 min' },
      { label: 'O₂ sortie four', unit: '%', delta: -0.45, lo: -0.6, hi: -0.3, dec: 2, good: true, horizon: '20 min' },
      { label: 'CO sortie four', unit: 'ppm', delta: 22, lo: 8, hi: 45, dec: 0, good: false, horizon: '20 min' },
      { label: 'Chaux libre', unit: '%', delta: 0.04, lo: -0.02, hi: 0.1, dec: 2, good: false, horizon: '60 min' },
    ],
    constraints: [
      { label: 'CO prédit < 300 ppm', detail: 'Maximum prédit : 196 ppm (P95)', ok: true },
      { label: 'T° zone de cuisson > 1 420 °C', detail: 'Minimum prédit : 1 437 °C', ok: true },
      { label: 'Chaux libre prédite dans la tolérance', detail: '1,29 % ± 0,12 (tolérance 0,8–1,6 %)', ok: true },
      { label: 'Rampes de variation respectées', detail: 'Écriture fractionnée en 4 pas de 5 min', ok: true },
      { label: 'Aucun verrouillage DCS / sécurité actif', detail: 'Interlocks et SIS non sollicités', ok: true },
    ],
    confidence: 0.86,
    uncertainty: 'Intervalle de prédiction à 90 %. Modèle validé sur 312 situations comparables (même mix de combustibles).',
    auth: 'auto',
  },
  {
    id: 'R-2418',
    title: 'Anticiper la dérive de la chaux libre',
    objective: 'Qualité',
    priority: 'haute',
    ageMin: 9,
    changes: [
      { variable: 'Combustible précalcinateur', tag: 'K2-FIC-310', unit: 't/h', current: 6.2, proposed: 6.45, min: 5, max: 7.5, dec: 2, ramp: '0,05 t/h / 5 min' },
      { variable: 'Débit farine', tag: 'K2-FIC-020', unit: 't/h', current: 322, proposed: 316, min: 290, max: 340, dec: 0, ramp: '2 t/h / 5 min' },
    ],
    reason:
      'Le capteur logiciel prévoit une hausse de la chaux libre vers 1,52 % d’ici 40 minutes, en lien avec une baisse progressive de la température de l’air secondaire. Augmenter le taux de précalcination et réduire légèrement l’alimentation stabilise la cuisson avant le prochain prélèvement laboratoire.',
    evidence: [
      'Chaux libre prédite à +40 min : 1,52 % (cible 1,2 %)',
      'T° air secondaire : −18 °C sur 60 min',
      'Dernière analyse labo : 1,34 % (écart modèle +0,05)',
    ],
    consequences: [
      { label: 'Chaux libre', unit: '%', delta: -0.28, lo: -0.4, hi: -0.15, dec: 2, good: true, horizon: '60 min' },
      { label: 'Production clinker', unit: 't/j', delta: -95, lo: -110, hi: -80, dec: 0, good: false, horizon: 'immédiat' },
      { label: 'Consommation thermique', unit: 'kcal/kg', delta: 6, lo: 2, hi: 10, dec: 0, good: false, horizon: '45 min' },
      { label: 'Indice de stabilité', unit: 'pts', delta: 4, lo: 1, hi: 7, dec: 0, good: true, horizon: '60 min' },
    ],
    constraints: [
      { label: 'T° précalcinateur < 900 °C', detail: 'Maximum prédit : 889 °C', ok: true },
      { label: 'ΔP cyclone C4 < 16 mbar', detail: 'Maximum prédit : 13,1 mbar', ok: true },
      { label: 'Production > 4 600 t/j', detail: 'Prédit : 4 685 t/j', ok: true },
      { label: 'Rampes de variation respectées', detail: 'Écriture fractionnée en 3 pas', ok: true },
      { label: 'Aucun verrouillage DCS / sécurité actif', detail: 'Interlocks et SIS non sollicités', ok: true },
    ],
    confidence: 0.74,
    uncertainty: 'Incertitude accrue : 48 min depuis la dernière analyse laboratoire. Bande d’estimation ±0,19 %.',
    auth: 'operateur',
  },
  {
    id: 'R-2419',
    title: 'Limiter le point chaud de virole à 26 m',
    objective: 'Équipement',
    priority: 'haute',
    ageMin: 17,
    changes: [
      { variable: 'Position axiale brûleur', tag: 'K2-ZIC-240', unit: 'mm', current: 0, proposed: -60, min: -200, max: 200, dec: 0, ramp: 'manuel, 20 mm / pas' },
      { variable: 'Débit air primaire', tag: 'K2-FIC-241', unit: '%', current: 11.5, proposed: 10.8, min: 8, max: 14, dec: 1, ramp: '0,2 % / 5 min' },
    ],
    reason:
      'Le scanner de virole met en évidence un échauffement localisé à 26 m, récurrent depuis 6 heures, typique d’une perte de croûtage. Raccourcir la flamme et la reculer légèrement devrait favoriser la reconstitution du croûtage en déplaçant le maximum de flux thermique.',
    evidence: [
      'Maximum virole 26 m : 352 °C (seuil alerte 330 °C)',
      'Durée cumulée au-dessus du seuil : 2 h 40 sur 6 h',
      'Couple four : −4 % (croûtage plus fin)',
    ],
    consequences: [
      { label: 'T° max virole à 26 m', unit: '°C', delta: -28, lo: -45, hi: -10, dec: 0, good: true, horizon: '2–4 h' },
      { label: 'T° zone de cuisson', unit: '°C', delta: -6, lo: -12, hi: 0, dec: 0, good: false, horizon: '30 min' },
      { label: 'NOx', unit: 'mg/Nm³', delta: -35, lo: -60, hi: -10, dec: 0, good: true, horizon: '30 min' },
    ],
    constraints: [
      { label: 'T° zone de cuisson > 1 420 °C', detail: 'Minimum prédit : 1 431 °C', ok: true },
      { label: 'Plage de position brûleur', detail: 'Dans la plage mécanique ±200 mm', ok: true },
      { label: 'Enveloppe automatique', detail: 'Le brûleur est exclu de l’automatisation par l’exploitant', ok: false },
      { label: 'Aucun verrouillage DCS / sécurité actif', detail: 'Interlocks et SIS non sollicités', ok: true },
    ],
    confidence: 0.61,
    uncertainty: 'Peu de situations comparables (27). L’effet sur le croûtage est lent et dépend de la chimie de la farine.',
    auth: 'ingenieur',
  },
]

export function effectiveStatus(r: Reco, s: RecoStatus, mode: DriveMode): RecoStatus | 'auto' {
  if (mode === 'auto' && r.auth === 'auto' && s === 'en_attente') return 'auto'
  return s
}
