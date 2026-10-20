import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router'
import { ProductCard } from '../../components/store/ProductCard'
import { groupColors } from '../../components/store/VialArt'
import type { StoreOutletContext } from '../../components/store/StoreLayout'
import { EmptyState, ErrorBox, PageLoader } from '../../components/ui/misc'
import { effectivePriceCents, isRestricted } from '../../lib/pricing'
import { buildCategoryTree, groupOf, slugsForCategory } from '../../lib/categoryTree'
import { fetchCatalog, type CatalogSort } from '../../services/catalog'
import type { CatalogProduct } from '../../types'

/** Produtos por página: divisível por 2, 3, 4 e 5 colunas, sem card órfão. */
const PAGE = 60

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
  const [limit, setLimit] = useState(PAGE)
  // Grupo selecionado inclui todas as suas subcategorias
  const categorySlugs = categoria ? slugsForCategory(categoria, categories) : []
  const slugsKey = categorySlugs.join(',')
  const tree = useMemo(() => buildCategoryTree(categories), [categories])
  const activeGroup = categoria ? groupOf(categoria, categories) : undefined
  const activeChildren = tree.find((t) => t.group.id === activeGroup?.id)?.children ?? []

  useEffect(() => {
    setProducts(null)
    setLimit(PAGE)
    fetchCatalog({
      search: q,
      categorySlugs: slugsKey ? slugsKey.split(',') : undefined,
      flag: flag?.key,
      sort: sort === 'name_asc' || sort === 'name_desc' ? sort : 'relevance',
    })
      .then((data) => {
        setProducts(data)
        setError(null)
      })
      .catch(() => setError('Não foi possível carregar os produtos.'))
  }, [q, slugsKey, flag?.key, sort])

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

  const chip = (active: boolean) =>
    `inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors ${
      active ? 'bg-ink text-white' : 'bg-[#f1f5f9] text-ink hover:bg-[#e2e8f0]'
    }`
  const subChip = (active: boolean) =>
    `inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors ${
      active ? 'border-ink text-ink' : 'border-[#cbd5e1] text-muted hover:text-ink'
    }`
  const total = sorted?.length ?? 0
  const shown = sorted ? sorted.slice(0, limit) : null

  return (
    <div className="wrap py-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            {sorted ? `${total} ${total === 1 ? 'produto' : 'produtos'}` : 'Carregando…'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
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

      {/* Grupos numa fileira só (rola de lado quando não cabe); a bolinha é a cor dos frascos do grupo */}
      <div
        className="-mx-(--margin) mt-6 flex gap-2 overflow-x-auto px-(--margin) pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Grupos de categorias"
      >
        <button onClick={() => update('categoria', '')} aria-pressed={!categoria} className={chip(!categoria)}>
          Todas
        </button>
        {tree.map(({ group }, index) => (
          <button
            key={group.id}
            onClick={() => update('categoria', group.slug)}
            aria-pressed={activeGroup?.id === group.id}
            className={chip(activeGroup?.id === group.id)}
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: groupColors(index)[0] }} aria-hidden="true" />
            {group.name}
          </button>
        ))}
      </div>

      {activeGroup && activeChildren.length > 0 && (
        <div
          className="-mx-(--margin) mt-2 flex gap-2 overflow-x-auto px-(--margin) pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={`Subcategorias de ${activeGroup.name}`}
        >
          <button
            onClick={() => update('categoria', activeGroup.slug)}
            aria-pressed={categoria === activeGroup.slug}
            className={subChip(categoria === activeGroup.slug)}
          >
            Tudo em {activeGroup.name}
          </button>
          {activeChildren.map((c) => (
            <button
              key={c.id}
              onClick={() => update('categoria', c.slug)}
              aria-pressed={categoria === c.slug}
              className={subChip(categoria === c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {(q || flag) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {q && (
            <button onClick={() => update('q', '')} className={subChip(true)} aria-label={`Limpar busca: ${q}`}>
              Busca: {q} <X className="ml-1.5 size-4" aria-hidden="true" />
            </button>
          )}
          {flag && flagEntry && (
            <button onClick={() => update(flagEntry, '')} className={subChip(true)} aria-label={`Limpar filtro: ${flag.label}`}>
              {flag.label} <X className="ml-1.5 size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div className="mt-6">
        {error ? (
          <ErrorBox message={error} />
        ) : !shown ? (
          <PageLoader />
        ) : shown.length === 0 ? (
          <EmptyState title="Nenhum produto encontrado.">
            Tente outra busca ou <Link to="/produtos" className="font-semibold text-brand-dark underline">veja todos os produtos</Link>.
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shown.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <div className="mt-10 flex flex-col items-center gap-3">
              <p className="tabular text-sm text-muted">
                Mostrando 1–{shown.length} de {total}
              </p>
              {shown.length < total && (
                <button type="button" className="btn-outline" onClick={() => setLimit((n) => n + PAGE)}>
                  Mostrar mais
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
