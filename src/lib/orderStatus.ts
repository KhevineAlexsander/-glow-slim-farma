import type { OrderStatus } from '../types'

/** Rótulos de status de pedido (usados no painel e na área do cliente). */
export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: 'blue' | 'amber' | 'green' | 'slate' | 'red' }> = {
  new: { label: 'Novo', tone: 'blue' },
  in_review: { label: 'Em atendimento', tone: 'amber' },
  confirmed: { label: 'Confirmado', tone: 'green' },
  completed: { label: 'Concluído', tone: 'slate' },
  cancelled: { label: 'Cancelado', tone: 'red' },
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
