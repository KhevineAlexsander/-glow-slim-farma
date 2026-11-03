import { ChevronLeft, Minus, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { PriceCell } from '../../components/admin/PriceCell'
import { ProductPicker } from '../../components/admin/ProductPicker'
import { ErrorBox } from '../../components/ui/misc'
import { useToast } from '../../components/ui/Toast'
import { formatBRL } from '../../lib/money'
import { ORDER_STATUS } from '../../lib/orderStatus'
import { effectivePriceCents } from '../../lib/pricing'
import { friendlyError } from '../../lib/supabase'
import { onlyDigits } from '../../lib/whatsapp'
import { createManualOrder, type ProductRow } from '../../services/admin'
import type { OrderKind, OrderStatus } from '../../types'

interface Line {
  productId: string
  name: string
  sku: string | null
  quantity: number
  unitCents: number | null
}

const MAX_QTY = 999

/** Lançamento manual de pedido ou orçamento recebido fora do site. */
export default function NewOrderPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [lines, setLines] = useState<Line[]>([])
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', notes: '' })
  const [kind, setKind] = useState<OrderKind>('order')
  const [status, setStatus] = useState<OrderStatus>('confirmed')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const patchLine = (productId: string, patch: Partial<Line>) =>
    setLines((list) => list.map((l) => (l.productId === productId ? { ...l, ...patch } : l)))

  /** Produto repetido soma na linha que já existe, em vez de duplicar. */
  const addProduct = (p: ProductRow) => {
    setError(null)
    setLines((list) => {
      if (list.some((l) => l.productId === p.id)) {
        return list.map((l) => (l.productId === p.id ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + 1) } : l))
      }
      const unit = effectivePriceCents(p)
      return [...list, { productId: p.id, name: p.name, sku: p.sku, quantity: 1, unitCents: unit > 0 ? unit : null }]
    })
  }

  const total = lines.reduce((sum, l) => sum + (l.unitCents ?? 0) * l.quantity, 0)
  const hasUnpriced = lines.some((l) => l.unitCents == null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const phone = onlyDigits(form.phone)
    if (!lines.length) return setError('Inclua ao menos um produto no pedido.')
    if (form.name.trim().length < 2) return setError('Informe o nome do cliente.')
    if (phone.length < 10 || phone.length > 15) return setError('Telefone inválido: use DDD + número.')

    setSaving(true)
    try {
      const id = await createManualOrder(
        { ...form, name: form.name.trim(), phone, kind, status },
        lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, unit_price_cents: l.unitCents })),
      )
      toast(kind === 'order' ? 'Pedido criado.' : 'Orçamento criado.')
      navigate(`/admin/pedidos/${id}`, { replace: true })
    } catch (err) {
      setError(friendlyError(err))
      setSaving(false)
    }
  }

  const field = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }),
  })

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link to="/admin/pedidos" className="inline-flex min-h-11 items-center gap-1 text-sm text-body hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden="true" /> Pedidos
        </Link>
        <h1 className="text-2xl font-semibold text-ink">Novo pedido</h1>
      </div>

      {/* Fora do formulário: Enter no preço ou na busca não envia o pedido */}
      <section className="card p-5">
        <h2 className="mb-1 text-base font-medium text-ink">Itens</h2>
        <p className="mb-3 text-xs text-body">O preço vem do cadastro e pode ser alterado aqui. Sem preço, o item fica a cotar.</p>
        {lines.length > 0 && (
          <ul className="divide-y divide-hairline text-sm">
            {lines.map((l) => (
              <li key={l.productId} className="grid gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{l.name}</p>
                  <p className="text-xs text-body">
                    {l.sku && `Ref. ${l.sku} · `}
                    {l.unitCents != null ? `Total da linha ${formatBRL(l.unitCents * l.quantity)}` : 'Sem preço — a cotar'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-10 items-center rounded-full bg-surface-strong">
                    <button
                      type="button"
                      className="flex size-10 items-center justify-center rounded-full hover:bg-hairline disabled:opacity-40"
                      disabled={l.quantity <= 1}
                      onClick={() => patchLine(l.productId, { quantity: l.quantity - 1 })}
                      aria-label={`Diminuir ${l.name}`}
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="tabular w-7 text-center font-medium text-ink">{l.quantity}</span>
                    <button
                      type="button"
                      className="flex size-10 items-center justify-center rounded-full hover:bg-hairline disabled:opacity-40"
                      disabled={l.quantity >= MAX_QTY}
                      onClick={() => patchLine(l.productId, { quantity: l.quantity + 1 })}
                      aria-label={`Aumentar ${l.name}`}
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <PriceCell
                    allowEmpty
                    cents={l.unitCents}
                    label={`Preço unitário de ${l.name}`}
                    onSave={async (value) => {
                      patchLine(l.productId, { unitCents: value })
                      return true
                    }}
                  />
                  <button
                    type="button"
                    className="flex size-10 items-center justify-center rounded-full text-body hover:bg-surface-soft hover:text-[#a51a26]"
                    onClick={() => setLines((list) => list.filter((x) => x.productId !== l.productId))}
                    aria-label={`Remover ${l.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <ProductPicker onAdd={addProduct} />
        {lines.length > 0 && (
          <p className="mt-4 flex items-baseline justify-between gap-3 border-t border-hairline pt-4 text-sm text-ink">
            <span>{hasUnpriced ? 'Subtotal (itens com preço)' : 'Total'}</span>
            <span className="tabular text-base font-semibold">{total > 0 ? formatBRL(total) : '—'}</span>
          </p>
        )}
      </section>

      <form onSubmit={submit} className="card space-y-4 p-5">
        <h2 className="text-base font-medium text-ink">Cliente e pedido</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Nome *</span>
            <input className="input" maxLength={120} required {...field('name')} />
          </label>
          <label className="block">
            <span className="label">Telefone / WhatsApp com DDD *</span>
            <input className="input" inputMode="tel" required placeholder="(11) 99999-9999" {...field('phone')} />
          </label>
          <label className="block">
            <span className="label">E-mail</span>
            <input className="input" type="email" maxLength={120} {...field('email')} />
          </label>
          <label className="block">
            <span className="label">Cidade</span>
            <input className="input" maxLength={120} {...field('city')} />
          </label>
          <label className="block">
            <span className="label">Tipo</span>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as OrderKind)}>
              <option value="order">Pedido</option>
              <option value="quote">Orçamento</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Status</span>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
              {Object.entries(ORDER_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="label">Observações</span>
          <textarea className="input min-h-20 py-2" maxLength={1000} {...field('notes')} />
        </label>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : kind === 'order' ? 'Criar pedido' : 'Criar orçamento'}
        </button>
      </form>
    </div>
  )
}
