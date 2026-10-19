import { Archive, ChevronLeft, ExternalLink, ShieldAlert, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ProductImages } from '../../components/admin/ProductImages'
import { ErrorBox, PageLoader, Toggle } from '../../components/ui/misc'
import { useToast } from '../../components/ui/Toast'
import { centsToInput, MAX_PRICE_CENTS, parseBRLToCents } from '../../lib/money'
import { slugify } from '../../lib/slug'
import { friendlyError } from '../../lib/supabase'
import {
  createProduct,
  deleteProduct,
  getProduct,
  listAllCategories,
  updateProduct,
  type ProductInput,
} from '../../services/admin'
import type { Category, ProductStatus } from '../../types'

type FormState = Omit<ProductInput, 'price_cents' | 'promo_price_cents'> & { price: string; promo: string }

const EMPTY: FormState = {
  name: '',
  slug: '',
  sku: null,
  brand: null,
  category_id: null,
  short_description: null,
  description: null,
  composition: null,
  presentation: null,
  usage_route: null,
  price: '',
  promo: '',
  track_stock: false,
  stock_quantity: 0,
  is_available: true,
  is_featured: false,
  is_bestseller: false,
  is_offer: false,
  status: 'draft',
  sort_order: 0,
  requires_prescription: false,
  restricted_sale: false,
  compliance_reviewed: false,
  compliance_notes: null,
  needs_review: false,
  review_notes: null,
  source_catalog: null,
  source_page: null,
}

