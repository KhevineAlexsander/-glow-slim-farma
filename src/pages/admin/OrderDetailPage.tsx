import { ChevronLeft, MessageCircle, Minus, Pencil, Plus, Printer, Search, ShieldAlert, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { OrderReceipt, type PaperWidth } from '../../components/admin/OrderReceipt'
import { PriceCell } from '../../components/admin/PriceCell'
import { Badge, ErrorBox, PageLoader, Toggle } from '../../components/ui/misc'
import { useToast } from '../../components/ui/Toast'
import { useSettings } from '../../contexts/SettingsContext'
import { formatBRL } from '../../lib/money'
import { formatDateTime, ORDER_STATUS } from '../../lib/orderStatus'
import { friendlyError } from '../../lib/supabase'
import { onlyDigits, whatsappLink } from '../../lib/whatsapp'
import {
  addOrderItem,
  deleteOrder,
  deleteOrderItem,
  getOrder,
  listProducts,
  updateOrder,
  updateOrderItem,
  type OrderPatch,
  type ProductRow,
} from '../../services/admin'
import type { Order, OrderItem, OrderStatus, OrderStatusHistory } from '../../types'

const PAPER_KEY = 'glow:receipt-paper'

function readPaper(): PaperWidth {
  try {
    return localStorage.getItem(PAPER_KEY) === '58' ? '58' : '80'
  } catch {
    return '80'
  }
}

/** Dados do cliente: visualização com botão Editar, que vira formulário. */
function CustomerCard({ order, onSave }: { order: Order; onSave: (patch: OrderPatch) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    customer_email: order.customer_email ?? '',
    customer_city: order.customer_city ?? '',
    notes: order.notes ?? '',
  })
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const phone = onlyDigits(form.customer_phone)
    if (form.customer_name.trim().length < 2) return setError('Informe o nome do cliente.')
    if (phone.length < 10 || phone.length > 15) return setError('Telefone inválido: use DDD + número.')
    const ok = await onSave({
      customer_name: form.customer_name.trim(),
      customer_phone: phone,
      customer_email: form.customer_email.trim() || null,
      customer_city: form.customer_city.trim() || null,
      notes: form.notes.trim() || null,
    })
    if (ok) setEditing(false)
  }

  if (!editing) {
    return (
      <section className="card space-y-1 p-5 text-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-base font-medium text-ink">Cliente</h2>
          <button className="btn-ghost min-h-9 px-3 text-sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden="true" /> Editar
          </button>
        </div>
        <p className="font-semibold text-ink">{order.customer_name}</p>
        <p>Telefone: {order.customer_phone}</p>
        {order.customer_email && <p>E-mail: {order.customer_email}</p>}
        {order.customer_city && <p>Cidade: {order.customer_city}</p>}
        {order.notes && <p className="mt-2 rounded-lg bg-surface-soft p-2 whitespace-pre-line">Obs.: {order.notes}</p>}
        <a
          href={whatsappLink(order.customer_phone, `Olá, ${order.customer_name}! Sobre seu ${order.kind === 'order' ? 'pedido' : 'orçamento'} nº ${order.order_number}:`)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-whatsapp mt-3"
        >
          <MessageCircle className="size-4" aria-hidden="true" /> Conversar no WhatsApp
        </a>
      </section>
    )
  }

  const field = (k: keyof typeof form) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }) })
  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h2 className="text-base font-medium text-ink">Editar cliente</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Nome *</span>
          <input className="input" maxLength={120} required {...field('customer_name')} />
        </label>
        <label className="block">
          <span className="label">Telefone / WhatsApp com DDD *</span>
          <input className="input" inputMode="tel" required {...field('customer_phone')} />
        </label>
        <label className="block">
          <span className="label">E-mail</span>
          <input className="input" type="email" maxLength={120} {...field('customer_email')} />
        </label>
        <label className="block">
          <span className="label">Cidade</span>
          <input className="input" maxLength={120} {...field('customer_city')} />
        </label>
      </div>
      <label className="block">
        <span className="label">Observações do cliente</span>
        <textarea className="input min-h-20 py-2" maxLength={1000} {...field('notes')} />
      </label>
      {error && <ErrorBox message={error} />}
      <div className="flex gap-2">
        <button className="btn-primary">Salvar</button>
        <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/** Busca de produto para incluir no pedido. */
