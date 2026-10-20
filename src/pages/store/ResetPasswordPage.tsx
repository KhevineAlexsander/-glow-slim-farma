import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ErrorBox, PageLoader } from '../../components/ui/misc'
import { useAuth } from '../../contexts/AuthContext'
import { strongPassword } from '../../lib/password'
import { supabase } from '../../lib/supabase'

/** Destino do link "Esqueci minha senha": o Supabase abre uma sessão temporária de recuperação. */
export default function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <PageLoader />

  if (!session) {
    return (
      <div className="mx-auto max-w-md px-(--margin) py-12 text-center">
        <p className="text-muted">Este link expirou ou já foi usado.</p>
        <Link to="/entrar" className="btn-primary mt-6">Pedir um novo link</Link>
      </div>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!strongPassword(password)) return setError('A senha precisa ter pelo menos 8 caracteres, com letras e números.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError('Não foi possível trocar a senha. Peça um novo link.')
    navigate('/minha-conta', { replace: true })
  }

  return (
    <div className="mx-auto max-w-md px-(--margin) py-12">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink">Criar nova senha</h1>
        </div>
        <div>
          <label className="label" htmlFor="password">Nova senha *</label>
          <input id="password" type="password" className="input" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1 text-xs text-muted">Mínimo de 8 caracteres, com letras e números.</p>
        </div>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
      </form>
    </div>
  )
}
