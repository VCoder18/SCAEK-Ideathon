import type { ReactNode } from 'react'

export function Panel({
  title,
  code,
  subtitle,
  right,
  children,
  className = '',
  bodyClass = 'p-4',
}: {
  title: ReactNode
  code?: string
  subtitle?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
  bodyClass?: string
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-md border border-line bg-panel ${className}`}>
      <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-wide text-fg">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-mute">{subtitle}</p>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClass}`}>{children}</div>
    </section>
  )
}

export type Tone = 'ok' | 'warn' | 'crit' | 'ai' | 'neutral'

const toneText: Record<Tone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  crit: 'text-crit',
  ai: 'text-ai',
  neutral: 'text-mute',
}
const toneBg: Record<Tone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  crit: 'bg-crit',
  ai: 'bg-ai',
  neutral: 'bg-mute',
}
const toneBorder: Record<Tone, string> = {
  ok: 'border-ok/35 bg-ok/8',
  warn: 'border-warn/40 bg-warn/8',
  crit: 'border-crit/45 bg-crit/10',
  ai: 'border-ai/40 bg-ai/8',
  neutral: 'border-line bg-panel-2',
}

export function Dot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex size-2 shrink-0">
      {pulse && <span className={`absolute inset-0 animate-ping rounded-full opacity-60 ${toneBg[tone]}`} />}
      <span className={`relative size-2 rounded-full ${toneBg[tone]}`} />
    </span>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wider ${toneBorder[tone]} ${toneText[tone]}`}
    >
      {children}
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'sm',
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  size?: 'sm' | 'xs'
}) {
  return (
    <div className="inline-flex rounded border border-line bg-bg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-sm font-medium transition-colors ${size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-[12px]'} ${
            value === o.value ? 'bg-panel-2 text-fg shadow-sm ring-1 ring-line' : 'text-mute hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ThemeToggle({ theme, onToggle }: { theme: 'dark' | 'light'; onToggle: () => void }) {
  const label = theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel text-fg transition-colors hover:border-ai hover:text-ai focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai"
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="10" cy="10" r="3.5" />
          <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4m9.2 9.2L16 16m0-12-1.4 1.4m-9.2 9.2L4 16" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7.5 7.5 0 1 0 9 9Z" />
        </svg>
      )}
    </button>
  )
}

export function Stat({ label, value, unit, tone }: { label: string; value: ReactNode; unit?: string; tone?: Tone }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-wider text-dim">{label}</div>
      <div className={`mt-0.5 font-data text-[15px] tabular-nums ${tone ? toneText[tone] : 'text-fg'}`}>
        {value}
        {unit && <span className="ml-1 font-sans text-[11px] text-dim">{unit}</span>}
      </div>
    </div>
  )
}

export const Icon = {
  play: (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
      <path d="M4 2.5v11l9-5.5z" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
      <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" />
    </svg>
  ),
  live: (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
      <path d="M2 2.5h2v11H2zM5 2.5v11l9-5.5z" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  ),
  cross: (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  ),
}
