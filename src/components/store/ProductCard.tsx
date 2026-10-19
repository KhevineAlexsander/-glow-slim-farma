import { ImageOff, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { productDisplay } from '../../lib/pricing'
import type { CatalogProduct } from '../../types'
import { ProductAction } from './ProductAction'

export function ProductImage({ product, className = '' }: { product: CatalogProduct; className?: string }) {
  const img = product.images[0]
  if (!img) {
    return (
      <div className={`flex items-center justify-center bg-brand-light/60 text-brand/40 ${className}`}>
        <ImageOff className="size-10" />
      </div>
    )
  }
  return (
    <img
      src={img.url}
      alt={img.alt || product.name}
      loading="lazy"
      decoding="async"
      className={`bg-white object-contain ${className}`}
    />
  )
}

export function PriceBlock({ product, size = 'sm' }: { product: CatalogProduct; size?: 'sm' | 'lg' }) {
  const s = useLoadedSettings()
  const d = productDisplay(product, s)
  if (d.price) {
    return (
      <div>
        {d.oldPrice && <p className="text-xs text-slate-400 line-through">{d.oldPrice}</p>}
        <p className={`font-extrabold whitespace-nowrap text-brand-dark ${size === 'lg' ? 'text-3xl' : 'text-base'}`}>{d.price}</p>
      </div>
    )
  }
  return (
    <p
      className={`flex items-center gap-1 font-semibold ${d.restricted ? 'text-amber-700' : 'text-brand'} ${
        size === 'lg' ? 'text-lg' : 'text-xs leading-tight'
      }`}
    >
      {d.restricted && <ShieldAlert className="size-4 shrink-0" />}
      {d.priceNote}
    </p>
  )
}

export function ProductCard({ product }: { product: CatalogProduct }) {
  const s = useLoadedSettings()
  const d = productDisplay(product, s)
  const url = `/produto/${product.slug}`

  return (
    <article className="card relative flex h-full flex-col overflow-hidden">
      {d.discountPercent != null && d.discountPercent > 0 && (
        <span className="absolute top-2 left-2 z-10 rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">
          -{d.discountPercent}%
        </span>
      )}
      <Link to={url} className="block p-3 pb-0">
        <ProductImage product={product} className="aspect-square w-full rounded-xl" />
      </Link>
      <div className="flex flex-1 flex-col p-3">
        <Link to={url} className="flex-1">
          <h3 className="line-clamp-2 text-sm font-bold text-slate-800">{product.name}</h3>
          {(product.short_description || product.category_name) && (
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
              {product.short_description || product.category_name}
            </p>
          )}
        </Link>
        {!product.is_available && <p className="mt-1 text-xs font-semibold text-slate-400">Indisponível</p>}
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <PriceBlock product={product} />
          </div>
          <ProductAction product={product} compact />
        </div>
        <Link to={url} className="-mb-2 inline-flex min-h-11 items-center text-xs font-semibold text-brand hover:underline">
          Ver detalhes
        </Link>
      </div>
    </article>
  )
}
