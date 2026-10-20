import { ChevronRight, Minus, Plus, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ProductAction } from '../../components/store/ProductAction'
import { PriceBlock, ProductImage } from '../../components/store/ProductCard'
import { EmptyState, PageLoader } from '../../components/ui/misc'
import { useCategories } from '../../contexts/CategoriesContext'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { groupOf } from '../../lib/categoryTree'
import { productDisplay } from '../../lib/pricing'
import { fetchProductBySlug } from '../../services/catalog'
import type { CatalogProduct } from '../../types'

export default function ProductPage() {
  const { slug = '' } = useParams()
  const s = useLoadedSettings()
  const categories = useCategories()
  const [product, setProduct] = useState<CatalogProduct | null | undefined>(undefined)
  const [imageIndex, setImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    setProduct(undefined)
    setImageIndex(0)
    setQuantity(1)
    fetchProductBySlug(slug)
      .then((p) => {
        setProduct(p)
        if (p) document.title = `${p.name} | ${s.store_name}`
      })
      .catch(() => setProduct(null))
  }, [slug, s.store_name])

  if (product === undefined) return <PageLoader />
  if (product === null) {
    return (
      <div className="wrap py-8">
        <h1 className="mb-6 text-2xl font-semibold text-ink">Produto não encontrado</h1>
        <EmptyState title="Ele pode ter sido removido ou ainda não foi publicado.">
          <Link to="/produtos" className="font-medium text-ink underline">
            Ver produtos
          </Link>
        </EmptyState>
      </div>
    )
  }

  const d = productDisplay(product, s)
  const canChooseQty = d.action === 'add_to_cart' || d.action === 'add_to_quote'
  const mainImage = product.images[imageIndex]
  const details = [
    ['Marca / laboratório', product.brand],
    ['Referência', product.sku],
    ['Apresentação', product.presentation],
    ['Via de aplicação', product.usage_route],
    ['Categoria', product.category_name],
  ].filter(([, v]) => v) as [string, string][]
  const group = product.category_slug ? groupOf(product.category_slug, categories) : undefined
  const crumbs = [
    { to: '/produtos', label: 'Produtos' },
    ...(group && group.slug !== product.category_slug
      ? [{ to: `/produtos?categoria=${group.slug}`, label: group.name }]
      : []),
    ...(product.category_name
      ? [{ to: `/produtos?categoria=${product.category_slug}`, label: product.category_name }]
      : []),
  ]

  return (
    <div className="wrap py-4 sm:py-8">
      <nav aria-label="Você está em" className="mb-4">
        <ol className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
          {crumbs.map((c, i) => (
            <li key={c.to} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-4" aria-hidden="true" />}
              <Link to={c.to} className="inline-flex min-h-11 items-center hover:text-ink hover:underline">
                {c.label}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-16">
        <div>
          {mainImage ? (
            <img
              src={mainImage.url}
              alt={mainImage.alt || product.name}
              className="aspect-square w-full bg-white object-contain"
            />
          ) : (
            <ProductImage product={product} className="aspect-square w-full" />
          )}
          {product.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {product.images.map((img, i) => (
                <button
                  key={img.url}
                  onClick={() => setImageIndex(i)}
                  className={`size-16 shrink-0 overflow-hidden border-2 bg-white ${
                    i === imageIndex ? 'border-ink' : 'border-transparent'
                  }`}
                  aria-label={`Imagem ${i + 1}`}
                >
                  <img src={img.url} alt="" className="size-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-balance text-ink sm:text-3xl">{product.name}</h1>
          {product.short_description && <p className="mt-2 text-muted">{product.short_description}</p>}

          <div className="mt-5">
            <PriceBlock product={product} size="lg" />
            {d.discountPercent != null && d.discountPercent > 0 && (
              <span className="tabular mt-1 inline-block text-sm text-muted">
                {d.discountPercent}% de desconto
              </span>
            )}
          </div>

          {d.restricted && (
            <div className="mt-4 flex gap-2 bg-[#fffbeb] p-3 text-sm text-[#92400e]">
              <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p>
                {product.requires_prescription ? 'Produto sujeito a prescrição. ' : 'Produto de venda restrita. '}
                {s.restricted_notice}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {canChooseQty && (
              <div className="flex h-11 items-center justify-between border border-[#cbd5e1] sm:w-36">
                <button
                  className="flex size-11 items-center justify-center text-ink hover:bg-[#f1f5f9]"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="size-4" />
                </button>
                <span className="tabular font-medium text-ink" aria-live="polite">
                  {quantity}
                </span>
                <button
                  className="flex size-11 items-center justify-center text-ink hover:bg-[#f1f5f9]"
                  onClick={() => setQuantity((q) => Math.min(999, q + 1))}
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            )}
            <div className="flex-1">
              <ProductAction product={product} quantity={quantity} />
            </div>
          </div>

          {details.length > 0 && (
            <dl className="mt-10 border-t border-[#e8e8e8]">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-[#e8e8e8] py-3 text-sm">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {product.description && (
            <section className="mt-8">
              <h2 className="mb-2 text-base font-medium text-ink">Descrição</h2>
              <p className="max-w-[65ch] text-sm leading-relaxed whitespace-pre-line text-muted">{product.description}</p>
            </section>
          )}
          {product.composition && (
            <section className="mt-6">
              <h2 className="mb-2 text-base font-medium text-ink">Composição</h2>
              <p className="max-w-[65ch] text-sm leading-relaxed whitespace-pre-line text-muted">{product.composition}</p>
            </section>
          )}
          <p className="mt-8 text-xs text-muted">
            As informações não substituem a orientação de um profissional de saúde habilitado.
          </p>
        </div>
      </div>
    </div>
  )
}
