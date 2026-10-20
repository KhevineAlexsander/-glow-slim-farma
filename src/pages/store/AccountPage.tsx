import { LayoutDashboard, LogOut, ShieldAlert } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { Badge, EmptyState, ErrorBox, PageLoader, Spinner } from '../../components/ui/misc'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../contexts/AuthContext'
import { formatBRL } from '../../lib/money'
import { formatDateTime, ORDER_STATUS } from '../../lib/orderStatus'
import { onlyDigits } from '../../lib/whatsapp'
import { fetchMyOrders, type MyOrder } from '../../services/account'

export default function AccountPage() {
  const { session, profile, isAdmin, loading, updateProfile, signOut } = useAuth()
  const toast = useToast()
  const [orders, setOrders] = useState<MyOrder[] | null>(null)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const userId = session?.user.id

  useEffect(() => {
    setForm({ name: profile?.full_name ?? '', phone: profile?.phone ?? '' })
  }, [profile])

  useEffect(() => {
    if (!userId) return
    fetchMyOrders(userId)
      .then(setOrders)
      .catch(() => setOrdersError('Não foi possível carregar seus pedidos.'))
  }, [userId])

  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/entrar?voltar=/minha-conta" replace />

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (form.name.trim().length < 2) return setFormError('Informe seu nome.')
    const phone = onlyDigits(form.phone)
    if (phone && (phone.length < 10 || phone.length > 15)) return setFormError('WhatsApp inválido. Use DDD + número.')
    setSaving(true)
    const err = await updateProfile({ full_name: form.name.trim(), phone: phone || null })
    setSaving(false)
    if (err) setFormError(err)
    else toast('Dados salvos.')
  }

  return (
    <div className="mx-auto max-w-5xl px-(--margin) py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">
          Olá{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!
        </h1>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Link to="/admin" className="btn-outline">
              <LayoutDashboard className="size-4" /> Abrir painel
            </Link>
          )}
          <button className="btn-ghost" onClick={() => void signOut()}>
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-3 font-medium text-ink">Meus pedidos e orçamentos</h2>
          {ordersError ? (
            <ErrorBox message={ordersError} />
          ) : orders === null ? (
            <div className="flex justify-center py-8"><Spinner className="size-7" /></div>
          ) : orders.length === 0 ? (
            <EmptyState title="Você ainda não fez pedidos com esta conta.">
              <Link to="/produtos" className="font-medium text-ink underline">Ver produtos</Link>
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <article key={o.id} className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-ink">
                      {o.kind === 'order' ? 'Pedido' : 'Orçamento'} #{o.order_number}
                    </p>
                    <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                  </div>
                  <p className="text-xs text-muted">{formatDateTime(o.created_at)}</p>
                  <ul className="mt-2 space-y-0.5 text-sm text-ink">
                    {o.order_items.map((i, idx) => (
                      <li key={idx} className="flex justify-between gap-3">
                        <span className="min-w-0">{i.quantity}x {i.product_name}</span>
                        <span className="tabular shrink-0 text-muted">
                          {i.unit_price_cents != null ? formatBRL(i.unit_price_cents * i.quantity) : 'a consultar'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {o.requires_document_review && (
                    <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber-800">
                      <ShieldAlert className="size-3.5" /> Contém itens que exigem prescrição/avaliação.
                    </p>
                  )}
                  {o.total_cents > 0 && (
                    <p className="mt-2 text-right tabular text-sm font-semibold text-ink">
                      {o.has_unpriced_items ? 'Subtotal' : 'Total'}: {formatBRL(o.total_cents)}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <form onSubmit={save} className="card h-fit space-y-4 p-5">
          <h2 className="font-medium text-ink">Meus dados</h2>
          <div>
            <span className="label">E-mail</span>
            <p className="text-sm break-all text-muted">{session.user.email}</p>
          </div>
          <div>
            <label className="label" htmlFor="acc-name">Nome</label>
            <input id="acc-name" className="input" maxLength={120} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="acc-phone">WhatsApp com DDD</label>
            <input id="acc-phone" className="input" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          {formError && <ErrorBox message={formError} />}
          <button className="btn-primary w-full" disabled={saving}>{saving ? 'Salvando…' : 'Salvar dados'}</button>
          <p className="text-xs text-muted">Seus dados são usados para preencher pedidos e para a loja falar com você.</p>
        </form>
      </div>
    </div>
  )
}