function AddItem({ onAdd }: { onAdd: (p: ProductRow) => Promise<void> }) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<ProductRow[] | null>(null)

  useEffect(() => {
    const q = term.trim()
    if (q.length < 2) {
      setResults(null)
      return
    }
    const t = setTimeout(() => {
      listProducts({ search: q, status: 'active', page: 1, pageSize: 6 })
        .then((r) => setResults(r.rows))
        .catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [term])

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <label className="relative block">
        <span className="sr-only">Buscar produto para incluir</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-body" aria-hidden="true" />
        <input className="input pl-10" placeholder="Incluir produto: busque pelo nome ou referência" value={term} onChange={(e) => setTerm(e.target.value)} />
      </label>
      {results && (
        <ul className="mt-2 divide-y divide-hairline rounded-xl border border-hairline">
          {results.length === 0 && <li className="p-3 text-sm text-body">Nenhum produto encontrado.</li>}
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-surface-soft"
                onClick={() => void onAdd(p).then(() => setTerm(''))}
              >
                <span className="min-w-0 truncate text-ink">{p.name}</span>
                <span className="tabular flex shrink-0 items-center gap-2 text-body">
                  {p.price_cents > 0 ? formatBRL(p.promo_price_cents && p.promo_price_cents < p.price_cents ? p.promo_price_cents : p.price_cents) : 'sem preço'}
                  <Plus className="size-4 text-brand-dark" aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function OrderDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { settings } = useSettings()
  const [data, setData] = useState<{ order: Order; items: OrderItem[]; history: OrderStatusHistory[] } | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [paper, setPaper] = useState<PaperWidth>(readPaper)

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

  /** Executa uma alteração, recarrega o pedido (total recalculado pelo banco) e avisa. */
  const run = async (action: () => Promise<unknown>, message: string): Promise<boolean> => {
    setSaving(true)
    try {
      await action()
      await load()
      toast(message)
      return true
    } catch (e) {
      toast(friendlyError(e), 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  const save = (patch: OrderPatch) => run(() => updateOrder(order.id, patch), 'Pedido atualizado.')

  const print = (width: PaperWidth) => {
    setPaper(width)
    try {
      localStorage.setItem(PAPER_KEY, width)
    } catch {
      // preferência só nesta visita
    }
    // espera o comprovante renderizar na largura escolhida
    requestAnimationFrame(() => window.print())
  }

  const remove = async () => {
    const label = `${order.kind === 'order' ? 'pedido' : 'orçamento'} #${order.order_number}`
    if (!window.confirm(`Excluir o ${label} de ${order.customer_name}? Os itens e o histórico também serão apagados. Não dá para desfazer.`)) return
    setSaving(true)
    try {
      await deleteOrder(order.id)
      toast(`${label.charAt(0).toUpperCase() + label.slice(1)} excluído.`)
      navigate('/admin/pedidos', { replace: true })
    } catch (e) {
      toast(friendlyError(e), 'error')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/admin/pedidos" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink hover:underline">
        <ChevronLeft className="size-4" aria-hidden="true" /> Pedidos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink">
              {order.kind === 'order' ? 'Pedido' : 'Orçamento'} <span className="tabular">#{order.order_number}</span>
            </h1>
            <Badge tone={ORDER_STATUS[order.status].tone}>{ORDER_STATUS[order.status].label}</Badge>
          </div>
          <p className="mt-1 text-sm text-body">Recebido em {formatDateTime(order.created_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full bg-surface-strong p-1" role="group" aria-label="Largura da bobina">
            {(['80', '58'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setPaper(w)}
                aria-pressed={paper === w}
                className={`min-h-9 rounded-full px-3 text-sm ${paper === w ? 'bg-white font-medium text-ink' : 'text-body'}`}
              >
                {w} mm
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => print(paper)}>
            <Printer className="size-4" aria-hidden="true" /> Imprimir
          </button>
          <button className="btn-ghost text-[#a51a26] hover:text-[#a51a26]" onClick={() => void remove()} disabled={saving}>
            <Trash2 className="size-4" aria-hidden="true" /> Excluir
          </button>
        </div>
      </div>

      <CustomerCard key={order.updated_at} order={order} onSave={save} />

      <section className="card p-5">
        <h2 className="mb-1 text-base font-medium text-ink">Itens</h2>
        <p className="mb-3 text-xs text-body">Altere a quantidade ou o preço; o total é recalculado na hora.</p>
        <ul className="divide-y divide-hairline text-sm">
          {items.map((i) => (
            <li key={i.id} className="grid gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="font-medium text-ink">{i.product_name}</p>
                <p className="text-xs text-body">
                  {i.product_sku && `Ref. ${i.product_sku} · `}
                  {i.line_total_cents != null ? `Total da linha ${formatBRL(i.line_total_cents)}` : 'Sem preço — a cotar'}
                </p>
                {i.requires_prescription && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-800">
                    <ShieldAlert className="size-3.5" aria-hidden="true" /> Exige receita
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 items-center rounded-full bg-surface-strong">
                  <button
                    className="flex size-10 items-center justify-center rounded-full hover:bg-hairline disabled:opacity-40"
                    disabled={saving || i.quantity <= 1}
                    onClick={() => void run(() => updateOrderItem(i.id, { quantity: i.quantity - 1 }), 'Quantidade alterada.')}
                    aria-label={`Diminuir ${i.product_name}`}
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="tabular w-7 text-center font-medium text-ink">{i.quantity}</span>
                  <button
                    className="flex size-10 items-center justify-center rounded-full hover:bg-hairline disabled:opacity-40"
                    disabled={saving || i.quantity >= 999}
                    onClick={() => void run(() => updateOrderItem(i.id, { quantity: i.quantity + 1 }), 'Quantidade alterada.')}
                    aria-label={`Aumentar ${i.product_name}`}
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <div className="w-28">
                  <PriceCell
                    label={`Preço unitário de ${i.product_name}`}
                    cents={i.unit_price_cents}
                    allowEmpty
                    onSave={(v) => run(() => updateOrderItem(i.id, { unit_price_cents: v && v > 0 ? v : null }), 'Preço alterado.')}
                  />
                </div>
                <button
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-body hover:bg-surface-strong hover:text-[#a51a26] disabled:opacity-40"
                  disabled={saving || items.length <= 1}
                  title={items.length <= 1 ? 'O pedido precisa ter ao menos um item' : undefined}
                  onClick={() => {
                    if (window.confirm(`Remover ${i.product_name} do pedido?`)) void run(() => deleteOrderItem(i.id), 'Item removido.')
                  }}
                  aria-label={`Remover ${i.product_name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-hairline pt-3 text-base font-semibold text-ink">
          <span>{order.has_unpriced_items ? 'Subtotal (itens com preço)' : 'Total'}</span>
          <span className="tabular">{formatBRL(order.total_cents)}</span>
        </div>
        <AddItem onAdd={(p) => run(() => addOrderItem(order.id, p), `${p.name} incluído.`).then(() => undefined)} />
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-base font-medium text-ink">Atendimento</h2>
        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select id="status" className="input" disabled={saving} value={order.status} onChange={(e) => void save({ status: e.target.value as OrderStatus })}>
            {Object.entries(ORDER_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        {order.requires_document_review && (
          <div className="rounded-xl bg-[#fffbeb] p-3">
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
          <label className="label" htmlFor="anotes">
            Observações internas
          </label>
          <textarea id="anotes" className="input min-h-24 py-2" maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn-outline mt-2" disabled={saving || notes === (order.admin_notes ?? '')} onClick={() => void save({ admin_notes: notes.trim() || null })}>
            Salvar observações
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-base font-medium text-ink">Histórico</h2>
        <ol className="space-y-2 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex justify-between gap-3">
              <span>
                {h.old_status ? `${ORDER_STATUS[h.old_status].label} → ` : 'Criado como '}
                <strong>{ORDER_STATUS[h.new_status].label}</strong>
              </span>
              <span className="text-body">{formatDateTime(h.created_at)}</span>
            </li>
          ))}
        </ol>
      </section>

      <OrderReceipt order={order} items={items} settings={settings} paper={paper} />
    </div>
  )
}
