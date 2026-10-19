import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router'
import { HeroBanners, SecondaryBanner } from '../../components/store/Banners'
import { ProductCard } from '../../components/store/ProductCard'
import type { StoreOutletContext } from '../../components/store/StoreLayout'
import { CategoryIcon } from '../../components/ui/icons'
import { EmptyState, PageLoader } from '../../components/ui/misc'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { fetchBanners, fetchCatalog } from '../../services/catalog'
import type { Banner, CatalogProduct } from '../../types'

function Section({
  title,
  link,
  products,
}: {
  title: string
  link: string
  products: CatalogProduct[]
}) {
  if (!products.length) return null
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-extrabold text-brand-dark sm:text-2xl">{title}</h2>
        <Link to={link} className="flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-brand">
          Ver todos <ArrowRight className="size-4" />
        </Link>
      </div>
      {/* Carrossel horizontal no celular, grade no desktop */}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
        {products.slice(0, 10).map((p) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-auto">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  )
}

export default function HomePage() {
  const s = useLoadedSettings()
  const { categories } = useOutletContext<StoreOutletContext>()
  const [hero, setHero] = useState<Banner[]>([])
  const [secondary, setSecondary] = useState<Banner[]>([])
  const [products, setProducts] = useState<CatalogProduct[] | null>(null)

  useEffect(() => {
    fetchBanners('hero').then(setHero).catch(() => setHero([]))
    fetchBanners('secondary').then(setSecondary).catch(() => setSecondary([]))
    fetchCatalog({ limit: 500 }).then(setProducts).catch(() => setProducts([]))
  }, [])

  const featured = products?.filter((p) => p.is_featured) ?? []
  const bestsellers = products?.filter((p) => p.is_bestseller) ?? []
  const offers = products?.filter((p) => p.is_offer) ?? []
  const nothingFlagged = products && !featured.length && !bestsellers.length && !offers.length

  return (
    <div className="bg-soft-gradient">
      <div className="mx-auto max-w-7xl px-4 pt-2 pb-4">
        {s.show_categories && categories.length > 0 && (
          <section className="mb-6" aria-label={s.categories_title}>
            <h2 className="sr-only">{s.categories_title}</h2>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/produtos?categoria=${c.slug}`}
                  className="flex w-22 shrink-0 flex-col items-center gap-2 text-center sm:w-26"
                >
                  <span className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_6px_18px_-8px_rgba(22,119,242,0.35)] ring-1 ring-brand/10">
                    {c.image_url ? (
                      <img src={c.image_url} alt="" className="size-full object-cover" />
                    ) : (
                      <CategoryIcon name={c.icon} className="size-7 text-brand" />
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs font-semibold text-slate-700">{c.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <HeroBanners banners={hero} />

        {products === null ? (
          <PageLoader />
        ) : (
          <>
            {s.show_featured && <Section title={s.featured_title} link="/produtos?destaque=1" products={featured} />}
            {s.show_secondary_banners && secondary[0] && (
              <div className="mt-10">
                <SecondaryBanner banner={secondary[0]} />
              </div>
            )}
            {s.show_bestsellers && (
              <Section title={s.bestsellers_title} link="/produtos?maisvendidos=1" products={bestsellers} />
            )}
            {s.show_secondary_banners && secondary[1] && (
              <div className="mt-10">
                <SecondaryBanner banner={secondary[1]} />
              </div>
            )}
            {s.show_offers && <Section title={s.offers_title} link="/produtos?ofertas=1" products={offers} />}
            {s.show_secondary_banners &&
              secondary.slice(2).map((b) => (
                <div key={b.id} className="mt-10">
                  <SecondaryBanner banner={b} />
                </div>
              ))}

            {nothingFlagged &&
              (products.length ? (
                <Section title="Produtos" link="/produtos" products={products} />
              ) : (
                <div className="mt-10">
                  <EmptyState title="Em breve, novos produtos por aqui.">
                    Os produtos aparecem nesta página assim que forem publicados no painel.
                  </EmptyState>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  )
}
