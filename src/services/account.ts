import { supabase } from '../lib/supabase'
import type { Order, OrderItem } from '../types'

export type MyOrder = Pick<
  Order,
  'id' | 'order_number' | 'kind' | 'status' | 'total_cents' | 'has_unpriced_items' | 'requires_document_review' | 'created_at'
> & { order_items: Pick<OrderItem, 'product_name' | 'quantity' | 'unit_price_cents'>[] }

/**
 * Pedidos da conta logada. A RLS já restringe o cliente aos próprios pedidos;
 * o filtro por user_id garante o mesmo para um admin navegando como cliente.
 */
export async function fetchMyOrders(userId: string): Promise<MyOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, kind, status, total_cents, has_unpriced_items, requires_document_review, created_at, order_items(product_name, quantity, unit_price_cents)',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as MyOrder[]
}
