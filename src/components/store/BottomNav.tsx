import { Home, LayoutGrid, MessageCircle, ShoppingCart } from 'lucide-react'
import { NavLink } from 'react-router'
import { useCart } from '../../contexts/CartContext'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { whatsappLink } from '../../lib/whatsapp'

/** Navegação inferior fixa no celular (mantém o carrinho sempre acessível). */
export function BottomNav() {
  const s = useLoadedSettings()
  const { count } = useCart()
  const item = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${isActive ? 'text-brand-dark' : 'text-body'}`

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-hairline bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Navegação principal"
    >
      <NavLink to="/" end className={item}>
        <Home className="size-5" /> Início
      </NavLink>
      <NavLink to="/produtos" className={item}>
        <LayoutGrid className="size-5" /> Produtos
      </NavLink>
      <NavLink to="/carrinho" className={item}>
        <span className="relative">
          <ShoppingCart className="size-5" />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-2.5 flex min-w-4.5 items-center justify-center rounded-full bg-brand-dark px-1 text-xs font-semibold text-white tabular">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </span>
        {s.sales_mode === 'quote' ? 'Orçamento' : 'Carrinho'}
      </NavLink>
      {s.whatsapp_number && (
        <a
          href={whatsappLink(s.whatsapp_number, `Olá, ${s.store_name}!`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium text-body"
        >
          <MessageCircle className="size-5" /> WhatsApp
        </a>
      )}
    </nav>
  )
}
