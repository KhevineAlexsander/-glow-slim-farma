import { createPortal } from 'react-dom'
import { formatBRL } from '../../lib/money'
import { formatDateTime, ORDER_STATUS } from '../../lib/orderStatus'
import type { Order, OrderItem, StoreSettings } from '../../types'

export type PaperWidth = '80' | '58'

function formatPhone(digits: string) {
  const d = digits.replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

/**
 * Comprovante para impressora térmica (bobina de 80 mm ou 58 mm). Fica escondido na
 * tela e é a única coisa impressa (ver .print-receipt em index.css). Letra mono,
 * preto puro e linhas tracejadas, como um cupom.
 */
export function OrderReceipt({
  order,
  items,
  settings,
  paper,
}: {
  order: Order
  items: OrderItem[]
  settings: StoreSettings | null
  paper: PaperWidth
}) {
  const title = order.kind === 'order' ? 'PEDIDO' : 'ORÇAMENTO'
  const units = items.reduce((n, i) => n + i.quantity, 0)
  return createPortal(
    <div className={`print-receipt paper-${paper}`} aria-hidden="true">
      <div className="r-center">
        <p className="r-big">{settings?.store_name ?? 'Glow Slim Farma'}</p>
        {settings?.address && <p>{settings.address}</p>}
        {settings?.whatsapp_number && <p>WhatsApp {formatPhone(settings.whatsapp_number)}</p>}
      </div>
      <hr />
      <p className="r-big r-center">
        {title} #{order.order_number}
      </p>
      <p className="r-center">{formatDateTime(order.created_at)}</p>
      <p className="r-center">Status: {ORDER_STATUS[order.status].label}</p>
      <hr />
      <p>
        <b>Cliente:</b> {order.customer_name}
      </p>
      <p>
        <b>Tel.:</b> {formatPhone(order.customer_phone)}
      </p>
      {order.customer_city && (
        <p>
          <b>Cidade:</b> {order.customer_city}
        </p>
      )}
      {order.customer_email && <p>{order.customer_email}</p>}
      <hr />
      {items.map((i) => (
        <div key={i.id} className="r-item">
          <p>
            {i.quantity}x {i.product_name}
            {i.requires_prescription ? ' (receita)' : ''}
          </p>
          <p className="r-row">
            <span>{i.unit_price_cents != null ? `${i.quantity} x ${formatBRL(i.unit_price_cents)}` : 'a cotar'}</span>
            <span>{i.line_total_cents != null ? formatBRL(i.line_total_cents) : '—'}</span>
          </p>
        </div>
      ))}
      <hr />
      <p className="r-row">
        <span>Itens</span>
        <span>{units}</span>
      </p>
      <p className="r-row r-big">
        <span>{order.has_unpriced_items ? 'SUBTOTAL' : 'TOTAL'}</span>
        <span>{formatBRL(order.total_cents)}</span>
      </p>
      {order.has_unpriced_items && <p>+ itens a cotar</p>}
      {order.notes && (
        <>
          <hr />
          <p>
            <b>Obs. do cliente:</b> {order.notes}
          </p>
        </>
      )}
      {order.requires_document_review && (
        <>
          <hr />
          <p>
            <b>Contém itens que exigem receita.</b> {order.documents_verified ? 'Receita verificada.' : 'Receita a verificar.'}
          </p>
        </>
      )}
      <hr />
      <p className="r-center">Pagamento e entrega combinados pelo WhatsApp.</p>
      <p className="r-center">Obrigado pela preferência!</p>
    </div>,
    document.body,
  )
}
