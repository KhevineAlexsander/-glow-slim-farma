import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router'
import { ProductCard } from '../../components/store/ProductCard'
import type { StoreOutletContext } from '../../components/store/StoreLayout'
import { EmptyState, ErrorBox, PageLoader } from '../../components/ui/misc'
import { effectivePriceCents, isRestricted } from '../../lib/pricing'
import { fetchCatalog, type CatalogSort } from '../../services/catalog'
import type { CatalogProduct } from '../../types'

const FLAGS = {
  destaque: { key: 'is_featured', label: 'Destaques' },
  maisvendidos: { key: 'is_bestseller', label: 'Mais vendidos' },
  ofertas: { key: 'is_offer', label: 'Ofertas' },
} as const

/** Preço visível para ordenação; produtos sem preço exibido vão para o fim. */
function sortablePrice(p: CatalogProduct): number | null {
  if (isRestricted(p)) return null
  const v = effectivePriceCents(p)
  return v > 0 ? v : null
}

export default function ProductsPage() {
  const { categories } = useOutletContext<StoreOutletContext>()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const categoria = params.get('categoria') ?? ''
  const sort = (params.get('ordem') as CatalogSort) || 'relevance'
  const flagEntry = (Object.keys(FLAGS) as (keyof typeof FLAGS)[]).find((k) => params.get(k) === '1')
  const flag = flagEntry ? FLAGS[flagEntry] : null

  const [products, setProducts] = useState<CatalogProduct[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setProducts(null)
    fetchCatalog({
      search: q,
      categorySlug: categoria || undefined,
      flag: flag?.key,
      sort: sort === 'name_asc' || sort === 'name_desc' ? sort : 'relevance',
    })
      .then((data) => {
        setProducts(data)
        setError(null)
      })
      .catch(() => setError('Não foi possível carregar os produtos.'))
  }, [q, categoria, flag?.key, sort])

  const sorted = useMemo(() => {
    if (!products) return null
    if (sort !== 'price_asc' && sort !== 'price_desc') return products
    const dir = sort === 'price_asc' ? 1 : -1
    return [...products].sort((a, b) => {
      const pa = sortablePrice(a)
      const pb = sortablePrice(b)
      if (pa == null && pb == null) return a.name.localeCompare(b.name)
      if (pa == null) return 1
      if (pb == null) return -1
      return (pa - pb) * dir
    })
  }, [products, sort])

  const hasPrices = products?.some((p) => sortablePrice(p) != null)
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const currentCategory = categories.find((c) => c.slug === categoria)
  const title = currentCategory?.name ?? flag?.label ?? (q ? `Resultados para “${q}”` : 'Todos os produtos')

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-extrabold text-brand-dark">{title}</h1>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="-mx-4 flex flex-1 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => update('categoria', '')}
            className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${!categoria ? 'bg-brand text-white' : 'bg-brand-light text-brand-dark'}`}
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => update('categoria', c.slug)}
              className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${
                categoria === c.slug ? 'bg-brand text-white' : 'bg-brand-light text-brand-dark'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Ordenar
          <select className="input w-auto" value={sort} onChange={(e) => update('ordem', e.target.value)}>
            <option value="relevance">Relevância</option>
            <option value="name_asc">Nome (A–Z)</option>
            <option value="name_desc">Nome (Z–A)</option>
            {hasPrices && <option value="price_asc">Menor preço</option>}
            {hasPrices && <option value="price_desc">Maior preço</option>}
          </select>
        </label>
      </div>

      {(q || flag) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {q && (
            <button onClick={() => update('q', '')} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Busca: {q} <X className="size-3.5" />
            </button>
          )}
          {flag && flagEntry && (
            <button onClick={() => update(flagEntry, '')} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {flag.label} <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="mt-6">
        {error ? (
          <ErrorBox message={error} />
        ) : !sorted ? (
          <PageLoader />
        ) : sorted.length === 0 ? (
          <EmptyState title="Nenhum produto encontrado.">
            Tente outra busca ou <Link to="/produtos" className="font-semibold text-brand">veja todos os produtos</Link>.
          </EmptyState>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-500">{sorted.length} produto(s)</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {sorted.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
