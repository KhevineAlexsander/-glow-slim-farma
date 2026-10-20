import { ArrowRight, ArrowUpRight, MessageCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useOutletContext } from 'react-router'
import { ProductAction } from '../../components/store/ProductAction'
import { PriceBlock, ProductCard, ProductImage } from '../../components/store/ProductCard'
import { Reveal } from '../../components/store/Reveal'
import type { StoreOutletContext } from '../../components/store/StoreLayout'
import { VialArt, groupColors } from '../../components/store/VialArt'
import { EmptyState, PageLoader } from '../../components/ui/misc'
import { useLoadedSettings } from '../../contexts/SettingsContext'
import { buildCategoryTree, type CategoryGroup } from '../../lib/categoryTree'
import { ACERVO } from '../../lib/imageCredits'
import { whatsappLink } from '../../lib/whatsapp'
import { fetchBanners, fetchCatalog } from '../../services/catalog'
import type { Banner, CatalogProduct } from '../../types'

/*
 * Direção "palco dividido" (TasteSkill, seed 403553028): metade da tela fica parada
 * enquanto a outra rola. Ideia: o frasco de tampa colorida é o palco fixo, e cada
 * grupo de produtos dá a sua cor ao líquido (a interação viva da página).
 */

function formatPhone(digits: string) {
  const d = digits.replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

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

// ---------------------------------------------------------------------------
// 1. Palco + topo + lista de grupos
// ---------------------------------------------------------------------------
function Stage({ group, index, count }: { group: CategoryGroup | null; index: number; count: number }) {
  const colors = group ? groupColors(index) : null
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a63cf]">
      {/* Repouso: fotografia real do universo da farmácia (acervo aberto) */}
      <img
        src={ACERVO.frascosAzuis.src}
        width={ACERVO.frascosAzuis.width}
        height={ACERVO.frascosAzuis.height}
        alt={ACERVO.frascosAzuis.alt}
        fetchPriority="high"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${group ? 'opacity-0' : 'opacity-100'}`}
      />
      {/* Véu neutro chapado sob o nome que atravessa a foto, para o texto branco ficar legível */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-[17%] bg-black/50 transition-opacity duration-500 ${group ? 'opacity-0' : 'opacity-100'}`}
        aria-hidden="true"
      />
      {/* Grupo ativo: o frasco ganha a cor do grupo */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-[opacity,background-color] duration-500 ${group ? 'opacity-100' : 'opacity-0'}`}
        style={{ backgroundColor: colors ? colors[0] : undefined }}
        aria-hidden={!group}
      >
        <VialArt
          seed={group?.group.slug ?? 'glow'}
          color={colors ? ['#ffffff', colors[1]] : undefined}
          background={false}
          className="h-[72%] w-auto max-w-full"
          title={group ? `Frasco ilustrativo na cor de ${group.group.name}` : undefined}
        />
      </div>
      {group && (
        <p className="absolute right-5 bottom-5 left-5 text-sm font-medium text-white" aria-live="polite">
          {group.group.name} · <span className="tabular">{count}</span> produto(s)
        </p>
      )}
    </div>
  )
}

function SplitStage({
  storeName,
  hero,
  tree,
  counts,
  showCategories,
  categoriesTitle,
  whatsapp,
}: {
  storeName: string
  hero: Banner | undefined
  tree: CategoryGroup[]
  counts: Map<string, number>
  showCategories: boolean
  categoriesTitle: string
  whatsapp: string | null
}) {
  const [active, setActive] = useState(-1)
  const heroRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef<(HTMLLIElement | null)[]>([])
  const group = active >= 0 ? (tree[active] ?? null) : null

  // Rolar até o meio da tela ativa a linha; voltar ao topo devolve a fotografia.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const rowsIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index))
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    rowsRef.current.forEach((r) => r && rowsIo.observe(r))
    const heroIo = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setActive(-1)
      },
      { threshold: 0.55 },
    )
    if (heroRef.current) heroIo.observe(heroRef.current)
    return () => {
      rowsIo.disconnect()
      heroIo.disconnect()
    }
  }, [tree.length])

  const name = storeName.toLowerCase()
  // Nome em uma linha: tamanho calculado pelo número de letras
  const wordmarkSize = `clamp(2.75rem, ${Math.min(8.2, 70 / Math.max(name.length * 0.56, 1)).toFixed(2)}vw, 9.5rem)`
  const groupCount = (g: CategoryGroup) =>
    [g.group, ...g.children].reduce((sum, c) => sum + (counts.get(c.slug) ?? 0), 0)

  return (
    <section className="bg-brand-dark text-white" aria-label="Início">
      <div className="wrap grid gap-x-8 pt-3 pb-16 lg:grid-cols-[47fr_53fr] lg:pb-28">
        {/* Palco: fixo no desktop enquanto a coluna da direita rola */}
        <div className="h-[34svh] min-h-56 lg:sticky lg:top-28 lg:h-[calc(100svh-8.5rem)]">
          <Stage group={group} index={active} count={group ? groupCount(group) : 0} />
        </div>

        <div className="min-w-0">
          {/* Topo: o que é a loja, a frase e a ação */}
          <div ref={heroRef} className="flex flex-col lg:min-h-[calc(100svh-8.5rem)]">
            {/* O nome atravessa a borda do palco (sobre o azul, nunca sobre o desenho) */}
            <h1
              className="scroll-shrink relative z-10 order-first -mt-[0.55em] font-normal whitespace-nowrap lowercase lg:order-last lg:mt-0 lg:-ml-[10vw]"
              style={{ fontSize: wordmarkSize, lineHeight: 0.95, letterSpacing: '-0.045em' }}
            >
              <span className="sr-only">{storeName}</span>
              <span aria-hidden="true">{name}</span>
            </h1>
            <p className="sr-only">Loja de injetáveis estéticos, vitaminas e ativos, com pedidos pelo WhatsApp.</p>
            <div className="flex flex-1 flex-col justify-center pt-6 pb-2 lg:py-6">
              <p className="load-rise t-lead max-w-[26ch] font-medium" style={delay(120)}>
                {hero?.title ?? 'Saúde, beleza e bem-estar.'}
              </p>
              {hero?.subtitle && (
                <p className="load-rise mt-3 max-w-[46ch] text-base text-[#d6e6fb]" style={delay(220)}>
                  {hero.subtitle}
                </p>
              )}
              <div className="load-rise mt-6 flex flex-wrap gap-3 lg:mt-8" style={delay(320)}>
                <SmartLink to={hero?.button_link || '/produtos'} className="btn bg-white text-brand-dark hover:bg-[#d6effc]">
                  {hero?.button_label || 'Ver produtos'} <ArrowRight className="size-4" />
                </SmartLink>
                {whatsapp && (
                  <a
                    href={whatsappLink(whatsapp, `Olá, ${storeName}!`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn bg-[#0a63cf] text-white hover:bg-[#0b6fe6]"
                  >
                    <MessageCircle className="size-4" /> Falar no WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Lista ativa dos grupos */}
          {showCategories && tree.length > 0 && (
            <div className="mt-28 lg:mt-24">
              <Reveal as="h2" className="t-head font-medium">
                {categoriesTitle}
              </Reveal>
              <ul className="mt-8">
                {tree.map((g, index) => {
                  const isActive = index === active
                  const total = groupCount(g)
                  const [main] = groupColors(index)
                  return (
                    <li
                      key={g.group.id}
                      ref={(el) => {
                        rowsRef.current[index] = el
                      }}
                      data-index={index}
                    >
                      <button
                        type="button"
                        onMouseEnter={() => setActive(index)}
                        onFocus={() => setActive(index)}
                        onClick={() => setActive(index)}
                        aria-expanded={isActive}
                        className={`flex min-h-14 w-full items-center gap-4 text-left transition-colors ${isActive ? 'text-white' : 'text-[#c9dcf7]'}`}
                      >
                        <span className="size-3.5 shrink-0" style={{ backgroundColor: main }} aria-hidden="true" />
                        <span className="t-lead flex-1 font-medium">{g.group.name}</span>
                        <span className="tabular text-base">{total}</span>
                      </button>
                      {isActive && (
                        <div className="pb-5 pl-[1.875rem] text-base text-[#d6e6fb]">
                          {g.children.length > 0 && <p className="max-w-[34ch]">{g.children.map((c) => c.name).join(' · ')}</p>}
                          <Link
                            to={`/produtos?categoria=${g.group.slug}`}
                            className="mt-2 inline-flex min-h-11 items-center gap-1 font-medium text-white underline"
                          >
                            Ver {total} produto(s) <ArrowRight className="size-4" />
                          </Link>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 2. Destaques: prato quadrado com abas
// ---------------------------------------------------------------------------
function Showcase({ title, products }: { title: string; products: CatalogProduct[] }) {
  const [tab, setTab] = useState(0)
  const p = products[Math.min(tab, products.length - 1)]
  if (!p) return null
  const short = (name: string) => name.split(/ [–(-] |\(/)[0].trim()

  return (
    <section className="wrap grid gap-8 py-20 md:grid-cols-2 md:items-stretch md:gap-12 lg:py-32" aria-labelledby="destaques">
      <Reveal className="order-2 md:order-1">
        <Link to={`/produto/${p.slug}`} className="block" aria-label={`Ver ${p.name}`}>
          <ProductImage product={p} className="aspect-square w-full" />
        </Link>
      </Reveal>
      <div className="order-1 flex flex-col md:order-2 md:justify-between">
        <div>
          <Reveal as="h2" id="destaques" className="t-head font-medium">
            {title}
          </Reveal>
          {products.length > 1 && (
            <Reveal i={1} className="mt-6 flex flex-wrap gap-x-6" role="tablist" aria-label={title}>
              {products.map((x, i) => (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={i === tab}
                  onClick={() => setTab(i)}
                  className={`min-h-11 max-w-[18ch] truncate text-base font-medium transition-colors ${i === tab ? 'text-ink underline' : 'text-muted hover:text-ink'}`}
                >
                  {short(x.name)}
                </button>
              ))}
            </Reveal>
          )}
        </div>
        <Reveal i={2} className="mt-6 md:mt-12" role="tabpanel">
          <h3 className="t-lead font-medium">{p.name}</h3>
          <p className="mt-4 max-w-[46ch] text-base text-muted">
            {p.short_description || [p.presentation, p.brand, p.category_name].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-6">
            <PriceBlock product={p} size="lg" />
          </div>
        </Reveal>
        <Reveal i={3} className="mt-8 grid gap-3 sm:grid-cols-2 md:mt-12">
          <ProductAction product={p} />
          <Link to={`/produto/${p.slug}`} className="btn-outline w-full">
            Ver detalhes
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 3. Faixa de produtos (arquivo: o único módulo repetido da página)
// ---------------------------------------------------------------------------
function ProductStrip({
  title,
  link,
  products,
  tone,
}: {
  title: string
  link: string
  products: CatalogProduct[]
  tone: 'white' | 'surface'
}) {
  if (!products.length) return null
  return (
    <section className={tone === 'surface' ? 'bg-[#f4f7fb]' : ''} aria-label={title}>
      <div className="wrap py-20 lg:py-28">
        <div className="mb-10 flex items-end justify-between gap-4">
          <Reveal as="h2" className="t-head font-medium">
            {title}
          </Reveal>
          <Link to={link} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-base font-medium text-ink underline">
            Ver todos <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {products.slice(0, 10).map((p, i) => (
            <Reveal key={p.id} i={i % 5} className={i >= 4 ? 'hidden sm:block' : ''}>
              <ProductCard product={p} tone={tone === 'surface' ? 'white' : 'surface'} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 4. Como comprar: itinerário impresso como um recibo
// ---------------------------------------------------------------------------
const STEPS: { stage: string; rows: [string, string][] }[] = [
  { stage: 'Na loja', rows: [['Escolha os produtos', 'busca e grupos'], ['Adicione ao orçamento', 'botão do produto']] },
  { stage: 'No carrinho', rows: [['Informe nome e WhatsApp', 'seus dados'], ['Confira os itens', 'preço do banco']] },
  { stage: 'No WhatsApp', rows: [['Envie a mensagem pronta', 'WhatsApp da loja']] },
]

function HowItWorks() {
  // Borda inferior em zigue-zague
  const zigzag = useMemo(() => {
    const teeth = 22
    const pts = ['0 0', '100% 0', '100% calc(100% - 12px)']
    for (let i = teeth; i >= 0; i--) pts.push(`${(i / teeth) * 100}% ${i % 2 ? '100%' : 'calc(100% - 12px)'}`)
    return `polygon(${pts.join(',')})`
  }, [])

  return (
    <section className="bg-brand-light" aria-labelledby="como-comprar">
      <div className="wrap grid gap-12 py-20 lg:grid-cols-12 lg:py-32">
        <div className="lg:col-span-5">
          <Reveal as="h2" id="como-comprar" className="t-head font-medium">
            Como comprar
          </Reveal>
          <Reveal i={1} as="p" className="mt-6 max-w-[34ch] text-base">
            Sem cadastro obrigatório e sem pagamento no site: você monta o pedido aqui e a loja confirma valores,
            pagamento e entrega com você pelo WhatsApp.
          </Reveal>
          <Reveal i={2} className="mt-10 max-w-md">
            <img
              src={ACERVO.vidraria1895.src}
              width={ACERVO.vidraria1895.width}
              height={ACERVO.vidraria1895.height}
              alt={ACERVO.vidraria1895.alt}
              loading="lazy"
              decoding="async"
              className="w-full mix-blend-multiply"
            />
          </Reveal>
        </div>
        <Reveal i={1} className="lg:col-span-5 lg:col-start-7">
          <div className="max-w-[30rem] bg-white px-6 pt-6 pb-10 sm:px-8" style={{ clipPath: zigzag }}>
            {STEPS.map((s) => (
              <div key={s.stage} className="mt-7 first:mt-0">
                <p className="text-base font-semibold">{s.stage}</p>
                {s.rows.map(([left, right]) => (
                  <p key={left} className="mt-2 flex items-baseline gap-2 text-base">
                    <span className="min-w-0">{left}</span>
                    <span className="mb-1 min-w-4 flex-1 border-b-4 border-dotted border-[#c3cfdd]" aria-hidden="true" />
                    <span className="shrink-0 text-muted">{right}</span>
                  </p>
                ))}
              </div>
            ))}
            <p className="mt-8 flex min-h-11 items-center justify-between gap-3 bg-ink px-4 text-base text-white">
              <span>A loja confirma o pedido</span>
              <span>pelo WhatsApp</span>
            </p>
          </div>
          <p className="mt-6 max-w-[30rem] text-sm text-muted">
            Itens com prescrição exigem receita ou documentação, avaliadas pelo responsável técnico.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 5. Faixa de cor que quebra o palco dividido (banner secundário editável)
// ---------------------------------------------------------------------------
function ColorBand({ banner }: { banner: Banner | undefined }) {
  const pic = banner?.image_url ? { src: banner.image_url, width: 1400, height: 900, alt: banner.title } : ACERVO.solucoes
  return (
    <section className="grid bg-ink text-white lg:grid-cols-2" aria-labelledby="faixa">
      <div className="wrap flex flex-col justify-center py-20 lg:py-28 lg:pr-12">
        <Reveal as="h2" id="faixa" className="t-head max-w-[16ch] font-medium">
          {banner?.title ?? 'Cada cor, um grupo de produtos'}
        </Reveal>
        <Reveal i={1} as="p" className="mt-6 max-w-[40ch] text-base text-[#cbd5e1]">
          {banner?.subtitle ??
            'Vitaminas, aminoácidos, ativos, estética e correlatos em um só catálogo, com atendimento direto pelo WhatsApp.'}
        </Reveal>
        <Reveal i={2} className="mt-8">
          <SmartLink to={banner?.button_link || '/produtos'} className="btn bg-white text-ink hover:bg-[#e2e8f0]">
            {banner?.button_label || 'Ver o catálogo'} <ArrowRight className="size-4" />
          </SmartLink>
        </Reveal>
      </div>
      <div className="relative min-h-[56svh] overflow-clip lg:min-h-full">
        <img
          src={pic.src}
          width={pic.width}
          height={pic.height}
          alt={pic.alt}
          loading="lazy"
          decoding="async"
          className="scroll-drift absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 6. Contato em linhas grandes
// ---------------------------------------------------------------------------
function Contact() {
  const s = useLoadedSettings()
  const rows: { text: string; href?: string }[] = [
    { text: s.store_name },
    ...(s.address ? [{ text: s.address, href: `https://www.google.com/maps/search/${encodeURIComponent(s.address)}` }] : []),
    ...(s.opening_hours ? [{ text: s.opening_hours }] : []),
    ...(s.whatsapp_number
      ? [{ text: formatPhone(s.whatsapp_number), href: whatsappLink(s.whatsapp_number, `Olá, ${s.store_name}!`) }]
      : []),
    ...(s.contact_email ? [{ text: s.contact_email, href: `mailto:${s.contact_email}` }] : []),
  ]
  const greetingHref = s.whatsapp_number
    ? whatsappLink(s.whatsapp_number, `Olá, ${s.store_name}!`)
    : s.contact_email
      ? `mailto:${s.contact_email}`
      : null

  return (
    <section className="bg-brand-dark text-white" aria-labelledby="contato">
      <h2 id="contato" className="wrap t-head flex min-h-32 items-end gap-5 pb-5 font-normal">
        Fale com a gente
        {greetingHref && (
          <a
            href={greetingHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir conversa"
            className="relative mb-[0.06em] inline-flex size-[0.9em] shrink-0 items-center justify-center rounded-full bg-white text-brand-dark transition-transform before:absolute before:-inset-2 before:content-[''] hover:scale-105 active:scale-95"
          >
            <ArrowUpRight className="size-[0.5em]" />
          </a>
        )}
      </h2>
      {rows.map((r, i) => (
        <Reveal key={r.text + i} i={i} className={i % 2 === 0 ? 'bg-[#064a9e]' : 'bg-brand-dark'}>
          <div className="wrap flex min-h-24 items-end justify-between gap-6 pb-4 md:min-h-32">
            {r.href ? (
              <a
                href={r.href}
                target={r.href.startsWith('mailto') ? undefined : '_blank'}
                rel="noopener noreferrer"
                className="t-head inline-block min-w-0 py-1.5 hover:underline"
              >
                {r.text}
              </a>
            ) : (
              <p className="t-head min-w-0">{r.text}</p>
            )}
            {i === 0 && (
              <img
                src={ACERVO.vitrine1910.src}
                width={ACERVO.vitrine1910.width}
                height={ACERVO.vitrine1910.height}
                alt={ACERVO.vitrine1910.alt}
                loading="lazy"
                decoding="async"
                className="mb-1 size-28 shrink-0 rounded-full object-cover grayscale md:size-40"
              />
            )}
          </div>
        </Reveal>
      ))}
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
  // Sem nada marcado como destaque, a vitrine mostra os primeiros produtos
  const showcase = (featured.length ? featured : (products ?? [])).slice(0, 3)

  return (
    <>
      <SplitStage
        storeName={s.store_name}
        hero={hero[0]}
        tree={tree}
        counts={counts}
        showCategories={s.show_categories}
        categoriesTitle={s.categories_title}
        whatsapp={s.whatsapp_number}
      />

      {products === null ? (
        <PageLoader />
      ) : products.length === 0 ? (
        <div className="wrap py-20">
          <EmptyState title="Em breve, novos produtos por aqui.">
            Os produtos aparecem nesta página assim que forem publicados no painel.
          </EmptyState>
        </div>
      ) : (
        <>
          {s.show_featured && <Showcase title={s.featured_title} products={showcase} />}
          {s.show_bestsellers && (
            <ProductStrip title={s.bestsellers_title} link="/produtos?maisvendidos=1" products={bestsellers} tone="surface" />
          )}
        </>
      )}

      <HowItWorks />

      {products && products.length > 0 && s.show_offers && (
        <ProductStrip title={s.offers_title} link="/produtos?ofertas=1" products={offers} tone="white" />
      )}

      {s.show_secondary_banners && <ColorBand banner={secondary[0]} />}

      <Contact />
    </>
  )
}
