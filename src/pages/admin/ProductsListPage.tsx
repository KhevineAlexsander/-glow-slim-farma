import { Plus, Search, ShieldAlert } from 'lucide-react'
import { CategoryOptions } from '../../components/admin/CategoryOptions'
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AdminPageHeader } from '../../components/admin/AdminLayout'
import { PriceCell } from '../../components/admin/PriceCell'
import { VialArt, categoryColors, vialKind } from '../../components/store/VialArt'
import { Badge, EmptyState, ErrorBox, Pagination, Spinner } from '../../components/ui/misc'
import { useToast } from '../../components/ui/Toast'
import { friendlyError } from '../../lib/supabase'
import { listAllCategories, listProducts, updateProduct, type ProductRow } from '../../services/admin'
import type { Category, ProductStatus } from '../../types'

const PAGE_SIZE = 25

export const STATUS_LABEL: Record<ProductStatus, { label: string; tone: 'green' | 'slate' | 'amber' }> = {
  published: { label: 'Publicado', tone: 'green' },
  draft: { label: 'Oculto', tone: 'slate' },
  archived: { label: 'Arquivado', tone: 'amber' },
}

export default function ProductsListPage() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('p') ?? '1') || 1
  const status = (params.get('status') ?? 'active') as ProductStatus | 'active' | ''
  const categoryId = params.get('categoria') ?? ''
  const noPrice = params.get('semPreco') === '1'
  const needsReview = params.get('revisar') === '1'
  const search = params.get('q') ?? ''

  const [searchText, setSearchText] = useState(search)
  const [categories, setCategories] = useState<Category[]>([])
  const [data, setData] = useState<{ rows: ProductRow[]; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'p') next.delete('p')
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  useEffect(() => {
    listAllCategories().then(setCategories).catch(() => {})
  }, [])

  // Busca com pequeno atraso enquanto digita
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchText !== search) setParam('q', searchText.trim())
    }, 350)
    return () => clearTimeout(t)
  }, [searchText, search, setParam])

  const load = useCallback(() => {
    const childIds = categories.filter((c) => c.parent_id === categoryId).map((c) => c.id)
    const categoryIds = childIds.length ? [categoryId, ...childIds] : undefined
    listProducts({ search, status, categoryId, categoryIds, noPrice, needsReview, page, pageSize: PAGE_SIZE })
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e) => setError(friendlyError(e)))
  }, [search, status, categoryId, noPrice, needsReview, page, categories])

  useEffect(() => {
    load()
  }, [load])

  const patchRow = (id: string, patch: Partial<ProductRow>) =>
    setData((d) => d && { ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  const savePrice = async (row: ProductRow, field: 'price_cents' | 'promo_price_cents', value: number | null) => {
    const patch: Partial<ProductRow> = { [field]: value }
    // Se o preço normal ficar menor/igual à promoção, a promoção é removida.
    if (field === 'price_cents' && row.promo_price_cents != null && (value ?? 0) <= row.promo_price_cents) {
      patch.promo_price_cents = null
    }
    if (field === 'promo_price_cents' && value != null && value >= row.price_cents) {
      toast('O preço promocional precisa ser menor que o preço normal.', 'error')
      return false
    }
    try {
      const updated = await updateProduct(row.id, patch)
      patchRow(row.id, updated)
      return true
    } catch (e) {
      toast(friendlyError(e), 'error')
      return false
    }
  }

  const toggleStatus = async (row: ProductRow) => {
    const next: ProductStatus = row.status === 'published' ? 'draft' : 'published'
    try {
      const updated = await updateProduct(row.id, { status: next })
      patchRow(row.id, updated)
      toast(next === 'published' ? 'Produto publicado.' : 'Produto ocultado.')
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name

  return (
    <div>
      <AdminPageHeader title="Produtos">
        <Link to="/admin/produtos/novo" className="btn-primary">
          <Plus className="size-4" /> Novo produto
        </Link>
      </AdminPageHeader>

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Nome, referência ou marca" value={searchText} onChange={(e) => setSearchText(e.target.value)} aria-label="Buscar produtos" />
        </div>
        <select className="input" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
          <option value="active">Ativos (sem arquivados)</option>
          <option value="published">Publicados</option>
          <option value="draft">Ocultos</option>
          <option value="archived">Arquivados</option>
          <option value="">Todos</option>
        </select>
        <select className="input" value={categoryId} onChange={(e) => setParam('categoria', e.target.value)} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          <option value="none">Sem categoria</option>
          <CategoryOptions categories={categories} />
        </select>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={noPrice} onChange={(e) => setParam('semPreco', e.target.checked ? '1' : '')} />
            Sem preço
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={needsReview} onChange={(e) => setParam('revisar', e.target.checked ? '1' : '')} />
            A revisar
          </label>
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        Dica: digite o preço direto na lista e pressione Enter. Deixe o preço vazio para “sob consulta”.
      </p>

      {error && <ErrorBox message={error} />}
      {!data && !error && <div className="flex justify-center py-10"><Spinner className="size-8" /></div>}
      {data && data.rows.length === 0 && (
        <EmptyState title="Nenhum produto encontrado.">
          <Link to="/admin/produtos/novo" className="font-semibold text-brand">Cadastrar produto</Link> ou{' '}
          <Link to="/admin/importar" className="font-semibold text-brand">importar planilha</Link>.
        </EmptyState>
      )}

      {data && data.rows.length > 0 && (
        <>
          <div className="space-y-2">
            {data.rows.map((row) => {
              const thumb = [...row.product_images].sort((a, b) => a.sort_order - b.sort_order)[0]
              const st = STATUS_LABEL[row.status]
              const restricted = row.requires_prescription || row.restricted_sale
              return (
                <div key={row.id} className="card flex flex-col gap-3 p-3 md:flex-row md:items-center">
                  <Link to={`/admin/produtos/${row.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                      {thumb ? (
                        <img src={thumb.url} alt="" className="size-full object-contain" />
                      ) : (
                        <VialArt
                          seed={row.slug}
                          color={categoryColors(categories.find((c) => c.id === row.category_id)?.slug, categories)}
                          kind={vialKind(`${row.presentation ?? ''} ${row.name}`)}
                          className="size-full"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800 hover:text-brand">{row.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {[row.sku && `Ref. ${row.sku}`, categoryName(row.category_id) ?? 'Sem categoria'].filter(Boolean).join(' · ')}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {row.needs_review && <Badge tone="amber">Revisar</Badge>}
                        {restricted && (
                          <Badge tone={row.compliance_reviewed ? 'blue' : 'red'}>
                            <ShieldAlert className="mr-0.5 size-3" />
                            {row.compliance_reviewed ? 'Restrito (revisado)' : 'Restrito'}
                          </Badge>
                        )}
                        {row.is_featured && <Badge tone="blue">Destaque</Badge>}
                        {row.is_bestseller && <Badge tone="blue">Mais vendido</Badge>}
                        {row.is_offer && <Badge tone="blue">Oferta</Badge>}
                      </div>
                    </div>
                  </Link>
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <span className="mb-0.5 block text-[11px] font-medium text-slate-500">Preço</span>
                      <PriceCell label={`Preço de ${row.name}`} cents={row.price_cents} onSave={(v) => savePrice(row, 'price_cents', v)} />
                    </div>
                    <div>
                      <span className="mb-0.5 block text-[11px] font-medium text-slate-500">Promocional</span>
                      <PriceCell label={`Preço promocional de ${row.name}`} cents={row.promo_price_cents} allowEmpty onSave={(v) => savePrice(row, 'promo_price_cents', v)} />
                    </div>
                    {row.status !== 'archived' && (
                      <button
                        onClick={() => void toggleStatus(row)}
                        className={`h-10 rounded-lg px-3 text-xs font-medium ${
                          row.status === 'published' ? 'text-muted hover:text-ink' : 'border border-[#d1d5db] bg-white text-ink hover:border-ink'
                        }`}
                      >
                        {row.status === 'published' ? 'Ocultar' : 'Publicar'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4">
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={(p) => setParam('p', String(p))} />
          </div>
        </>
      )}
    </div>
  )
}
