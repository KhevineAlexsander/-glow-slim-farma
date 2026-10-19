import { ChevronLeft, Minus, Plus, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ProductAction } from '../../components/store/ProductAction'
import { PriceBlock, ProductImage } from '../../components/store/ProductCard'
import { EmptyState, PageLoader } from '../../components/ui/misc'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { productDisplay } from '../../lib/pricing'
import { fetchProductBySlug } from '../../services/catalog'
import type { CatalogProduct } from '../../types'

export default function ProductPage() {
  const { slug = '' } = useParams()
  const s = useLoadedSettings()
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
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState title="Produto não encontrado.">
          Ele pode ter sido removido ou ainda não foi publicado.{' '}
          <Link to="/produtos" className="font-semibold text-brand">
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:py-8">
      <Link to="/produtos" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand">
        <ChevronLeft className="size-4" /> Voltar aos produtos
      </Link>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <div>
          <div className="card overflow-hidden p-4">
            {mainImage ? (
              <img
                src={mainImage.url}
                alt={mainImage.alt || product.name}
                className="aspect-square w-full rounded-xl bg-white object-contain"
              />
            ) : (
              <ProductImage product={product} className="aspect-square w-full rounded-xl" />
            )}
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {product.images.map((img, i) => (
                <button
                  key={img.url}
                  onClick={() => setImageIndex(i)}
                  className={`size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white ${
                    i === imageIndex ? 'border-brand' : 'border-transparent'
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
          {product.category_name && (
            <Link
              to={`/produtos?categoria=${product.category_slug}`}
              className="inline-flex min-h-11 items-center text-xs font-bold tracking-wider text-brand uppercase"
            >
              {product.category_name}
            </Link>
          )}
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">{product.name}</h1>
          {product.short_description && <p className="mt-2 text-slate-600">{product.short_description}</p>}

          <div className="mt-5">
            <PriceBlock product={product} size="lg" />
            {d.discountPercent != null && d.discountPercent > 0 && (
              <span className="mt-1 inline-block rounded-full bg-brand-light px-2 py-0.5 text-xs font-bold text-brand-dark">
                {d.discountPercent}% de desconto
              </span>
            )}
          </div>

          {d.restricted && (
            <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <ShieldAlert className="mt-0.5 size-5 shrink-0" />
              <p>
                {product.requires_prescription ? 'Produto sujeito a prescrição. ' : 'Produto de venda restrita. '}
                {s.restricted_notice}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {canChooseQty && (
              <div className="flex h-11 items-center justify-between rounded-full border border-slate-200 sm:w-36">
                <button
                  className="flex size-11 items-center justify-center text-slate-600"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="size-4" />
                </button>
                <span className="font-semibold" aria-live="polite">
                  {quantity}
                </span>
                <button
                  className="flex size-11 items-center justify-center text-slate-600"
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
            <dl className="mt-8 divide-y divide-slate-100 rounded-2xl border border-slate-100">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {product.description && (
            <section className="mt-8">
              <h2 className="mb-2 font-bold text-slate-900">Descrição</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-slate-600">{product.description}</p>
            </section>
          )}
          {product.composition && (
            <section className="mt-6">
              <h2 className="mb-2 font-bold text-slate-900">Composição</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-slate-600">{product.composition}</p>
            </section>
          )}
          <p className="mt-8 text-xs text-slate-400">
            As informações não substituem a orientação de um profissional de saúde habilitado.
          </p>
        </div>
      </div>
    </div>
  )
}
