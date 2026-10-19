import { ArrowRight, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Banner } from '../../types'

function BannerButton({ banner, variant }: { banner: Banner; variant: 'light' | 'solid' }) {
  if (!banner.button_label || !banner.button_link) return null
  const cls =
    variant === 'light'
      ? 'btn mt-5 whitespace-nowrap bg-white pr-2 text-brand-dark shadow-sm hover:bg-brand-light'
      : 'btn mt-3 whitespace-nowrap bg-brand-dark text-white hover:bg-brand'
  const content = (
    <>
      {banner.button_label}
      <span className={`flex size-7 items-center justify-center rounded-full ${variant === 'light' ? 'bg-brand text-white' : ''}`}>
        <ArrowRight className="size-4" />
      </span>
    </>
  )
  if (/^https?:\/\//i.test(banner.button_link)) {
    return (
      <a href={banner.button_link} target="_blank" rel="noopener noreferrer" className={cls}>
        {content}
      </a>
    )
  }
  return (
    <Link to={banner.button_link} className={cls}>
      {content}
    </Link>
  )
}

/** Banner principal. Vários banners viram um carrossel simples por rolagem (sem animação automática). */
export function HeroBanners({ banners }: { banners: Banner[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  if (!banners.length) return null

  const onScroll = () => {
    const el = ref.current
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }
  const goTo = (i: number) => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: 'smooth' })

  return (
    <section aria-label="Destaques" className="relative">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {banners.map((b) => (
          <div
            key={b.id}
            className="bg-brand-gradient relative flex min-h-52 w-full shrink-0 snap-center overflow-hidden rounded-3xl sm:min-h-72"
          >
            <Plus className="absolute top-4 right-6 hidden size-24 text-white/15 sm:block" strokeWidth={4} />
            <div className={`relative z-10 flex flex-col justify-center p-6 sm:p-10 ${b.image_url ? 'max-w-[60%] sm:max-w-[50%]' : 'max-w-full sm:max-w-[70%]'}`}>
              {b.eyebrow && (
                <p className="text-xs font-bold tracking-[0.18em] text-white/90 uppercase">{b.eyebrow}</p>
              )}
              <h2 className="mt-2 text-2xl leading-tight font-extrabold text-white sm:text-4xl">{b.title}</h2>
              {b.subtitle && <p className="mt-2 text-sm text-white/90 sm:text-base">{b.subtitle}</p>}
              <div>
                <BannerButton banner={b} variant="light" />
              </div>
            </div>
            {b.image_url && (
              <img
                src={b.image_url}
                alt=""
                className="absolute inset-y-0 right-0 h-full w-[45%] object-contain object-right-bottom p-3 sm:w-1/2"
              />
            )}
          </div>
        ))}
      </div>
      {banners.length > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {banners.map((b, i) => (
            <button
              key={b.id}
              onClick={() => goTo(i)}
              aria-label={`Banner ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-brand' : 'w-2 bg-brand/25'}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export function SecondaryBanner({ banner }: { banner: Banner }) {
  return (
    <div className="relative flex min-h-36 overflow-hidden rounded-3xl bg-gradient-to-r from-brand-light to-white ring-1 ring-brand/10">
      <div className={`relative z-10 flex flex-col justify-center p-5 sm:p-8 ${banner.image_url ? 'max-w-[65%]' : 'max-w-full sm:max-w-[75%]'}`}>
        {banner.eyebrow && <p className="text-xs font-bold tracking-wider text-brand uppercase">{banner.eyebrow}</p>}
        <h3 className="text-xl font-extrabold text-brand-dark sm:text-2xl">{banner.title}</h3>
        {banner.subtitle && <p className="mt-1 text-sm text-slate-600">{banner.subtitle}</p>}
        <div>
          <BannerButton banner={banner} variant="solid" />
        </div>
      </div>
      {banner.image_url && (
        <img src={banner.image_url} alt="" className="absolute inset-y-0 right-0 h-full w-[40%] object-contain p-2" />
      )}
    </div>
  )
}
