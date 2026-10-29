import {
  Bell,
  BellRing,
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
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react'
import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import { useSettings } from '../../contexts/SettingsContext'
import { orderAlertText, useOrderAlerts } from '../../lib/orderAlerts'
import { BrandLogo } from '../store/Logo'
import { PageLoader } from '../ui/misc'

const NAV = [
  { to: '/admin', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/admin/produtos', label: 'Produtos', icon: Package },
  { to: '/admin/categorias', label: 'Categorias', icon: Tags },
  { to: '/admin/banners', label: 'Banners', icon: Image },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { to: '/admin/pedido-minimo', label: 'Pedido mínimo', icon: Wallet },
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
  const alerts = useOrderAlerts(true)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])
  // A aba do navegador mostra quantos pedidos esperam resposta
  useEffect(() => {
    const n = alerts.newCount
    document.title = `${n > 0 ? `(${n}) Novo pedido · ` : ''}Painel | ${settings?.store_name ?? 'Loja'}`
  }, [settings?.store_name, location.pathname, alerts.newCount])

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Painel">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-h-11 items-center gap-2.5 rounded-full px-3 text-sm lg:min-h-9 ${
              isActive ? 'bg-surface-strong font-medium text-ink' : 'text-muted hover:text-ink'
            }`
          }
        >
          <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> {label}
          {to === '/admin/pedidos' && alerts.newCount > 0 && (
            <span
              className="tabular ml-auto rounded-full bg-[#c4242a] px-2 py-0.5 text-xs font-semibold text-white"
              aria-label={`${alerts.newCount} pedidos novos`}
            >
              {alerts.newCount}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )

  // O produto e o escopo no topo da moldura: a marca (o logo já traz o nome) e "Painel"
  const brand = (
    <div className="flex flex-col items-start gap-1 px-2">
      {settings?.logo_url ? (
        <img src={settings.logo_url} alt={settings.store_name} className="h-10 w-auto" />
      ) : (
        <BrandLogo name={settings?.store_name ?? 'Glow Slim Farma'} size="sm" />
      )}
      <span className="text-xs text-muted">Painel administrativo</span>
    </div>
  )

  const footer = (
    <div className="mt-auto space-y-0.5 pt-4">
      {/* aviso de pedido novo: som e notificação do sistema */}
      <button
        onClick={() => alerts.setSound(!alerts.sound)}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-full px-3 text-sm text-muted hover:text-ink lg:min-h-9"
        aria-pressed={alerts.sound}
      >
        {alerts.sound ? (
          <Volume2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <VolumeX className="size-4" strokeWidth={1.75} aria-hidden="true" />
        )}
        Som de pedido: {alerts.sound ? 'ligado' : 'desligado'}
      </button>
      {alerts.permission === 'default' && (
        <button
          onClick={() => void alerts.requestPermission()}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-full px-3 text-sm text-muted hover:text-ink lg:min-h-9"
        >
          <Bell className="size-4" strokeWidth={1.75} aria-hidden="true" /> Ativar notificações
        </button>
      )}
      <p className="truncate px-3 pt-2 pb-1 text-xs text-muted">{session?.user.email}</p>
      <Link to="/" target="_blank" className="flex min-h-11 items-center gap-2.5 rounded-full px-3 text-sm text-muted hover:text-ink lg:min-h-9">
        <ExternalLink className="size-4" strokeWidth={1.75} aria-hidden="true" /> Ver loja
      </Link>
      <button onClick={() => void signOut()} className="flex min-h-11 w-full items-center gap-2.5 rounded-full px-3 text-sm text-muted hover:text-red-700 lg:min-h-9">
        <LogOut className="size-4" strokeWidth={1.75} aria-hidden="true" /> Sair
      </button>
    </div>
  )

  return (
    // TasteSkill, estilo "framed-sheet": moldura tingida do azul da marca com a barra lateral;
    // o trabalho fica numa folha branca recuada 8px, com linha de 1px e cantos de 16px, sem sombra.
    <div className="admin min-h-dvh bg-surface-soft lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col p-3 pt-4 lg:flex">
        <div className="mb-5">{brand}</div>
        {nav}
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 bg-surface-soft px-2 lg:hidden">
        <button className="btn-ghost size-11 px-0" onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu className="size-6" />
        </button>
        <span className="text-sm font-medium text-ink">{settings?.store_name ?? 'Loja'} · Painel</span>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu do painel">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col overflow-y-auto overscroll-contain bg-surface-soft p-3 shadow-xl"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a')) setOpen(false)
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              {brand}
              <button className="btn-ghost size-11 px-0" onClick={() => setOpen(false)} aria-label="Fechar menu">
                <X className="size-6" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      {/* Alertas de pedido novo (sobrepõem a tela no canto, até 4) */}
      {alerts.alerts.length > 0 && (
        <div className="fixed top-3 right-3 left-3 z-[70] flex flex-col items-end gap-2 sm:left-auto sm:w-96" role="status" aria-live="assertive">
          {alerts.alerts.map((o) => (
            <div key={o.id} className="flex w-full items-start gap-3 rounded-2xl border border-hairline bg-white p-4 shadow-lg">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-dark text-white">
                <BellRing className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  Novo {o.kind === 'order' ? 'pedido' : 'orçamento'} <span className="tabular">#{o.order_number}</span>
                </p>
                <p className="truncate text-sm text-body">{orderAlertText(o)}</p>
                <Link
                  to={`/admin/pedidos/${o.id}`}
                  onClick={() => alerts.dismiss(o.id)}
                  className="mt-2 inline-flex min-h-9 items-center text-sm font-semibold text-brand-dark hover:underline"
                >
                  Ver pedido
                </Link>
              </div>
              <button onClick={() => alerts.dismiss(o.id)} className="-m-1 flex size-9 shrink-0 items-center justify-center rounded-full text-body hover:bg-surface-strong" aria-label="Fechar aviso">
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <main className="min-w-0 flex-1 bg-white p-4 sm:p-6 lg:my-2 lg:mr-2 lg:min-h-[calc(100dvh-1rem)] lg:rounded-3xl lg:border lg:border-hairline">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}

export function AdminPageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  /** Uma frase sobre os dados (o achado, o período), nunca sobre a interface. */
  subtitle?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}
