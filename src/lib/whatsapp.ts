import type { PlacedOrder } from '../types'
import { formatBRL } from './money'

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Número no formato do WhatsApp (com DDI). Telefones brasileiros digitados só
 * com DDD + número (10 ou 11 dígitos) recebem o 55 na frente.
 */
export function toWhatsappNumber(number: string): string {
  const digits = onlyDigits(number)
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits
}

/** Link oficial de clique para conversa (https://wa.me). */
export function whatsappLink(number: string, text?: string): string {
  const base = `https://wa.me/${toWhatsappNumber(number)}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export function productInquiryMessage(storeName: string, productName: string, sku?: string | null): string {
  const ref = sku ? ` (ref. ${sku})` : ''
  return `Olá, ${storeName}! Gostaria de informações sobre o produto: ${productName}${ref}.`
}

/** Resumo do pedido para o WhatsApp — usa os valores devolvidos pelo banco. */
export function orderMessage(storeName: string, order: PlacedOrder, customerName: string): string {
  const title = order.kind === 'order' ? 'Pedido' : 'Solicitação de orçamento'
  const lines = [
    `Olá, ${storeName}! Sou ${customerName}.`,
    `${title} nº ${order.order_number}:`,
    '',
    ...order.items.map((i) => {
      const price =
        i.unit_price_cents != null
          ? ` — ${formatBRL(i.unit_price_cents)} un.`
          : ' — preço a consultar'
      const rx = i.requires_prescription ? ' (exige prescrição/avaliação)' : ''
      const ref = i.sku ? ` [${i.sku}]` : ''
      return `• ${i.quantity}x ${i.name}${ref}${price}${rx}`
    }),
    '',
  ]
  if (order.total_cents > 0) {
    lines.push(
      order.has_unpriced_items
        ? `Subtotal dos itens com preço: ${formatBRL(order.total_cents)}`
        : `Total: ${formatBRL(order.total_cents)}`,
    )
  }
  if (order.requires_document_review) {
    lines.push('Alguns itens exigem receita: combinamos o envio por aqui.')
  }
  return lines.join('\n')
}
