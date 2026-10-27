import type { NoPriceLabel, SalesMode } from '../types'
import { formatBRL } from './money'

export interface PricedProduct {
  price_cents: number
  promo_price_cents: number | null
  is_available: boolean
  requires_prescription: boolean
  restricted_sale: boolean
}

export interface PricingSettings {
  sales_mode: SalesMode
  no_price_label: NoPriceLabel
  whatsapp_number: string | null
  /** Vende com preço os produtos com prescrição/venda restrita (com aviso e confirmação no carrinho). */
  sell_restricted: boolean
}

/** Preço efetivo em centavos (promoção válida tem prioridade). 0 = sem preço. */
export function effectivePriceCents(p: Pick<PricedProduct, 'price_cents' | 'promo_price_cents'>): number {
  if (p.promo_price_cents != null && p.promo_price_cents > 0 && p.promo_price_cents < p.price_cents) {
    return p.promo_price_cents
  }
  return p.price_cents > 0 ? p.price_cents : 0
}

export function hasValidPrice(p: Pick<PricedProduct, 'price_cents' | 'promo_price_cents'>): boolean {
  return effectivePriceCents(p) > 0
}

export function isRestricted(p: Pick<PricedProduct, 'requires_prescription' | 'restricted_sale'>): boolean {
  return p.requires_prescription || p.restricted_sale
}

/** Produto restrito cujo preço fica oculto (venda de restritos desligada no painel). */
export function priceHidden(p: Pick<PricedProduct, 'requires_prescription' | 'restricted_sale'>, s: Pick<PricingSettings, 'sell_restricted'>): boolean {
  return isRestricted(p) && !s.sell_restricted
}

export function noPriceText(label: NoPriceLabel): string {
  return label === 'whatsapp' ? 'Consulte pelo WhatsApp' : 'Preço sob consulta'
}

export type ProductAction = 'add_to_cart' | 'add_to_quote' | 'whatsapp' | 'unavailable' | 'none'

export interface ProductDisplay {
  /** Preço formatado a exibir, ou null quando não deve ser exibido. */
  price: string | null
  /** Preço "de" riscado quando há promoção válida. */
  oldPrice: string | null
  discountPercent: number | null
  /** Texto exibido no lugar do preço (nunca "R$ 0,00"). */
  priceNote: string | null
  restricted: boolean
  action: ProductAction
  actionLabel: string
}

/**
 * Decide o que a vitrine mostra para um produto. Regras:
 * - preço zero nunca aparece como grátis: mostra "Preço sob consulta"/"Consulte pelo WhatsApp";
 * - produtos com prescrição/venda restrita: com a venda de restritos ligada (padrão) exibem preço
 *   e entram no checkout com aviso; desligada, não exibem preço nem entram no checkout normal;
 * - no modo "pedido", só entram no carrinho produtos com preço válido e sem restrição;
 * - no modo "orçamento", qualquer produto disponível pode ser incluído na solicitação.
 */
export function productDisplay(p: PricedProduct, s: PricingSettings): ProductDisplay {
  const restricted = isRestricted(p)
  const hidden = priceHidden(p, s)
  const effective = effectivePriceCents(p)
  const hasPromo = effective > 0 && effective < p.price_cents

  let price: string | null = null
  let oldPrice: string | null = null
  let discountPercent: number | null = null
  let priceNote: string | null = null

  if (hidden) {
    priceNote = 'Venda sob prescrição/avaliação'
  } else if (effective > 0) {
    price = formatBRL(effective)
    if (hasPromo) {
      oldPrice = formatBRL(p.price_cents)
      discountPercent = Math.round(((p.price_cents - effective) * 100) / p.price_cents)
    }
  } else {
    priceNote = noPriceText(s.no_price_label)
  }

  const canWhatsApp = Boolean(s.whatsapp_number)
  let action: ProductAction
  let actionLabel: string

  if (!p.is_available) {
    action = 'unavailable'
    actionLabel = 'Indisponível'
  } else if (s.sales_mode === 'quote') {
    action = 'add_to_quote'
    actionLabel = 'Adicionar ao orçamento'
  } else if (!hidden && effective > 0) {
    action = 'add_to_cart'
    actionLabel = 'Adicionar ao carrinho'
  } else if (canWhatsApp) {
    action = 'whatsapp'
    actionLabel = 'Consultar no WhatsApp'
  } else {
    action = 'none'
    actionLabel = ''
  }

  return { price, oldPrice, discountPercent, priceNote, restricted, action, actionLabel }
}
