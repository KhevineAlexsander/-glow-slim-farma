import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { onlyDigits } from '../lib/whatsapp'
import type { Profile } from '../types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  isAdmin: boolean
  loading: boolean
  /** Login do painel: recusa (e desloga) quem não é administrador. */
  signIn: (email: string, password: string) => Promise<string | null>
  /** Login de cliente na loja (admin também pode entrar por aqui). */
  signInCustomer: (email: string, password: string) => Promise<string | null>
  /** Cadastro de cliente. Retorna erro, ou needsConfirmation quando o e-mail precisa ser confirmado. */
  signUp: (input: { name: string; phone: string; email: string; password: string }) => Promise<{
    error: string | null
    needsConfirmation: boolean
  }>
  updateProfile: (patch: { full_name: string; phone: string | null }) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// Uma verificação por usuário: o login e o evento SIGNED_IN pedem ao mesmo tempo,
// e repetir a chamada só dobra a chance de pegar uma resposta lenta do servidor.
let adminCheck: { userId: string; result: Promise<boolean> } | null = null

async function checkAdmin(userId: string): Promise<boolean> {
  if (adminCheck?.userId !== userId) {
    // A verificação definitiva é a RLS no banco; isto só controla a interface.
    const result = Promise.resolve(supabase.rpc('is_admin')).then(({ data, error }) => !error && data === true)
    adminCheck = { userId, result }
    // Falha de rede não fica guardada: a próxima tentativa consulta de novo.
    void result.then((ok) => {
      if (!ok && adminCheck?.result === result) adminCheck = null
    })
  }
  return adminCheck.result
}

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role')
    .eq('id', userId)
    .maybeSingle()
  return (data as Profile | null) ?? null
}

/** Mensagens do Supabase Auth em português. */
function authMessage(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha inválidos.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).'
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Este e-mail já tem conta. Entre com sua senha.'
  if (m.includes('signups not allowed')) return 'Cadastro de clientes desativado no momento.'
  if (m.includes('password')) return 'A senha precisa ter pelo menos 8 caracteres, com letras e números.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos.'
  if (m.includes('invalid') && m.includes('email')) return 'E-mail inválido.'
  return 'Não foi possível concluir. Tente novamente.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (s: Session | null) => {
    const [admin, prof] = s ? await Promise.all([checkAdmin(s.user.id), loadProfile(s.user.id)]) : [false, null]
    setSession(s)
    setIsAdmin(admin)
    setProfile(prof)
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    const update = async (s: Session | null) => {
      if (active) await refresh(s)
    }
    void supabase.auth.getSession().then(({ data }) => update(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Evita chamar o Supabase dentro do callback (recomendação da supabase-js).
        setTimeout(() => void update(s), 0)
      } else {
        setSession(s)
      }
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [refresh])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return authMessage(error.message)
    if (!(await checkAdmin(data.user.id))) {
      await supabase.auth.signOut()
      return 'Este usuário não tem permissão de administrador.'
    }
    return null
  }

  const signInCustomer = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? authMessage(error.message) : null
  }

  const signUp: AuthState['signUp'] = async ({ name, phone, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim(), phone: onlyDigits(phone) },
        emailRedirectTo: `${window.location.origin}/minha-conta`,
      },
    })
    if (error) return { error: authMessage(error.message), needsConfirmation: false }
    // Sem identidades = e-mail já cadastrado (o Supabase não revela isso como erro).
    if (data.user && data.user.identities?.length === 0) {
      return { error: 'Este e-mail já tem conta. Entre com sua senha.', needsConfirmation: false }
    }
    // Com confirmação de e-mail ativa o Supabase não devolve sessão.
    return { error: null, needsConfirmation: !data.session }
  }

  const updateProfile: AuthState['updateProfile'] = async (patch) => {
    if (!session) return 'Entre na sua conta primeiro.'
    const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id)
    if (error) return 'Não foi possível salvar seus dados.'
    setProfile(await loadProfile(session.user.id))
    return null
  }

  const signOut = async () => {
    adminCheck = null
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, isAdmin, loading, signIn, signInCustomer, signUp, updateProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
