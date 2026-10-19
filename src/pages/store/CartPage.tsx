import { AlertTriangle, CheckCircle2, MessageCircle, Minus, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ProductImage } from '../../components/store/ProductCard'
import { EmptyState, ErrorBox, PageLoader } from '../../components/ui/misc'
import { useCart } from '../../contexts/CartContext'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { formatBRL } from '../../lib/money'
import { effectivePriceCents, isRestricted, productDisplay } from '../../lib/pricing'
import { friendlyError } from '../../lib/supabase'
import { onlyDigits, orderMessage, whatsappLink } from '../../lib/whatsapp'
import { fetchProductsByIds, placeOrder } from '../../services/catalog'
import type { CatalogProduct, PlacedOrder } from '../../types'

export default function CartPage() {
  const s = useLoadedSettings()
  const { lines, setQuantity, remove, clear } = useCart()
  const [products, setProducts] = useState<Map<string, CatalogProduct> | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', notes: '' })
  const [consent, setConsent] = useState(false)
  const [rxAware, setRxAware] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placed, setPlaced] = useState<{ order: PlacedOrder; name: string } | null>(null)
  const isQuote = s.sales_mode === 'quote'
  const idsKey = lines.map((l) => l.productId).sort().join(',')

  useEffect(() => {
    if (placed) return
    fetchProductsByIds(idsKey ? idsKey.split(',') : [])
      .then((list) => setProducts(new Map(list.map((p) => [p.id, p]))))
      .catch(() => setProducts(new Map()))
  }, [idsKey, placed])

  const view = useMemo(() => {
    if (!products) return null
    return lines.map((l) => {
      const p = products.get(l.productId)
      const d = p ? productDisplay(p, s) : null
      const valid = Boolean(p && (d!.action === 'add_to_cart' || d!.action === 'add_to_quote'))
      const unit = p && !isRestricted(p) && effectivePriceCents(p) > 0 ? effectivePriceCents(p) : null
      return { line: l, product: p, valid, unit }
    })
  }, [lines, products, s])

  if (placed) {
    const { order, name } = placed
    const waText = orderMessage(s.store_name, order, name)
    return (
      <div className="mx-auto max-w-xl px-4 py-10 text-center">
        <CheckCircle2 className="mx-auto size-16 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
          {order.kind === 'order' ? 'Pedido registrado!' : 'Solicitação de orçamento registrada!'}
        </h1>
        <p className="mt-2 text-slate-600">
          Número: <strong className="text-brand-dark">#{order.order_number}</strong>
        </p>
        <p className="mt-4 text-sm text-slate-600">
          {order.kind === 'order'
            ? 'Seu pedido foi recebido e aguarda confirmação da loja. Nenhum pagamento foi realizado — a loja entrará em contato para combinar pagamento e entrega.'
            : 'Recebemos sua solicitação. A loja vai responder com os valores e a disponibilidade.'}
        </p>
        {order.requires_document_review && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Alguns itens exigem prescrição/avaliação. Tenha a receita ou documentação em mãos para enviar à loja.
          </p>
        )}
        {s.send_to_whatsapp && s.whatsapp_number && (
          <a
            href={whatsappLink(s.whatsapp_number, waText)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp mt-6 w-full"
          >
            <MessageCircle className="size-5" /> Enviar resumo pelo WhatsApp
          </a>
        )}
        <Link to="/produtos" className="btn-outline mt-3 w-full">
          Continuar navegando
        </Link>
      </div>
    )
  }

  if (!view) return <PageLoader />

  const validItems = view.filter((v) => v.valid)
  const invalidItems = view.filter((v) => !v.valid)
  const hasRestricted = validItems.some((v) => v.product && isRestricted(v.product))
  const hasUnpriced = validItems.some((v) => v.unit == null)
  const subtotal = validItems.reduce((sum, v) => sum + (v.unit ?? 0) * v.line.quantity, 0)

  if (!lines.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState title={isQuote ? 'Sua lista de orçamento está vazia.' : 'Seu carrinho está vazio.'}>
          <Link to="/produtos" className="font-semibold text-brand">
            Ver produtos
          </Link>
        </EmptyState>
      </div>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!validItems.length) return setError('Nenhum item válido no carrinho.')
    if (form.name.trim().length < 2) return setError('Informe seu nome.')
    const phone = onlyDigits(form.phone)
    if (phone.length < 10 || phone.length > 15) return setError('Informe um WhatsApp/telefone válido com DDD.')
    if (!consent) return setError('É preciso concordar com o uso dos seus dados para o atendimento.')
    if (hasRestricted && !rxAware) return setError('Confirme a ciência sobre a necessidade de prescrição.')

    setSubmitting(true)
    try {
      const order = await placeOrder(
        { name: form.name.trim(), phone, email: form.email.trim(), city: form.city.trim(), notes: form.notes.trim() },
        validItems.map((v) => ({ product_id: v.line.productId, quantity: v.line.quantity })),
      )
      setPlaced({ order, name: form.name.trim() })
      clear()
      window.scrollTo(0, 0)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-extrabold text-brand-dark">{isQuote ? 'Solicitar orçamento' : 'Carrinho'}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {invalidItems.length > 0 && (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div>
                Alguns itens não podem mais ser incluídos (indisponíveis, sem preço ou com venda restrita) e não serão
                enviados.
                <button
                  className="ml-1 font-semibold underline"
                  onClick={() => invalidItems.forEach((v) => remove(v.line.productId))}
                >
                  Remover
                </button>
              </div>
            </div>
          )}

          {view.map(({ line, product, valid, unit }) => (
            <div key={line.productId} className={`card flex gap-3 p-3 ${valid ? '' : 'opacity-60'}`}>
              {product ? (
                <Link to={`/produto/${product.slug}`} className="shrink-0">
                  <ProductImage product={product} className="size-20 rounded-xl" />
                </Link>
              ) : (
                <div className="size-20 shrink-0 rounded-xl bg-slate-100" />
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-bold text-slate-800">
                    {product?.name ?? 'Produto indisponível'}
                  </p>
                  <button
                    onClick={() => remove(line.productId)}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remover item"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {product && isRestricted(product) && (
                  <p className="flex items-center gap-1 text-xs font-semibold text-amber-700">
                    <ShieldAlert className="size-3.5" /> Exige prescrição/avaliação
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  {valid ? (
                    <div className="flex h-9 items-center rounded-full border border-slate-200">
                      <button
                        className="flex size-9 items-center justify-center"
                        onClick={() =>
                          line.quantity <= 1 ? remove(line.productId) : setQuantity(line.productId, line.quantity - 1)
                        }
                        aria-label="Diminuir"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{line.quantity}</span>
                      <button
                        className="flex size-9 items-center justify-center"
                        onClick={() => setQuantity(line.productId, line.quantity + 1)}
                        aria-label="Aumentar"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">Não será enviado</span>
                  )}
                  <p className="text-right text-sm font-bold text-brand-dark">
                    {unit != null ? formatBRL(unit * line.quantity) : <span className="text-xs text-brand">A consultar</span>}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="card h-fit space-y-4 p-5 lg:sticky lg:top-28">
          <div className="rounded-xl bg-brand-light/60 p-3 text-sm">
            <div className="flex justify-between font-semibold text-slate-700">
              <span>{hasUnpriced ? 'Subtotal (itens com preço)' : 'Total estimado'}</span>
              <span>{subtotal > 0 ? formatBRL(subtotal) : '—'}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {isQuote
                ? 'Os valores finais serão confirmados pela loja na resposta ao orçamento.'
                : 'O valor é recalculado e confirmado pela loja. Frete e pagamento são combinados no atendimento.'}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="name">Nome *</label>
            <input id="name" className="input" required maxLength={120} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="phone">WhatsApp / telefone com DDD *</label>
            <input id="phone" className="input" required inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" type="email" className="input" maxLength={120} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="city">Cidade</label>
            <input id="city" className="input" maxLength={120} autoComplete="address-level2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="notes">Observações</label>
            <textarea id="notes" className="input min-h-20 py-2" maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <label className="flex min-h-11 items-center gap-3 py-1 text-xs text-slate-600">
            <input type="checkbox" className="size-5 shrink-0 accent-[var(--brand)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            Concordo que meus dados sejam usados somente para o atendimento desta solicitação.
          </label>
          {hasRestricted && (
            <label className="flex min-h-11 items-center gap-3 py-1 text-xs text-amber-900">
              <input type="checkbox" className="size-5 shrink-0 accent-[var(--brand)]" checked={rxAware} onChange={(e) => setRxAware(e.target.checked)} />
              Estou ciente de que itens com prescrição/venda restrita só serão fornecidos após apresentação de receita ou
              documentação e avaliação do responsável técnico.
            </label>
          )}

          {error && <ErrorBox message={error} />}
          <button type="submit" className="btn-primary w-full" disabled={submitting || !validItems.length}>
            {submitting ? 'Enviando…' : isQuote ? 'Enviar solicitação de orçamento' : 'Enviar pedido'}
          </button>
        </form>
      </div>
    </div>
  )
}