function Section({ title, children, description }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="font-bold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

export default function ProductFormPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState<FormState | null>(isNew ? EMPTY : null)
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listAllCategories().then(setCategories).catch(() => {})
    if (id) {
      getProduct(id)
        .then((p) => {
          const { price_cents, promo_price_cents, id: _id, created_at: _c, updated_at: _u, ...rest } = p
          setForm({
            ...rest,
            price: price_cents > 0 ? centsToInput(price_cents) : '',
            promo: promo_price_cents ? centsToInput(promo_price_cents) : '',
          })
        })
        .catch((e) => setError(friendlyError(e)))
    }
  }, [id])

  if (error && !form) return <ErrorBox message={error} />
  if (!form) return <PageLoader />

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => f && { ...f, [key]: value })
  const text = (key: keyof FormState) => ({
    value: (form[key] as string | null) ?? '',
    onChange: (e: { target: { value: string } }) => set(key, (e.target.value || null) as never),
  })
  const restricted = form.requires_prescription || form.restricted_sale

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const name = form.name.trim()
    if (name.length < 2) return setError('Informe o nome do produto.')
    const slug = slugify(form.slug || name)
    if (!slug) return setError('Slug inválido.')

    const price = form.price.trim() ? parseBRLToCents(form.price) : 0
    const promo = form.promo.trim() ? parseBRLToCents(form.promo) : null
    if (price == null || price > MAX_PRICE_CENTS) return setError('Preço inválido. Use o formato 123,45.')
    if (form.promo.trim() && (promo == null || promo <= 0)) return setError('Preço promocional inválido.')
    if (promo != null && promo >= price) return setError('O preço promocional precisa ser menor que o preço normal.')
    if (form.status === 'published' && restricted && !form.compliance_reviewed) {
      return setError('Produtos com prescrição ou venda restrita só podem ser publicados após a revisão do responsável técnico.')
    }

    const { price: _p, promo: _pr, ...fields } = form
    const payload: Partial<ProductInput> = {
      ...fields,
      name,
      slug,
      sku: form.sku?.trim() || null,
      stock_quantity: Math.max(0, Math.trunc(Number(form.stock_quantity) || 0)),
      sort_order: Math.trunc(Number(form.sort_order) || 0),
    }

    setSaving(true)
    try {
      if (isNew) {
        // O banco cria todo produto com preço zero; o preço informado é aplicado em seguida.
        const created = await createProduct(payload)
        if (price > 0) await updateProduct(created.id, { price_cents: price, promo_price_cents: promo })
        toast('Produto criado. Agora você pode adicionar imagens.')
        navigate(`/admin/produtos/${created.id}`, { replace: true })
      } else {
        await updateProduct(id!, { ...payload, price_cents: price, promo_price_cents: promo })
        toast('Produto salvo.')
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const archive = async () => {
    if (!id || !confirm('Arquivar este produto? Ele deixa de aparecer na loja, mas o histórico de pedidos é mantido.')) return
    try {
      await updateProduct(id, { status: 'archived' })
      set('status', 'archived')
      toast('Produto arquivado.')
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  const remove = async () => {
    if (!id || !confirm('Excluir definitivamente este produto e suas imagens? Esta ação não pode ser desfeita.')) return
    try {
      await deleteProduct(id)
      toast('Produto excluído.')
      navigate('/admin/produtos', { replace: true })
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/admin/produtos" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand">
          <ChevronLeft className="size-4" /> Produtos
        </Link>
        {!isNew && form.status === 'published' && (
          <Link to={`/produto/${form.slug}`} target="_blank" className="inline-flex min-h-11 items-center gap-1 text-sm text-slate-500 hover:text-brand">
            Ver na loja <ExternalLink className="size-4" />
          </Link>
        )}
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900">{isNew ? 'Novo produto' : form.name || 'Editar produto'}</h1>

      {form.needs_review && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Este produto foi marcado para revisão.</strong>
          {form.review_notes && <p className="mt-1 whitespace-pre-line">{form.review_notes}</p>}
        </div>
      )}

      <Section title="Publicação">
        <div>
          <label className="label" htmlFor="status">Situação na loja</label>
          <select id="status" className="input" value={form.status} onChange={(e) => set('status', e.target.value as ProductStatus)}>
            <option value="draft">Oculto (não aparece na loja)</option>
            <option value="published">Publicado (visível na loja)</option>
            <option value="archived">Arquivado</option>
          </select>
        </div>
      </Section>

      <Section title="Informações do produto">
        <div>
          <label className="label" htmlFor="name">Nome *</label>
          <input
            id="name"
            className="input"
            required
            maxLength={200}
            value={form.name}
            onChange={(e) => {
              set('name', e.target.value)
              if (!slugTouched) set('slug', slugify(e.target.value))
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sku">Código / referência</label>
            <input id="sku" className="input" maxLength={60} {...text('sku')} />
          </div>
          <div>
            <label className="label" htmlFor="brand">Marca / laboratório</label>
            <input id="brand" className="input" maxLength={120} {...text('brand')} />
          </div>
          <div>
            <label className="label" htmlFor="category">Categoria</label>
            <select id="category" className="input" value={form.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)}>
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="slug">Endereço na loja (slug)</label>
            <input
              id="slug"
              className="input"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true)
                set('slug', e.target.value.toLowerCase())
              }}
              onBlur={() => set('slug', slugify(form.slug || form.name))}
            />
          </div>
          <div>
            <label className="label" htmlFor="presentation">Apresentação</label>
            <input id="presentation" className="input" maxLength={120} placeholder="Ex.: Frasco 10 ml" {...text('presentation')} />
          </div>
          <div>
            <label className="label" htmlFor="route">Via de aplicação / uso</label>
            <input id="route" className="input" maxLength={60} placeholder="Ex.: Oral, IM, SC, tópico" {...text('usage_route')} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="short">Descrição resumida (aparece no card)</label>
          <input id="short" className="input" maxLength={300} {...text('short_description')} />
        </div>
        <div>
          <label className="label" htmlFor="description">Descrição completa</label>
          <textarea id="description" className="input min-h-28 py-2" maxLength={10000} {...text('description')} />
        </div>
        <div>
          <label className="label" htmlFor="composition">Composição</label>
          <textarea id="composition" className="input min-h-20 py-2" maxLength={5000} {...text('composition')} />
        </div>
      </Section>

      <Section title="Preço" description="Deixe vazio para exibir “Preço sob consulta” na loja. Produtos sem preço não entram no checkout.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="price">Preço (R$)</label>
            <input id="price" className="input" inputMode="decimal" placeholder="0,00" value={form.price} onChange={(e) => set('price', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="promo">Preço promocional (R$)</label>
            <input id="promo" className="input" inputMode="decimal" placeholder="Opcional" value={form.promo} onChange={(e) => set('promo', e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Disponibilidade e estoque">
        <Toggle checked={form.is_available} onChange={(v) => set('is_available', v)} label="Disponível para venda/orçamento" />
        <Toggle checked={form.track_stock} onChange={(v) => set('track_stock', v)} label="Controlar estoque" description="Com estoque zerado, o produto aparece como indisponível." />
        {form.track_stock && (
          <div className="max-w-40">
            <label className="label" htmlFor="stock">Quantidade em estoque</label>
            <input id="stock" type="number" min={0} className="input" value={form.stock_quantity} onChange={(e) => set('stock_quantity', Number(e.target.value))} />
          </div>
        )}
      </Section>

      <Section title="Vitrine">
        <Toggle checked={form.is_featured} onChange={(v) => set('is_featured', v)} label="Destaque" description="Aparece na seção de destaques da página inicial." />
        <Toggle checked={form.is_bestseller} onChange={(v) => set('is_bestseller', v)} label="Mais vendido" />
        <Toggle checked={form.is_offer} onChange={(v) => set('is_offer', v)} label="Oferta especial" />
        <div className="max-w-40">
          <label className="label" htmlFor="order">Ordem de exibição</label>
          <input id="order" type="number" className="input" value={form.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} />
        </div>
      </Section>

      <Section
        title="Controle sanitário"
        description="Produtos com prescrição ou venda restrita nunca entram no checkout normal, não exibem preço na loja e só podem ser publicados após revisão do responsável técnico."
      >
        <Toggle checked={form.requires_prescription} onChange={(v) => set('requires_prescription', v)} label="Exige prescrição (receita)" />
        <Toggle checked={form.restricted_sale} onChange={(v) => set('restricted_sale', v)} label="Venda restrita / uso profissional" />
        {restricted && (
          <>
            <Toggle
              checked={form.compliance_reviewed}
              onChange={(v) => set('compliance_reviewed', v)}
              label="Revisado pelo responsável técnico"
              description="Confirme somente após verificar regularização (ANVISA) e condições de venda deste produto."
            />
            <div>
              <label className="label" htmlFor="compliance">Notas da revisão (internas)</label>
              <textarea id="compliance" className="input min-h-20 py-2" maxLength={2000} placeholder="Registro ANVISA, responsável, data da revisão…" {...text('compliance_notes')} />
            </div>
            {!form.compliance_reviewed && (
              <p className="flex items-center gap-1 text-xs font-semibold text-red-600">
                <ShieldAlert className="size-4" /> Não pode ser publicado até a revisão.
              </p>
            )}
          </>
        )}
      </Section>

      <Section title="Revisão de dados (interno)">
        <Toggle checked={form.needs_review} onChange={(v) => set('needs_review', v)} label="Precisa de revisão" description="Use para produtos importados com dados incompletos ou duvidosos." />
        <div>
          <label className="label" htmlFor="review">Observações</label>
          <textarea id="review" className="input min-h-20 py-2" maxLength={5000} {...text('review_notes')} />
        </div>
        {(form.source_catalog || form.source_page) && (
          <p className="text-xs text-slate-500">
            Origem: {form.source_catalog}
            {form.source_page ? `, página ${form.source_page}` : ''}
          </p>
        )}
      </Section>

      {!isNew && (
        <Section title="Imagens">
          <ProductImages productId={id!} />
        </Section>
      )}

      {!isNew && (
        <div className="flex flex-wrap gap-2">
          {form.status !== 'archived' && (
            <button type="button" className="btn-outline" onClick={() => void archive()}>
              <Archive className="size-4" /> Arquivar
            </button>
          )}
          <button type="button" className="btn-ghost text-red-600" onClick={() => void remove()}>
            <Trash2 className="size-4" /> Excluir
          </button>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white/95 p-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          {error && <p className="flex-1 text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary ml-auto min-w-40" disabled={saving}>
            {saving ? 'Salvando…' : isNew ? 'Criar produto' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </form>
  )
}
