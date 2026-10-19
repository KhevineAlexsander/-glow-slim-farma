import {
  ExternalLink,
  FileUp,
  Image,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  Tags,
  X,
} from 'lucide-react'
import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings } from '../../contexts/SettingsContext'
import { PageLoader } from '../ui/misc'

const NAV = [
  { to: '/admin', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/admin/produtos', label: 'Produtos', icon: Package },
  { to: '/admin/categorias', label: 'Categorias', icon: Tags },
  { to: '/admin/banners', label: 'Banners', icon: Image },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { to: '/admin/importar', label: 'Importar', icon: FileUp },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
]

/** Protege as rotas do painel. A proteção real dos dados é a RLS no banco. */
export function RequireAdmin() {
  const { session, isAdmin, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!session || !isAdmin) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  return <AdminLayout />
}

function AdminLayout() {
  const { signOut, session } = useAuth()
  const { settings } = useSettings()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])
  useEffect(() => {
    document.title = `Painel | ${settings?.store_name ?? 'Loja'}`
  }, [settings?.store_name, location.pathname])

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${
              isActive ? 'bg-brand text-white' : 'text-slate-600 hover:bg-brand-light'
            }`
          }
        >
          <Icon className="size-5" /> {label}
        </NavLink>
      ))}
    </nav>
  )

  const footer = (
    <div className="mt-auto space-y-1 border-t border-slate-100 pt-4">
      <p className="truncate px-3 text-xs text-slate-400">{session?.user.email}</p>
      <Link to="/" target="_blank" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
        <ExternalLink className="size-5" /> Ver loja
      </Link>
      <button onClick={() => void signOut()} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600">
        <LogOut className="size-5" /> Sair
      </button>
    </div>
  )

  return (
    <div className="min-h-dvh bg-slate-50 lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-100 bg-white p-4 lg:flex">
        <img src={settings?.logo_url || '/logo.svg'} alt="" className="mb-6 h-12 w-auto self-start" />
        {nav}
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-2 lg:hidden">
        <button className="btn-ghost size-11 px-0" onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu className="size-6" />
        </button>
        <span className="font-bold text-brand-dark">Painel</span>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col overflow-y-auto overscroll-contain bg-white p-4 shadow-xl"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a')) setOpen(false)
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <img src={settings?.logo_url || '/logo.svg'} alt="" className="h-10 w-auto" />
              <button className="btn-ghost size-11 px-0" onClick={() => setOpen(false)} aria-label="Fechar menu">
                <X className="size-6" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

export function AdminPageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}
