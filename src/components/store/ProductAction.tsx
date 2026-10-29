import { ShoppingCart } from 'lucide-react'
import { useCart } from '../../contexts/CartContext'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { productDisplay } from '../../lib/pricing'
import type { CatalogProduct } from '../../types'
import { useToast } from '../ui/Toast'

/** Versão do card: pílula secundária com rótulo curto (o rótulo completo vai no aria-label). */
const COMPACT = 'btn-outline w-full px-3 text-sm'

/** Botão principal do produto — só aparece quando a ação é realmente possível. */
export function ProductAction({
  product,
  quantity = 1,
  compact = false,
  size = 'md',
}: {
  product: CatalogProduct
  quantity?: number
  compact?: boolean
  /** lg: pílula de 56px (página do produto) */
  size?: 'md' | 'lg'
}) {
  const big = size === 'lg' ? ' btn-lg' : ''
  const s = useLoadedSettings()
  const { add } = useCart()
  const toast = useToast()
  const d = productDisplay(product, s)

  if (d.action === 'add_to_cart' || d.action === 'add_to_quote') {
    return (
      <button
        type="button"
        className={compact ? COMPACT : `btn-primary w-full${big}`}
        onClick={() => {
          add(product.id, quantity)
          toast(d.action === 'add_to_quote' ? 'Adicionado ao orçamento.' : 'Adicionado ao carrinho.')
        }}
        aria-label={d.actionLabel}
        title={d.actionLabel}
      >
        <ShoppingCart className="size-5" aria-hidden="true" />
        {compact ? 'Adicionar' : d.actionLabel}
      </button>
    )
  }


  if (d.action === 'unavailable') {
    if (compact) return <p className="flex min-h-11 items-center text-sm text-muted">Indisponível</p>
    return (
      <button type="button" className="btn w-full bg-slate-100 text-slate-600" disabled>
        Indisponível
      </button>
    )
  }

  return null
}
