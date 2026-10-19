import { MessageCircle, ShoppingCart } from 'lucide-react'
import { useCart } from '../../contexts/CartContext'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { productDisplay } from '../../lib/pricing'
import { productInquiryMessage, whatsappLink } from '../../lib/whatsapp'
import type { CatalogProduct } from '../../types'
import { useToast } from '../ui/Toast'

/** Botão principal do produto — só aparece quando a ação é realmente possível. */
export function ProductAction({
  product,
  quantity = 1,
  compact = false,
}: {
  product: CatalogProduct
  quantity?: number
  compact?: boolean
}) {
  const s = useLoadedSettings()
  const { add } = useCart()
  const toast = useToast()
  const d = productDisplay(product, s)

  if (d.action === 'add_to_cart' || d.action === 'add_to_quote') {
    return (
      <button
        type="button"
        className={compact ? 'btn-primary size-11 shrink-0 px-0' : 'btn-primary w-full'}
        onClick={() => {
          add(product.id, quantity)
          toast(d.action === 'add_to_quote' ? 'Adicionado ao orçamento.' : 'Adicionado ao carrinho.')
        }}
        aria-label={d.actionLabel}
        title={d.actionLabel}
      >
        <ShoppingCart className="size-5" />
        {!compact && d.actionLabel}
      </button>
    )
  }

  if (d.action === 'whatsapp' && s.whatsapp_number) {
    return (
      <a
        href={whatsappLink(s.whatsapp_number, productInquiryMessage(s.store_name, product.name, product.sku))}
        target="_blank"
        rel="noopener noreferrer"
        className={compact ? 'btn-whatsapp size-11 shrink-0 px-0' : 'btn-whatsapp w-full'}
        aria-label={d.actionLabel}
        title={d.actionLabel}
      >
        <MessageCircle className="size-5" />
        {!compact && d.actionLabel}
      </a>
    )
  }

  if (d.action === 'unavailable' && !compact) {
    return (
      <button type="button" className="btn w-full bg-slate-100 text-slate-500" disabled>
        Indisponível
      </button>
    )
  }

  return null
}
