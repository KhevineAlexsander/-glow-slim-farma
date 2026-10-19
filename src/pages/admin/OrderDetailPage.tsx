import { ChevronLeft, MessageCircle, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Badge, ErrorBox, PageLoader, Toggle } from '../../components/ui/misc'
import { useToast } from '../../components/ui/Toast'
import { formatBRL } from '../../lib/money'
import { friendlyError } from '../../lib/supabase'
import { whatsappLink } from '../../lib/whatsapp'
import { getOrder, updateOrder } from '../../services/admin'
import type { Order, OrderItem, OrderStatus, OrderStatusHistory } from '../../types'
import { formatDateTime, ORDER_STATUS } from './OrdersPage'

export default function OrderDetailPage() {
  const { id = '' } = useParams()
  const toast = useToast()
  const [data, setData] = useState<{ order: Order; items: OrderItem[]; history: OrderStatusHistory[] } | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () =>
    getOrder(id)
      .then((d) => {
        setData(d)
        setNotes(d.order.admin_notes ?? '')
      })
      .catch((e) => setError(friendlyError(e)))

  useEffect(() => void load(), [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorBox message={error} />
  if (!data) return <PageLoader />
  const { order, items, history } = data

  const save = async (patch: Partial<Pick<Order, 'status' | 'admin_notes' | 'documents_verified'>>) => {
    setSaving(true)
    try {
      await updateOrder(order.id, patch)
      await load()
      toast('Pedido atualizado.')
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/admin/pedidos" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand">
        <ChevronLeft className="size-4" /> Pedidos
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900">
          {order.kind === 'order' ? 'Pedido' : 'Orçamento'} #{order.order_number}
        </h1>
        <Badge tone={ORDER_STATUS[order.status].tone}>{ORDER_STATUS[order.status].label}</Badge>
      </div>
      <p className="text-sm text-slate-500">Recebido em {formatDateTime(order.created_at)}</p>

      <section className="card space-y-1 p-4 text-sm">
        <h2 className="mb-2 font-bold">Cliente</h2>
        <p><strong>{order.customer_name}</strong></p>
        <p>Telefone: {order.customer_phone}</p>
        {order.customer_email && <p>E-mail: {order.customer_email}</p>}
        {order.customer_city && <p>Cidade: {order.customer_city}</p>}
        {order.notes && <p className="mt-2 rounded-lg bg-slate-50 p-2 whitespace-pre-line">Obs.: {order.notes}</p>}
        <a href={whatsappLink(order.customer_phone, `Olá, ${order.customer_name}! Sobre seu ${order.kind === 'order' ? 'pedido' : 'orçamento'} nº ${order.order_number}:`)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp mt-3">
          <MessageCircle className="size-4" /> Conversar no WhatsApp
        </a>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-bold">Itens (valores registrados no momento do pedido)</h2>
        <div className="divide-y divide-slate-100 text-sm">
          {items.map((i) => (
            <div key={i.id} className="flex items-start justify-between gap-3 py-2">
              <div>
                <p className="font-medium">{i.quantity}x {i.product_name}</p>
                <p className="text-xs text-slate-500">
                  {i.product_sku && `Ref. ${i.product_sku} · `}
                  {i.unit_price_cents != null ? `${formatBRL(i.unit_price_cents)} un.` : 'Sem preço — a cotar'}
                </p>
                {i.requires_prescription && (
                  <p className="flex items-center gap-1 text-xs font-semibold text-amber-700"><ShieldAlert className="size-3.5" /> Exige prescrição/avaliação</p>
                )}
              </div>
              <p className="shrink-0 font-semibold">{i.line_total_cents != null ? formatBRL(i.line_total_cents) : '—'}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 font-bold">
          <span>{order.has_unpriced_items ? 'Subtotal (itens com preço)' : 'Total'}</span>
          <span>{formatBRL(order.total_cents)}</span>
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <h2 className="font-bold">Atendimento</h2>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" className="input" disabled={saving} value={order.status} onChange={(e) => void save({ status: e.target.value as OrderStatus })}>
            {Object.entries(ORDER_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        {order.requires_document_review && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <Toggle
              checked={order.documents_verified}
              disabled={saving}
              onChange={(v) => void save({ documents_verified: v })}
              label="Receita/documentação verificada pelo responsável"
              description="Este pedido contém itens com prescrição ou venda restrita."
            />
          </div>
        )}
        <div>
          <label className="label" htmlFor="anotes">Observações internas</label>
          <textarea id="anotes" className="input min-h-24 py-2" maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn-outline mt-2" disabled={saving || notes === (order.admin_notes ?? '')} onClick={() => void save({ admin_notes: notes.trim() || null })}>
            Salvar observações
          </button>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-bold">Histórico</h2>
        <ol className="space-y-2 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex justify-between gap-3">
              <span>
                {h.old_status ? `${ORDER_STATUS[h.old_status].label} → ` : 'Criado como '}
                <strong>{ORDER_STATUS[h.new_status].label}</strong>
              </span>
              <span className="text-slate-500">{formatDateTime(h.created_at)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
