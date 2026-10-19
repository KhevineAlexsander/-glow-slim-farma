import { Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { ErrorBox, PageLoader } from '../../components/ui/misc'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginPage() {
  const { session, isAdmin, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const from = (location.state as { from?: string } | null)?.from ?? '/admin'

  if (loading) return <PageLoader />
  if (session && isAdmin) return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await signIn(email.trim(), password)
    setBusy(false)
    if (err) setError(err)
    else navigate(from, { replace: true })
  }

  return (
    <div className="bg-soft-gradient flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <img src="/logo.svg" alt="Glow Slim Farma" className="mx-auto h-14 w-auto" />
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
          <Lock className="size-4" /> Acesso administrativo
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" type="email" className="input" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Senha</label>
          <input id="password" type="password" className="input" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
