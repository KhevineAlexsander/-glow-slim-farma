import { ArrowRight, ChevronRight, MessageCircle, Mail, ShieldCheck, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useOutletContext } from 'react-router'
import { PriceBlock, ProductCard, ProductImage } from '../../components/store/ProductCard'
import { Reveal } from '../../components/store/Reveal'
import type { StoreOutletContext } from '../../components/store/StoreLayout'
import { VialArt, groupColors } from '../../components/store/VialArt'
import { EmptyState, PageLoader } from '../../components/ui/misc'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { buildCategoryTree, type CategoryGroup } from '../../lib/categoryTree'
import { whatsappLink } from '../../lib/whatsapp'
import { fetchBanners, fetchCatalog } from '../../services/catalog'
import type { Banner, CatalogProduct } from '../../types'

/*
 * Página inicial no sistema do DESIGN.md "Coinbase" (awesome-claude-design), com a marca
 * da loja: faixa escura no topo com os produtos reais em cards sobrepostos, depois o ritmo
 * branco / cinza-claro / escuro, títulos grandes em peso 400 e uma única cor de ação.
 */

function formatPhone(digits: string) {
  const d = digits.replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

/** Link interno (react-router) ou externo, conforme o endereço do banner. */
function SmartLink({ to, className, children }: { to: string; className: string; children: ReactNode }) {
  if (/^https?:\/\//i.test(to)) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  )
}

/** Cabeçalho de seção: rótulo em pílula, título de display e um link opcional. */
function SectionHead({
  id,
  label,
  title,
  link,
}: {
  id: string
  label?: string
  title: string
  link?: { to: string; text: string }
}) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 lg:mb-12">
      <div>
        {label && <p className="badge-pill">{label}</p>}
        <Reveal as="h2" id={id} className={`display-lg max-w-[18ch] text-ink ${label ? 'mt-4' : ''}`}>
          {title}
        </Reveal>
      </div>
      {link && (
        <Link to={link.to} className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-brand-dark hover:underline">
          {link.text} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. Faixa escura do topo com cards de produto sobrepostos
// ---------------------------------------------------------------------------
function HeroCard({ product, className = '' }: { product: CatalogProduct; className?: string }) {
  return (
    <div className={`rounded-3xl bg-white p-3 text-ink ${className}`}>
      <ProductImage product={product} className="aspect-[4/3] w-full rounded-2xl" />
      <div className="px-2 pt-4 pb-2">
        <p className="line-clamp-2 text-lg font-semibold">{product.name}</p>
        <p className="mt-0.5 text-sm text-body">{product.category_name}</p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <PriceBlock product={product} />
          <Link
            to={`/produto/${product.slug}`}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-brand-dark hover:underline"
          >
            Ver produto <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function Hero({
  hero,
  products,
}: {
  hero?: Banner
  products: CatalogProduct[]
}) {
  const [front, ...back] = products
  return (
    <section className="overflow-hidden bg-dark text-white" aria-labelledby="topo">
      <div className="wrap grid items-center gap-14 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:py-24">
        <div>
          <p className="badge-pill bg-dark-elevated text-white">Pedidos pelo WhatsApp</p>
          <h1 id="topo" className="display-mega mt-6 max-w-[14ch]">
            {hero?.title ?? 'Saúde, beleza e bem-estar.'}
          </h1>
          {hero?.subtitle && <p className="mt-6 max-w-[46ch] text-lg text-on-dark-soft">{hero.subtitle}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <SmartLink to={hero?.button_link || '/produtos'} className="btn-primary btn-lg">
              {hero?.button_label || 'Ver produtos'}
            </SmartLink>
          </div>
          {/* Fatos do atendimento (como a loja funciona de verdade) */}
          <ul className="mt-10 grid gap-3 text-sm text-on-dark-soft sm:grid-cols-3 sm:gap-6">
            <li className="flex items-start gap-2">
              <Wallet className="mt-0.5 size-4 shrink-0 text-white" aria-hidden="true" /> Sem pagamento no site
            </li>
            <li className="flex items-start gap-2">
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-white" aria-hidden="true" /> Confirmação pelo WhatsApp
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-white" aria-hidden="true" /> Receitas avaliadas por
              responsável técnico
            </li>
          </ul>
        </div>

        {/* Cards sobrepostos (só no desktop): o da frente é o produto em destaque */}
        {front && (
          // no celular o card fica de fora: o "como comprar" vem logo abaixo do topo
          <div className="relative mx-auto hidden w-full max-w-sm lg:mr-0 lg:block">
            {/* camadas de trás: cards escuros elevados, só profundidade (sem conteúdo cortado) */}
            {back.length > 0 && (
              <div className="absolute inset-0 hidden translate-x-14 -translate-y-8 rotate-6 rounded-3xl bg-dark-elevated lg:block" aria-hidden="true" />
            )}
            {back.length > 1 && (
              <div className="absolute inset-0 hidden -translate-x-12 translate-y-6 -rotate-6 rounded-3xl bg-dark-elevated lg:block" aria-hidden="true" />
            )}
            <HeroCard product={front} className="relative" />
          </div>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 2. Grupos de categorias em cards (2 e 3 colunas)
// ---------------------------------------------------------------------------
function Groups({ title, tree, counts }: { title: string; tree: CategoryGroup[]; counts: Map<string, number> }) {
  const total = (g: CategoryGroup) => [g.group, ...g.children].reduce((sum, c) => sum + (counts.get(c.slug) ?? 0), 0)
  return (
    <section className="section-y bg-white" aria-labelledby="categorias">
      <div className="wrap">
        <SectionHead id="categorias" label="Catálogo" title={title} link={{ to: '/produtos', text: 'Ver todos os produtos' }} />
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6">
          {tree.map((g, i) => {
            const n = total(g)
            return (
              <Reveal as="li" key={g.group.id} i={i % 3}>
                <Link to={`/produtos?categoria=${g.group.slug}`} className="card card-hover flex h-full flex-col p-4 sm:p-6 lg:p-8">
                  <span className="flex size-12 items-center justify-center rounded-full bg-surface-strong sm:size-14" aria-hidden="true">
                    <VialArt seed={g.group.slug} color={groupColors(i)} background={false} className="h-8 w-auto sm:h-10" />
                  </span>
                  <span className="mt-4 text-base font-semibold text-ink sm:mt-6 sm:text-lg">{g.group.name}</span>
                  <span className="tabular mt-1 text-sm text-body">
                    {n} {n === 1 ? 'produto' : 'produtos'}
                  </span>
                  {g.children.length > 0 && (
                    <span className="mt-4 line-clamp-2 hidden text-sm text-body sm:block">{g.children.map((c) => c.name).join(' · ')}</span>
                  )}
                  <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-brand-dark sm:pt-6">
                    Ver produtos <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                </Link>
              </Reveal>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 3. Grade de produtos (destaques e ofertas)
// ---------------------------------------------------------------------------
function ProductGrid({
  id,
  label,
  title,
  link,
  products,
  tone,
}: {
  id: string
  label?: string
  title: string
  link: string
  products: CatalogProduct[]
  tone: 'white' | 'soft'
}) {
  if (!products.length) return null
  const n = products.length
  const wide = n >= 4 ? Math.min(8, Math.floor(n / 4) * 4) : n
  const narrow = n >= 2 ? Math.min(4, Math.floor(n / 2) * 2) : n
  return (
    <section className={`section-y ${tone === 'soft' ? 'bg-surface-soft' : 'bg-white'}`} aria-labelledby={id}>
      <div className="wrap">
        <SectionHead id={id} label={label} title={title} link={{ to: link, text: 'Ver todos' }} />
        {/* só fileiras completas: até 4 no celular (2 × 2) e múltiplos de 4 no desktop */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
          {products.slice(0, wide).map((p, i) => (
            <Reveal key={p.id} i={i % 4} className={i >= narrow ? 'hidden lg:block' : ''}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 4. Mais vendidos em linhas (como uma lista de ativos)
// ---------------------------------------------------------------------------
function ProductRows({ title, products }: { title: string; products: CatalogProduct[] }) {
  if (!products.length) return null
  return (
    <section className="section-y bg-white" aria-labelledby="mais-vendidos">
      <div className="wrap">
        <SectionHead
          id="mais-vendidos"
          label="Preferidos"
          title={title}
          link={{ to: '/produtos?maisvendidos=1', text: 'Ver todos' }}
        />
        <div className="card px-4 sm:px-8">
          <div className="hidden grid-cols-[1fr_10rem_6rem] gap-6 border-b border-hairline py-4 text-sm text-body sm:grid">
            <span>Produto</span>
            <span className="text-right">Preço</span>
            <span />
          </div>
          <ul>
            {products.slice(0, 6).map((p) => (
              <li key={p.id} className="border-b border-hairline last:border-b-0">
                <Link
                  to={`/produto/${p.slug}`}
                  className="grid items-center gap-6 py-4 sm:grid-cols-[1fr_10rem_6rem]"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="size-12 shrink-0 overflow-hidden rounded-full bg-surface-strong">
                      <ProductImage product={p} className="size-full" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-ink">{p.name}</p>
                      <p className="truncate text-sm text-body">{p.category_name}</p>
                      {/* no celular o preço vem na segunda linha, sem apertar o nome */}
                      <div className="mt-1 sm:hidden">
                        <PriceBlock product={p} />
                      </div>
                    </div>
                  </div>
                  <div className="hidden justify-end text-right sm:flex">
                    <PriceBlock product={p} />
                  </div>
                  <span className="hidden items-center justify-end gap-1 text-sm font-semibold text-brand-dark sm:flex">
                    Ver <ChevronRight className="size-4" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 5. Como comprar: três cards de passo
// ---------------------------------------------------------------------------
const STEPS = [
  { title: 'Escolha os produtos', text: 'Busque pelo nome ou navegue pelos grupos e adicione os itens ao seu pedido.' },
  { title: 'Informe seus dados', text: 'No carrinho, confira os itens e deixe seu nome e WhatsApp. Não é preciso criar conta.' },
  { title: 'Finalize pelo WhatsApp', text: 'A mensagem com o pedido abre pronta. A loja confirma valores, pagamento e entrega.' },
]

function HowItWorks() {
  return (
    <section className="section-y bg-surface-soft" aria-labelledby="como-comprar">
      <div className="wrap">
        <SectionHead id="como-comprar" label="Como comprar" title="Seu pedido em três passos" />
        <ol className="grid gap-4 md:grid-cols-3 lg:gap-6">
          {STEPS.map((step, i) => (
            <Reveal as="li" key={step.title} i={i} className="card p-6 lg:p-8">
              <span className="tabular flex size-10 items-center justify-center rounded-full bg-surface-strong text-base font-semibold text-ink">
                {i + 1}
              </span>
              <h3 className="mt-6 text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-base text-body">{step.text}</p>
            </Reveal>
          ))}
        </ol>
        <p className="mt-6 text-sm text-body">
          Itens com prescrição exigem receita ou documentação, avaliadas pelo responsável técnico.
        </p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 6. Banner secundário (editável no painel) como faixa clara dividida
// ---------------------------------------------------------------------------
function SecondaryBanner({ banner, groups }: { banner: Banner; groups: number }) {
  return (
    <section className="section-y bg-white" aria-labelledby="faixa">
      <div className="wrap">
        <div className="grid items-center gap-10 overflow-hidden rounded-3xl bg-surface-soft p-6 sm:p-10 lg:grid-cols-2 lg:p-14">
          <div>
            <Reveal as="h2" id="faixa" className="display-md max-w-[18ch] text-ink">
              {banner.title}
            </Reveal>
            {banner.subtitle && <p className="mt-4 max-w-[44ch] text-lg text-body">{banner.subtitle}</p>}
            <SmartLink to={banner.button_link || '/produtos'} className="btn-primary mt-8">
              {banner.button_label || 'Ver o catálogo'}
            </SmartLink>
          </div>
          {banner.image_url ? (
            <img src={banner.image_url} alt="" loading="lazy" decoding="async" className="w-full rounded-2xl object-cover" />
          ) : (
            // Sem imagem: os frascos nas cores dos grupos
            <div className="flex items-end justify-center gap-3 sm:gap-5" aria-hidden="true">
              {Array.from({ length: Math.max(1, Math.min(groups, 6)) }, (_, i) => (
                <VialArt
                  key={i}
                  seed={String(i)}
                  color={groupColors(i)}
                  background={false}
                  kind={i % 2 ? 'ampola' : 'frasco'}
                  className="h-24 w-auto sm:h-40"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 7. Faixa escura de contato antes do rodapé
// ---------------------------------------------------------------------------
function ContactBand() {
  const s = useLoadedSettings()
  const facts = [s.opening_hours, s.address, s.whatsapp_number ? formatPhone(s.whatsapp_number) : null].filter(Boolean)
  return (
    <section className="section-y bg-dark text-white" aria-labelledby="contato">
      <div className="wrap text-center">
        <Reveal as="h2" id="contato" className="display-md mx-auto max-w-[20ch]">
          Fale com a gente
        </Reveal>
        <p className="mx-auto mt-4 max-w-[52ch] text-lg text-on-dark-soft">
          Tire dúvidas sobre produtos, prescrição e entrega direto com a equipe da {s.store_name}.
        </p>
        {facts.length > 0 && <p className="mt-4 text-sm text-on-dark-soft">{facts.join(' · ')}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {s.whatsapp_number && (
            <a
              href={whatsappLink(s.whatsapp_number, `Olá, ${s.store_name}!`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary btn-lg"
            >
              <MessageCircle className="size-5" aria-hidden="true" /> Chamar no WhatsApp
            </a>
          )}
          {s.contact_email && (
            <a href={`mailto:${s.contact_email}`} className="btn-outline-on-dark btn-lg max-w-full">
              <Mail className="size-5 shrink-0" aria-hidden="true" /> <span className="truncate">{s.contact_email}</span>
            </a>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
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

  const tree = useMemo(() => buildCategoryTree(categories), [categories])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products ?? []) if (p.category_slug) m.set(p.category_slug, (m.get(p.category_slug) ?? 0) + 1)
    return m
  }, [products])

  const featured = products?.filter((p) => p.is_featured) ?? []
  const bestsellers = products?.filter((p) => p.is_bestseller) ?? []
  const offers = products?.filter((p) => p.is_offer) ?? []
  // Sem nada marcado como destaque, o topo e a vitrine usam os primeiros produtos
  const showcase = featured.length ? featured : (products ?? [])
  const heroProducts = showcase.slice(0, 3)

  return (
    <>
      <Hero hero={hero[0]} products={heroProducts} />

      {/* Como comprar logo no começo: o cliente entende o caminho antes de escolher */}
      <HowItWorks />

      {s.show_categories && tree.length > 0 && <Groups title={s.categories_title} tree={tree} counts={counts} />}

      {products === null ? (
        <PageLoader />
      ) : products.length === 0 ? (
        <div className="wrap section-y">
          <EmptyState title="Em breve, novos produtos por aqui.">
            Os produtos aparecem nesta página assim que forem publicados no painel.
          </EmptyState>
        </div>
      ) : (
        <>
          {s.show_featured && (
            <ProductGrid
              id="destaques"
              label="Selecionados"
              title={s.featured_title}
              link="/produtos?destaque=1"
              products={showcase}
              tone="soft"
            />
          )}
          {s.show_bestsellers && <ProductRows title={s.bestsellers_title} products={bestsellers} />}
          {s.show_offers && (
            <ProductGrid id="ofertas" label="Ofertas" title={s.offers_title} link="/produtos?ofertas=1" products={offers} tone="soft" />
          )}
        </>
      )}

      {s.show_secondary_banners && secondary[0] && <SecondaryBanner banner={secondary[0]} groups={tree.length} />}

      <ContactBand />
    </>
  )
}
