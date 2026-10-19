import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { StoreSettings } from '../types'

interface SettingsState {
  settings: StoreSettings | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

const SettingsContext = createContext<SettingsState | null>(null)

function applyTheme(s: StoreSettings) {
  const root = document.documentElement.style
  root.setProperty('--brand', s.primary_color)
  root.setProperty('--brand-dark', s.primary_dark_color)
  root.setProperty('--accent', s.accent_color)
  root.setProperty('--brand-light', s.light_color)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', s.primary_color)
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('store_settings').select('*').eq('id', 1).single()
    if (error) {
      setError('Não foi possível carregar as configurações da loja.')
    } else {
      setSettings(data as StoreSettings)
      applyTheme(data as StoreSettings)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <SettingsContext.Provider value={{ settings, loading, error, reload }}>{children}</SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings fora do SettingsProvider')
  return ctx
}

/** Para componentes que só renderizam depois que as configurações carregaram. */
export function useLoadedSettings(): StoreSettings {
  const { settings } = useSettings()
  if (!settings) throw new Error('Configurações ainda não carregadas')
  return settings
}
