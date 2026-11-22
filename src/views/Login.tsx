import type { FormEvent } from 'react'

export function Login({ onLogin }: { onLogin: () => void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onLogin()
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-76px)] w-full max-w-md items-center px-5 pb-16">
      <section className="w-full rounded-2xl border border-line bg-panel p-7 shadow-xl shadow-slate-950/10 sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-ai/12 text-ai">
            <svg viewBox="0 0 32 32" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 19h22M8 15l3-7h10l3 7M10 19v5m12-5v5M7 24h18" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 13h6" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-fg">PyroSage</div>
            <div className="mt-0.5 text-sm text-mute">Supervision prédictive du four</div>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Connexion</h1>
          <p className="mt-2 text-sm leading-6 text-mute">Connectez-vous pour accéder au tableau de supervision.</p>
        </div>

        <form className="space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium text-fg">
            Adresse e-mail
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              placeholder="nom@entreprise.com"
              className="mt-2 block w-full rounded-lg border border-line bg-bg px-3.5 py-3 text-[15px] text-fg outline-none placeholder:text-dim focus:border-ai focus:ring-2 focus:ring-ai/20"
            />
          </label>
          <label className="block text-sm font-medium text-fg">
            Mot de passe
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="Saisissez votre mot de passe"
              className="mt-2 block w-full rounded-lg border border-line bg-bg px-3.5 py-3 text-[15px] text-fg outline-none placeholder:text-dim focus:border-ai focus:ring-2 focus:ring-ai/20"
            />
          </label>
          <button type="submit" className="inline-flex w-full items-center justify-center rounded-lg bg-ai px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai">
            Se connecter
          </button>
        </form>
      </section>
    </main>
  )
}
