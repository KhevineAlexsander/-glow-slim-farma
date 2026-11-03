export interface OrderDiscount {
  discount_cents: number
  discount_percent: number | null
}

export const NO_DISCOUNT: OrderDiscount = { discount_cents: 0, discount_percent: null }

/**
 * Valor do desconto sobre a soma dos itens (prévia na tela: quem grava o total é o banco).
 * O percentual tem prioridade e o desconto nunca passa da soma.
 */
export function discountAmount(subtotalCents: number, d: OrderDiscount): number {
  const value = d.discount_percent != null ? Math.round((subtotalCents * d.discount_percent) / 100) : d.discount_cents
  return Math.min(subtotalCents, value)
}
