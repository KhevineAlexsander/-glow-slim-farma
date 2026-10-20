import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router'
import { useCategories } from '../../contexts/CategoriesContext'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { productDisplay } from '../../lib/pricing'
import type { CatalogProduct } from '../../types'
import { ProductAction } from './ProductAction'
import { VialArt, categoryColors, vialKind } from './VialArt'

export function ProductImage({ product, className = '' }: { product: CatalogProduct; className?: string }) {
  const categories = useCategories()
  const img = product.images[0]
  if (!img) {
    // Sem foto: vidro ilustrativo na cor do grupo da categoria
    return (
      <VialArt
        seed={product.slug}
        color={categoryColors(product.category_slug, categories)}
        kind={vialKind(`${product.presentation ?? ''} ${product.name}`)}
        title={`Imagem ilustrativa: ${product.name}`}
        className={`overflow-hidden ${className}`}
      />
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
        {d.oldPrice && <p className="tabular text-xs text-muted line-through">{d.oldPrice}</p>}
        <p className={`tabular font-semibold whitespace-nowrap text-ink ${size === 'lg' ? 't-lead' : 'text-base'}`}>{d.price}</p>
      </div>
    )
  }
  return (
    <p
      className={`flex items-start gap-1 font-medium ${d.restricted ? 'text-amber-800' : 'text-brand-dark'} ${
        size === 'lg' ? 'text-lg' : 'text-xs leading-tight'
      }`}
    >
      {d.restricted && <ShieldAlert className={`shrink-0 ${size === 'lg' ? 'mt-1 size-5' : 'size-4'}`} aria-hidden="true" />}
      {/* quebra permitida depois da barra ("prescrição/avaliação" não cabe em cards de 320px) */}
      <span className="min-w-0">{d.priceNote?.replace(/\//g, '/\u200b')}</span>
    </p>
  )
}

/**
 * Card de produto: foto (ou frasco na cor do grupo), nome em duas linhas fixas, a
 * categoria, e no pé o preço e a ação. As alturas fixas fazem todos os cards de uma
 * fileira terminarem na mesma linha.
 */
export function ProductCard({ product, tone = 'surface' }: { product: CatalogProduct; tone?: 'surface' | 'white' }) {
  const s = useLoadedSettings()
  const d = productDisplay(product, s)
  const url = `/produto/${product.slug}`

  return (
    <article className={`relative flex h-full flex-col ${tone === 'white' ? 'bg-white' : 'bg-[#f4f7fb]'}`}>
      {d.discountPercent != null && d.discountPercent > 0 && (
        <span className="tabular absolute top-0 left-0 z-10 bg-ink px-2 py-1 text-xs font-medium text-white">
          -{d.discountPercent}%
        </span>
      )}
      <Link to={url} className="block" tabIndex={-1} aria-hidden="true">
        <ProductImage product={product} className="aspect-square w-full" />
      </Link>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="text-sm font-medium text-ink">
          {/* o link ocupa as duas linhas reservadas: área de toque de 48px */}
          <Link to={url} className="line-clamp-2 min-h-[2lh] hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-muted">
          {product.category_name ?? ' '}
        </p>
        <div className="mt-auto pt-3">
          <PriceBlock product={product} />
          <div className="mt-2">
            <ProductAction product={product} compact />
          </div>
        </div>
      </div>
    </article>
  )
}
