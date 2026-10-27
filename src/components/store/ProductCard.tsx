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
        <p className={`tabular font-medium whitespace-nowrap text-ink ${size === 'lg' ? 'title-lg' : 'text-lg'}`}>{d.price}</p>
        {/* restrito à venda: o preço aparece com o lembrete da receita */}
        {d.restricted && (
          <p className={`mt-1 flex items-center gap-1 font-medium text-amber-800 ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>
            <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" /> Exige receita
          </p>
        )}
      </div>
    )
  }
  return (
    <p
      className={`flex items-start gap-1 font-medium ${d.restricted ? 'text-amber-800' : 'text-brand-dark'} ${
        size === 'lg' ? 'text-lg' : 'text-sm leading-snug'
      }`}
    >
      {d.restricted && <ShieldAlert className={`shrink-0 ${size === 'lg' ? 'mt-1 size-5' : 'size-4'}`} aria-hidden="true" />}
      {/* quebra permitida depois da barra ("prescrição/avaliação" não cabe em cards de 320px) */}
      <span className="min-w-0">{d.priceNote?.replace(/\//g, '/\u200b')}</span>
    </p>
  )
}

/**
 * Card de produto (card claro do sistema): branco, linha de 1px, cantos de 24px; a foto
 * (ou o frasco na cor do grupo) numa placa de 16px; nome em duas linhas fixas, categoria,
 * preço em algarismos tabulares e a ação em pílula. Alturas fixas alinham a fileira.
 */
export function ProductCard({ product }: { product: CatalogProduct; tone?: 'surface' | 'white' }) {
  const s = useLoadedSettings()
  const d = productDisplay(product, s)
  const url = `/produto/${product.slug}`

  return (
    <article className="card card-hover relative flex h-full flex-col p-2.5 sm:p-3">
      {d.discountPercent != null && d.discountPercent > 0 && (
        <span className="tabular absolute top-5 left-5 z-10 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">
          -{d.discountPercent}%
        </span>
      )}
      <Link to={url} className="block overflow-hidden rounded-2xl" tabIndex={-1} aria-hidden="true">
        <ProductImage product={product} className="aspect-square w-full" />
      </Link>
      <div className="flex flex-1 flex-col px-1.5 pt-3 pb-1.5 sm:px-2">
        <h3 className="text-base font-semibold text-ink">
          {/* o link ocupa as duas linhas reservadas: área de toque de 48px */}
          <Link to={url} className="line-clamp-2 min-h-[3em] leading-normal hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="mt-0.5 line-clamp-1 text-sm text-body">{product.category_name ?? ' '}</p>
        <div className="mt-auto pt-3">
          <PriceBlock product={product} />
          <div className="mt-3">
            <ProductAction product={product} compact />
          </div>
        </div>
      </div>
    </article>
  )
}
