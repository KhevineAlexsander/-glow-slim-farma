import { Lock, Menu, ShoppingCart, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import type { Category } from '../../types'
import { CategoryIcon } from '../ui/icons'
import { Logo } from './Logo'
import { SearchBar } from './SearchBar'

export function Header({ categories }: { categories: Category[] }) {
  const s = useLoadedSettings()
  const { count } = useCart()
  const { session, profile } = useAuth()
  const accountLabel = session ? 'Minha conta' : 'Entrar'
  const firstName = profile?.full_name?.split(' ')[0]
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const cartLabel = s.sales_mode === 'quote' ? 'Orçamento' : 'Carrinho'

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search])

  // Com o menu aberto: trava a rolagem da página e fecha com Esc
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-semibold transition-colors ${isActive ? 'text-brand' : 'text-slate-600 hover:text-brand'}`

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      {s.announcement_active && s.announcement_text && (
        <div className="bg-brand-gradient px-4 py-2 text-center text-xs font-semibold text-white sm:text-sm">
          {s.announcement_text}
        </div>
      )}
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <button
          className="flex size-11 items-center justify-center rounded-2xl bg-brand-light text-brand-dark md:hidden"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="size-6" />
        </button>
        <Logo className="h-10 sm:h-12" />
        <SearchBar className="mx-4 hidden flex-1 md:block" />
        <nav className="hidden items-center gap-6 lg:flex">
          <NavLink to="/" end className={navClass}>
            Início
          </NavLink>
          <NavLink to="/produtos" className={navClass}>
            Produtos
          </NavLink>
        </nav>
        <Link
          to={session ? '/minha-conta' : '/entrar'}
          className="ml-auto flex h-11 min-w-11 items-center justify-center gap-2 rounded-2xl bg-brand-light px-3 text-brand-dark md:ml-0"
          aria-label={accountLabel}
          title={accountLabel}
        >
          <UserRound className="size-6 shrink-0" />
          <span className="hidden max-w-28 truncate text-sm font-semibold lg:inline">
            {session ? (firstName ?? 'Minha conta') : 'Entrar'}
          </span>
        </Link>
        <Link
          to="/carrinho"
          className="relative flex size-11 items-center justify-center rounded-2xl bg-brand-light text-brand-dark"
          aria-label={`${cartLabel} (${count} itens)`}
        >
          <ShoppingCart className="size-6" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs font-bold text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Link>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <SearchBar />
      </div>

      {/* Renderizado no <body>: o backdrop-blur do header prenderia o menu "fixed" à altura do header */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside
            className="absolute inset-y-0 left-0 flex w-80 max-w-[85%] flex-col overflow-y-auto overscroll-contain bg-white p-5 shadow-xl"
            // Qualquer link fecha o menu (inclusive o da página atual, que não muda a URL)
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a')) setOpen(false)
            }}
          >
            <div className="mb-6 flex items-center justify-between">
              <Logo className="h-10" />
              <button className="btn-ghost size-11 px-0" onClick={() => setOpen(false)} aria-label="Fechar menu">
                <X className="size-6" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              <Link to="/" className="rounded-xl px-3 py-3 font-semibold text-slate-700 hover:bg-brand-light">
                Início
              </Link>
              <Link to="/produtos" className="rounded-xl px-3 py-3 font-semibold text-slate-700 hover:bg-brand-light">
                Todos os produtos
              </Link>
              <Link to="/carrinho" className="rounded-xl px-3 py-3 font-semibold text-slate-700 hover:bg-brand-light">
                {cartLabel}
              </Link>
              <Link
                to={session ? '/minha-conta' : '/entrar'}
                className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-slate-700 hover:bg-brand-light"
              >
                <UserRound className="size-5 text-brand" /> {session ? 'Minha conta' : 'Entrar / Criar conta'}
              </Link>
            </nav>
            {categories.length > 0 && (
              <>
                <p className="mt-6 mb-2 px-3 text-xs font-bold tracking-wider text-slate-400 uppercase">Categorias</p>
                <nav className="flex flex-col gap-1">
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      to={`/produtos?categoria=${c.slug}`}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-700 hover:bg-brand-light"
                    >
                      <CategoryIcon name={c.icon} className="size-5 text-brand" />
                      {c.name}
                    </Link>
                  ))}
                </nav>
              </>
            )}
            <Link
              to="/admin/login"
              className="mt-auto flex min-h-11 items-center gap-2 border-t border-slate-100 px-3 pt-4 text-sm font-semibold text-slate-500 hover:text-brand"
            >
              <Lock className="size-4" /> Acesso da equipe
            </Link>
          </aside>
        </div>,
          document.body,
        )}
    </header>
  )
}
