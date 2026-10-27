import { Link } from 'react-router'
import { useLoadedSettings } from '../../contexts/SettingsContext'

/**
 * Marca da Glow Slim Farma redesenhada para ler bem em tamanho pequeno: círculo chapado
 * no azul da marca, cruz branca de pontas arredondadas e um ponto de "brilho" (glow).
 * Sem gradientes, como o resto do sistema. O desenho é o mesmo do favicon.
 */
export function BrandMark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={`shrink-0 ${className}`} aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="var(--brand, #1677F2)" />
      <path d="M24 13v22M13 24h22" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
      <circle cx="35.5" cy="12.5" r="4.5" fill="#7DD3FC" stroke="var(--brand, #1677F2)" strokeWidth="2" />
    </svg>
  )
}

/**
 * Logotipo: marca + nome em texto real (Inter), nítido em qualquer tamanho.
 * `size` controla a altura; `tone="dark"` é para fundos escuros.
 */
export function BrandLogo({
  name,
  size = 'md',
  tone = 'light',
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  tone?: 'light' | 'dark'
}) {
  // "Glow Slim Farma" → "Glow Slim" em negrito + "Farma" em azul (a última palavra)
  const words = name.trim().split(/\s+/)
  const lead = words.length > 1 ? words.slice(0, -1).join(' ') : words[0]
  const tail = words.length > 1 ? words[words.length - 1] : ''
  const mark = { sm: 'size-8', md: 'size-9', lg: 'size-12' }[size]
  const text = { sm: 'text-lg', md: 'text-xl', lg: 'text-[1.75rem]' }[size]
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className={mark} />
      <span className={`${text} leading-none font-bold tracking-[-0.03em] whitespace-nowrap ${tone === 'dark' ? 'text-white' : 'text-brand-dark'}`}>
        {lead}
        {tail && <span className={`ml-[0.28em] font-medium ${tone === 'dark' ? 'text-[#7DD3FC]' : 'text-brand'}`}>{tail}</span>}
      </span>
    </span>
  )
}

export function Logo({ className = 'h-11', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = useLoadedSettings()
  return (
    <Link to="/" className="flex shrink-0 items-center" aria-label={`${s.store_name} — página inicial`}>
      {/* logo enviado no painel tem prioridade; sem ele, a marca desenhada */}
      {s.logo_url ? (
        <img src={s.logo_url} alt={s.store_name} className={`${className} w-auto object-contain`} />
      ) : (
        <BrandLogo name={s.store_name} size={size} />
      )}
    </Link>
  )
}
