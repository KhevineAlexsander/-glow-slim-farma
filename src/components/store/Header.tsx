import { Lock, Menu, ShoppingCart, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import type { Category } from '../../types'
import { buildCategoryTree } from '../../lib/categoryTree'
import { Logo } from './Logo'
import { SearchBar } from './SearchBar'
import { groupColors } from './VialArt'

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
    `inline-flex h-11 items-center text-sm font-medium transition-colors ${isActive ? 'text-ink' : 'text-body hover:text-ink'}`
  const iconButton =
    'relative flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-2 text-ink transition-colors hover:bg-surface-strong'

  return (
    // Barra de navegação clara do sistema: 64px, branca, linha de 1px embaixo
    <header className="sticky top-0 z-40 border-b border-hairline bg-white">
      {s.announcement_active && s.announcement_text && (
        <div className="bg-dark px-4 py-2 text-center text-sm font-medium text-white">{s.announcement_text}</div>
      )}
      <div className="wrap flex h-16 items-center gap-2 sm:gap-3">
        <button className={`${iconButton} md:hidden`} onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu className="size-6" />
        </button>
        <Logo className="h-9 sm:h-10" />
        <nav className="ml-6 hidden items-center gap-6 lg:flex">
          <NavLink to="/" end className={navClass}>
            Início
          </NavLink>
          <NavLink to="/produtos" className={navClass}>
            Produtos
          </NavLink>
        </nav>
        <SearchBar className="mx-2 hidden max-w-md flex-1 md:ml-auto md:block" />
        <Link
          to={session ? '/minha-conta' : '/entrar'}
          className={`${iconButton} ml-auto md:ml-0`}
          aria-label={accountLabel}
          title={accountLabel}
        >
          <UserRound className="size-5 shrink-0" />
          <span className="hidden max-w-28 truncate text-sm font-medium lg:inline">
            {session ? (firstName ?? 'Minha conta') : 'Entrar'}
          </span>
        </Link>
        <Link to="/carrinho" className={iconButton} aria-label={`${cartLabel} (${count} itens)`}
        >
          <ShoppingCart className="size-5" />
          {count > 0 && (
            <span className="tabular absolute top-0.5 right-0 flex min-w-5 items-center justify-center rounded-full bg-brand-dark px-1 text-xs font-semibold text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Link>
      </div>
      <div className="wrap pb-3 md:hidden">
        <SearchBar />
      </div>

      {/* Renderizado no <body>: o menu "fixed" cobre a tela inteira, sem depender do cabeçalho */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside
            className="absolute inset-y-0 left-0 flex w-80 max-w-[85%] flex-col overflow-y-auto overscroll-contain bg-white p-5 shadow-2xl" // taste-skill-ignore: gaveta do menu sobre a página (sobreposição real)
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
              <Link to="/" className="px-3 py-3 font-medium text-ink hover:bg-surface-strong">
                Início
              </Link>
              <Link to="/produtos" className="px-3 py-3 font-medium text-ink hover:bg-surface-strong">
                Todos os produtos
              </Link>
              <Link to="/carrinho" className="px-3 py-3 font-medium text-ink hover:bg-surface-strong">
                {cartLabel}
              </Link>
              <Link
                to={session ? '/minha-conta' : '/entrar'}
                className="flex items-center gap-3 px-3 py-3 font-medium text-ink hover:bg-surface-strong"
              >
                <UserRound className="size-5 text-muted" /> {session ? 'Minha conta' : 'Entrar / Criar conta'}
              </Link>
            </nav>
            {categories.length > 0 && (
              <>
                <p className="mt-6 mb-1 px-3 text-sm font-medium text-muted">Grupos</p>
                <nav className="flex flex-col gap-1">
                  {buildCategoryTree(categories).map(({ group: c }, index) => (
                    <Link
                      key={c.id}
                      to={`/produtos?categoria=${c.slug}`}
                      className="flex items-center gap-3 px-3 py-2.5 text-ink hover:bg-surface-strong"
                    >
                      {/* a bolinha é a cor dos frascos do grupo */}
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: groupColors(index)[0] }}
                        aria-hidden="true"
                      />
                      {c.name}
                    </Link>
                  ))}
                </nav>
              </>
            )}
            <Link
              to="/admin/login"
              className="mt-auto flex min-h-11 items-center gap-2 px-3 pt-6 text-sm font-medium text-muted hover:text-ink"
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
