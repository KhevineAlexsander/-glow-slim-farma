import { Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { ErrorBox, PageLoader } from '../../components/ui/misc'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { strongPassword } from '../../lib/password'
import { onlyDigits } from '../../lib/whatsapp'

type Mode = 'entrar' | 'criar' | 'recuperar'

/** Destino seguro após o login: só caminhos internos da loja. */
function safeReturn(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/minha-conta'
}

export default function SignInPage() {
  const { session, loading, signInCustomer, signUp } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const back = safeReturn(params.get('voltar'))
  const [mode, setMode] = useState<Mode>(params.get('modo') === 'criar' ? 'criar' : 'entrar')
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' })
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <PageLoader />
  if (session && !info) return <Navigate to={back} replace />

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    const email = form.email.trim()

    if (mode === 'recuperar') {
      setBusy(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      })
      setBusy(false)
      // Mesma mensagem com ou sem conta: não revela quais e-mails estão cadastrados.
      if (error && /rate|too many/i.test(error.message)) return setError('Muitas tentativas. Aguarde alguns minutos.')
      return setInfo('Se houver uma conta com este e-mail, você vai receber um link para criar uma nova senha.')
    }

    if (mode === 'criar') {
      if (form.name.trim().length < 2) return setError('Informe seu nome.')
      const phone = onlyDigits(form.phone)
      if (phone.length < 10 || phone.length > 15) return setError('Informe um WhatsApp válido com DDD.')
      if (!strongPassword(form.password)) return setError('A senha precisa ter pelo menos 8 caracteres, com letras e números.')
      if (!consent) return setError('É preciso concordar com o uso dos seus dados para criar a conta.')
      setBusy(true)
      const res = await signUp({ name: form.name, phone, email, password: form.password })
      setBusy(false)
      if (res.error) return setError(res.error)
      if (res.needsConfirmation) {
        return setInfo('Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirme para entrar.')
      }
      return navigate(back, { replace: true })
    }

    setBusy(true)
    const err = await signInCustomer(email, form.password)
    setBusy(false)
    if (err) setError(err)
    else navigate(back, { replace: true })
  }

  const title = { entrar: 'Entrar na sua conta', criar: 'Criar conta', recuperar: 'Recuperar senha' }[mode]

  return (
    <div className="mx-auto max-w-md px-(--gutter) py-12 lg:py-16">
      <div className="card p-6 sm:p-8">
        <h1 className="title-lg mb-6 text-ink">{title}</h1>

        {mode !== 'recuperar' && (
          <div className="mb-5 grid grid-cols-2 rounded-full bg-surface-strong p-1" role="tablist">
            {(['entrar', 'criar'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`min-h-10 rounded-full text-sm font-semibold ${mode === m ? 'bg-white text-ink' : 'text-muted'}`}
              >
                {m === 'entrar' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === 'criar' && (
            <>
              <div>
                <label className="label" htmlFor="name">Nome *</label>
                <input id="name" className="input" required maxLength={120} autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="phone">WhatsApp com DDD *</label>
                <input id="phone" className="input" required inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label className="label" htmlFor="email">E-mail *</label>
            <input id="email" type="email" className="input" required maxLength={120} autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          {mode !== 'recuperar' && (
            <div>
              <label className="label" htmlFor="password">Senha *</label>
              <input
                id="password"
                type="password"
                className="input"
                required
                minLength={mode === 'criar' ? 8 : undefined}
                autoComplete={mode === 'criar' ? 'new-password' : 'current-password'}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
              />
              {mode === 'criar' && <p className="mt-1 text-xs text-muted">Mínimo de 8 caracteres, com letras e números.</p>}
            </div>
          )}
          {mode === 'criar' && (
            <label className="flex min-h-11 items-center gap-3 py-1 text-xs text-muted">
              <input type="checkbox" className="size-5 shrink-0 accent-[var(--ink)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              Concordo que meus dados sejam usados para atendimento e acompanhamento dos meus pedidos.
            </label>
          )}

          {error && <ErrorBox message={error} />}
          {info && <p className="bg-[#dcfae5] p-3 text-sm text-[#04250e]">{info}</p>}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'entrar' ? 'Entrar' : mode === 'criar' ? 'Criar conta' : 'Enviar link'}
          </button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-1 text-sm">
          {mode === 'entrar' && (
            <button type="button" className="min-h-11 font-medium text-ink underline" onClick={() => switchMode('recuperar')}>
              Esqueci minha senha
            </button>
          )}
          {mode === 'recuperar' && (
            <button type="button" className="min-h-11 font-medium text-ink underline" onClick={() => switchMode('entrar')}>
              Voltar para o login
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted">
          Não é obrigatório ter conta para pedir: você também pode enviar seu pedido sem cadastro.
        </p>
      </div>

      <Link
        to="/admin/login"
        className="mt-6 flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-muted hover:text-ink"
      >
        <Lock className="size-4" /> Acesso da equipe (painel administrativo)
      </Link>
    </div>
  )
}
