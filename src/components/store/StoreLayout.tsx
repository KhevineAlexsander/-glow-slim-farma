import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useSettings } from '../../contexts/SettingsContext'
import { isSupabaseConfigured } from '../../lib/supabase'
import { fetchCategories } from '../../services/catalog'
import type { Category } from '../../types'
import { ErrorBox, PageLoader } from '../ui/misc'
import { BottomNav } from './BottomNav'
import { Footer } from './Footer'
import { Header } from './Header'

export interface StoreOutletContext {
  categories: Category[]
}

export function StoreLayout() {
  const { settings, loading, error } = useSettings()
  const [categories, setCategories] = useState<Category[]>([])
  const { pathname } = useLocation()

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    if (settings) document.title = settings.store_name
  }, [settings])

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorBox message="Supabase não configurado. Crie o arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README)." />
      </div>
    )
  }
  if (loading) return <PageLoader />
  if (error || !settings) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorBox message={error ?? 'Loja indisponível no momento.'} />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header categories={categories} />
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Outlet context={{ categories } satisfies StoreOutletContext} />
        </Suspense>
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}
