import { AlertTriangle, CheckCircle2, MessageCircle, Minus, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ProductImage } from '../../components/store/ProductCard'
import { groupColors } from '../../components/store/VialArt'
import { ErrorBox, PageLoader } from '../../components/ui/misc'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { useCategories } from '../../contexts/CategoriesContext'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { buildCategoryTree } from '../../lib/categoryTree'
import { formatBRL } from '../../lib/money'
import { effectivePriceCents, isRestricted, priceHidden, productDisplay } from '../../lib/pricing'
import { friendlyError } from '../../lib/supabase'
import { onlyDigits, orderMessage, whatsappLink } from '../../lib/whatsapp'
import { fetchProductsByIds, placeOrder } from '../../services/catalog'
import type { CatalogProduct, PlacedOrder } from '../../types'

export default function CartPage() {
  const s = useLoadedSettings()
  const categories = useCategories()
  const { lines, setQuantity, remove, clear } = useCart()
  const { session, profile } = useAuth()
  const [products, setProducts] = useState<Map<string, CatalogProduct> | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', notes: '' })

  // Cliente logado: preenche com os dados da conta (sem apagar o que já foi digitado).
  useEffect(() => {
    if (!session) return
    setForm((f) => ({
      ...f,
      name: f.name || profile?.full_name || '',
      phone: f.phone || profile?.phone || '',
      email: f.email || session.user.email || '',
    }))
  }, [session, profile])
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placed, setPlaced] = useState<{ order: PlacedOrder; name: string } | null>(null)
  const isQuote = s.sales_mode === 'quote'
  const title = isQuote ? 'Solicitar orçamento' : 'Carrinho'
  const finishOnWhatsApp = s.send_to_whatsapp && Boolean(s.whatsapp_number)
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
      const unit = p && !priceHidden(p, s) && effectivePriceCents(p) > 0 ? effectivePriceCents(p) : null
      return { line: l, product: p, valid, unit }
    })
  }, [lines, products, s])

  if (placed) {
    const { order, name } = placed
    const waText = orderMessage(s.store_name, order, name)
    return (
      <div className="mx-auto max-w-2xl px-(--gutter) py-12">
        <CheckCircle2 className="size-10 text-[#247b50]" aria-hidden="true" />
        <h1 className="display-md mt-4 text-ink">
          {order.kind === 'order' ? 'Pedido registrado' : 'Solicitação de orçamento registrada'}
        </h1>
        <p className="mt-1 text-muted">
          Número <strong className="tabular font-semibold text-ink">#{order.order_number}</strong>
        </p>
        {finishOnWhatsApp && (
          <p className="mt-6 bg-[#dcfae5] p-4 text-sm text-[#04250e]">
            Abrimos o WhatsApp da loja com o resumo do seu pedido. <strong>Envie a mensagem</strong> para finalizar o
            atendimento.
          </p>
        )}
        <p className="mt-4 text-sm text-muted">
          {order.kind === 'order'
            ? 'Seu pedido foi recebido e aguarda confirmação da loja. Nenhum pagamento foi realizado — a loja entrará em contato para combinar pagamento e entrega.'
            : 'Recebemos sua solicitação. A loja vai responder com os valores e a disponibilidade.'}
        </p>
        {order.requires_document_review && (
          <p className="mt-4 bg-[#fffbeb] p-4 text-sm text-[#92400e]">
            Alguns itens exigem prescrição/avaliação. Tenha a receita ou documentação em mãos para enviar à loja.
          </p>
        )}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {s.send_to_whatsapp && s.whatsapp_number && (
            <a
              href={whatsappLink(s.whatsapp_number, waText)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp sm:col-span-2"
            >
              <MessageCircle className="size-5" aria-hidden="true" /> Abrir o WhatsApp novamente
            </a>
          )}
          {session && (
            <Link to="/minha-conta" className="btn-outline">
              Acompanhar em Minha conta
            </Link>
          )}
          <Link to="/produtos" className={`btn-outline ${session ? '' : 'sm:col-span-2'}`}>
            Continuar navegando
          </Link>
        </div>
      </div>
    )
  }

  if (!view) return <PageLoader />

  const validItems = view.filter((v) => v.valid)
  const invalidItems = view.filter((v) => !v.valid)
  const hasUnpriced = validItems.some((v) => v.unit == null)
  const subtotal = validItems.reduce((sum, v) => sum + (v.unit ?? 0) * v.line.quantity, 0)
  // Pedido mínimo só vale para compras (o banco confere de novo ao gravar)
  const minOrder = isQuote ? 0 : (s.min_order_cents ?? 0)
  const missing = Math.max(0, minOrder - subtotal)
  const itemCount = validItems.reduce((n, v) => n + v.line.quantity, 0)

  if (!lines.length) {
    // Vazio: mantém o título e oferece os grupos como próximo passo
    const groups = buildCategoryTree(categories)
    return (
      <div className="wrap py-10 lg:py-14">
        <h1 className="display-md text-ink">{title}</h1>
        <p className="mt-1 text-sm text-muted">
          {isQuote ? 'Sua lista de orçamento está vazia.' : 'Seu carrinho está vazio.'}
        </p>
        {groups.length > 0 && (
          <nav className="mt-8" aria-label="Grupos de produtos">
            <h2 className="text-base font-medium text-ink">Comece por um grupo</h2>
            <ul className="mt-3 grid border-t border-hairline sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
              {groups.map(({ group }, index) => (
                <li key={group.id} className="border-b border-hairline">
                  <Link
                    to={`/produtos?categoria=${group.slug}`}
                    className="flex min-h-14 items-center gap-3 text-ink hover:underline"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: groupColors(index)[0] }}
                      aria-hidden="true"
                    />
                    {group.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <Link to="/produtos" className="btn-primary mt-8">
          Ver produtos
        </Link>
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
    if (missing > 0) return setError(`O pedido mínimo é de ${formatBRL(minOrder)}.`)

    // Finalização pelo WhatsApp: a aba é aberta já no toque do botão (senão o navegador
    // bloqueia o pop-up depois da espera) e recebe o link quando o pedido é registrado.
    const waTab = finishOnWhatsApp ? window.open('', '_blank') : null

    setSubmitting(true)
    try {
      const order = await placeOrder(
        { name: form.name.trim(), phone, email: form.email.trim(), city: form.city.trim(), notes: form.notes.trim() },
        validItems.map((v) => ({ product_id: v.line.productId, quantity: v.line.quantity })),
      )
      if (finishOnWhatsApp && s.whatsapp_number) {
        const link = whatsappLink(s.whatsapp_number, orderMessage(s.store_name, order, form.name.trim()))
        if (waTab) waTab.location.href = link
      }
      setPlaced({ order, name: form.name.trim() })
      clear()
      window.scrollTo(0, 0)
    } catch (err) {
      waTab?.close()
      setError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="wrap py-10 lg:py-14">
      <h1 className="display-md text-ink">{title}</h1>
      <p className="mt-1 text-sm text-muted">
        {itemCount} {itemCount === 1 ? 'item' : 'itens'}
      </p>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_400px]">
        <div>
          {invalidItems.length > 0 && (
            <div className="mb-4 flex gap-2 bg-[#fffbeb] p-3 text-sm text-[#92400e]">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
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

          {/* Itens: linhas finas, valor de cada linha alinhado à direita */}
          <ul className="border-t border-hairline">
            {view.map(({ line, product, valid, unit }) => (
              <li key={line.productId} className="flex gap-4 border-b border-hairline py-4">
                {product ? (
                  <Link to={`/produto/${product.slug}`} className="shrink-0" tabIndex={-1} aria-hidden="true">
                    <ProductImage product={product} className="size-20 sm:size-24" />
                  </Link>
                ) : (
                  <div className="size-20 shrink-0 bg-slate-100 sm:size-24" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {product ? (
                        <Link
                          to={`/produto/${product.slug}`}
                          className="line-clamp-2 text-sm font-medium text-ink hover:underline"
                        >
                          {product.name}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-muted">Produto indisponível</p>
                      )}
                      {product && isRestricted(product) && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-800">
                          <ShieldAlert className="size-3.5" aria-hidden="true" /> Exige receita
                        </p>
                      )}
                    </div>
                    <p className="tabular shrink-0 text-right text-sm font-semibold text-ink">
                      {unit != null ? (
                        formatBRL(unit * line.quantity)
                      ) : (
                        <span className="font-normal text-muted">A consultar</span>
                      )}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    {valid ? (
                      <div className="flex h-11 items-center rounded-full bg-surface-strong">
                        <button
                          className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-hairline"
                          onClick={() =>
                            line.quantity <= 1 ? remove(line.productId) : setQuantity(line.productId, line.quantity - 1)
                          }
                          aria-label="Diminuir"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="tabular w-8 text-center text-sm font-medium text-ink">{line.quantity}</span>
                        <button
                          className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-hairline"
                          onClick={() => setQuantity(line.productId, line.quantity + 1)}
                          aria-label="Aumentar"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">Não será enviado</span>
                    )}
                    <button
                      onClick={() => remove(line.productId)}
                      className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-muted hover:text-red-700"
                      aria-label={`Remover ${product?.name ?? 'item'}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" /> Remover
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6 lg:sticky lg:top-24">
          <div className="border-b border-hairline pb-4">
            <div className="flex items-baseline justify-between gap-3 text-sm text-ink">
              <span>{hasUnpriced ? 'Subtotal (itens com preço)' : 'Total estimado'}</span>
              <span className="tabular text-base font-semibold">
                {subtotal > 0 ? formatBRL(subtotal) : <span className="text-muted">—</span>}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {isQuote
                ? 'Os valores finais serão confirmados pela loja na resposta ao orçamento.'
                : 'O valor é recalculado e confirmado pela loja. Frete e pagamento são combinados no atendimento.'}
            </p>
            {minOrder > 0 && (
              <div className="mt-3">
                <div className="flex items-baseline justify-between gap-3 text-xs text-body">
                  <span>Pedido mínimo {formatBRL(minOrder)}</span>
                  <span className={`tabular font-semibold ${missing > 0 ? 'text-ink' : 'text-[#247b50]'}`}>
                    {missing > 0 ? `Faltam ${formatBRL(missing)}` : 'Mínimo atingido'}
                  </span>
                </div>
                {/* barra na proporção real do mínimo */}
                <div className="mt-1.5 h-1.5 rounded-full bg-surface-strong" aria-hidden="true">
                  <div
                    className={`h-1.5 rounded-full ${missing > 0 ? 'bg-brand-dark' : 'bg-[#247b50]'}`}
                    style={{ width: `${Math.min(100, (subtotal / minOrder) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <h2 className="text-base font-medium text-ink">Seus dados</h2>
          <div>
            <label className="label" htmlFor="name">Nome *</label>
            <input id="name" className="input bg-white" required maxLength={120} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="phone">WhatsApp / telefone com DDD *</label>
            <input id="phone" className="input bg-white" required inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" type="email" className="input bg-white" maxLength={120} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="city">Cidade</label>
            <input id="city" className="input bg-white" maxLength={120} autoComplete="address-level2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="notes">Observações</label>
            <textarea id="notes" className="input min-h-20 bg-white py-2" maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <label className="flex min-h-11 items-center gap-3 py-1 text-xs text-muted">
            <input type="checkbox" className="size-5 shrink-0 accent-[var(--ink)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            Concordo que meus dados sejam usados somente para o atendimento desta solicitação.
          </label>

          {error && <ErrorBox message={error} />}
          {session ? (
            <p className="text-xs text-muted">Este pedido ficará salvo em Minha conta.</p>
          ) : (
            <p className="text-xs text-muted">
              Tem conta?{' '}
              <Link to="/entrar?voltar=/carrinho" className="font-medium text-ink underline">
                Entre para acompanhar seus pedidos
              </Link>{' '}
              (opcional).
            </p>
          )}
          <button
            type="submit"
            className={finishOnWhatsApp ? 'btn-whatsapp w-full' : 'btn-primary w-full'}
            disabled={submitting || !validItems.length || missing > 0}
          >
            {finishOnWhatsApp && !submitting && <MessageCircle className="size-5" aria-hidden="true" />}
            {submitting
              ? 'Enviando…'
              : finishOnWhatsApp
                ? 'Finalizar pelo WhatsApp'
                : isQuote
                  ? 'Enviar solicitação de orçamento'
                  : 'Enviar pedido'}
          </button>
        </form>
      </div>
    </div>
  )
}
