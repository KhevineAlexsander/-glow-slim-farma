import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  isAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const update = async (s: Session | null) => {
      const admin = s ? await checkAdmin(s.user.id) : false
      if (!active) return
      setSession(s)
      setIsAdmin(admin)
      setLoading(false)
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
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return 'E-mail ou senha inválidos.'
    if (!(await checkAdmin(data.user.id))) {
      await supabase.auth.signOut()
      return 'Este usuário não tem permissão de administrador.'
    }
    return null
  }

  const signOut = async () => {
    adminCheck = null
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, isAdmin, loading, signIn, signOut }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
