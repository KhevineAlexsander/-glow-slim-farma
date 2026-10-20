import { useId } from 'react'

/**
 * Imagem padrão para produtos sem foto: um vidro (frasco ou ampola) desenhado em SVG.
 * O desenho é sempre o mesmo; só as cores principais mudam. A cor sai do slug do
 * produto: cada produto tem sempre a mesma cor (loja e painel) e a vitrine fica variada.
 */

// [cor principal, cor escura] — tons que combinam com a identidade azul da marca
const PALETTE: [string, string][] = [
  ['#1677F2', '#0756B5'], // azul
  ['#22A9E8', '#0E7DB3'], // ciano
  ['#8B5CF6', '#6D28D9'], // violeta
  ['#EC4899', '#BE185D'], // rosa
  ['#F59E0B', '#B45309'], // âmbar
  ['#10B981', '#047857'], // esmeralda
  ['#F97316', '#C2410C'], // laranja
  ['#14B8A6', '#0F766E'], // turquesa
  ['#EF4444', '#B91C1C'], // vermelho
  ['#6366F1', '#4338CA'], // índigo
  ['#84CC16', '#4D7C0F'], // verde-limão
  ['#D946EF', '#A21CAF'], // magenta
]

function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

export function vialColors(seed: string): [string, string] {
  return PALETTE[hash(seed || 'glow') % PALETTE.length]
}

/** Ampola quando a apresentação/nome fala em ampola; senão, frasco. */
export function vialKind(text: string): 'ampola' | 'frasco' {
  return /ampola/i.test(text) ? 'ampola' : 'frasco'
}

export function VialArt({
  seed,
  kind = 'frasco',
  className = '',
  title,
}: {
  seed: string
  kind?: 'ampola' | 'frasco'
  className?: string
  title?: string
}) {
  const id = useId().replace(/:/g, '')
  const [main, dark] = vialColors(seed)

  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={title ?? 'Imagem ilustrativa do produto'}>
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={main} stopOpacity="0.10" />
          <stop offset="1" stopColor={main} stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id={`liq${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={dark} />
          <stop offset="0.45" stopColor={main} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`glass${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={`cap${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={dark} />
          <stop offset="0.5" stopColor={main} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>

      <rect width="200" height="200" fill={`url(#bg${id})`} />
      {/* brilho decorativo */}
      <circle cx="160" cy="40" r="26" fill="#ffffff" opacity="0.35" />
      <ellipse cx="100" cy="174" rx="44" ry="7" fill={dark} opacity="0.18" />

      {kind === 'frasco' ? (
        <g>
          {/* tampa flip-off colorida + lacre de alumínio */}
          <rect x="76" y="34" width="48" height="16" rx="5" fill={`url(#cap${id})`} />
          <rect x="82" y="48" width="36" height="18" rx="3" fill="#CBD5E1" />
          <rect x="82" y="48" width="36" height="4" fill="#94A3B8" opacity="0.6" />
          {/* corpo de vidro */}
          <rect x="66" y="64" width="68" height="106" rx="14" fill={`url(#glass${id})`} stroke="#CBD5E1" strokeWidth="2" />
          {/* líquido */}
          <path d="M68 104 H132 V156 a12 12 0 0 1 -12 12 H80 a12 12 0 0 1 -12 -12 Z" fill={`url(#liq${id})`} opacity="0.92" />
          {/* rótulo */}
          <rect x="72" y="112" width="56" height="34" rx="4" fill="#ffffff" opacity="0.95" />
          <rect x="78" y="118" width="30" height="5" rx="2.5" fill={dark} />
          <rect x="78" y="127" width="44" height="3.5" rx="1.75" fill={main} opacity="0.55" />
          <rect x="78" y="134" width="36" height="3.5" rx="1.75" fill={main} opacity="0.35" />
          {/* reflexo do vidro */}
          <rect x="73" y="70" width="6" height="92" rx="3" fill="#ffffff" opacity="0.75" />
        </g>
      ) : (
        <g>
          {/* ponta da ampola */}
          <path d="M94 30 Q100 22 106 30 L108 56 Q100 62 92 56 Z" fill={`url(#glass${id})`} stroke="#CBD5E1" strokeWidth="2" />
          {/* anel de quebra colorido */}
          <rect x="90" y="60" width="20" height="6" rx="3" fill={`url(#cap${id})`} />
          {/* gargalo + ombro + corpo */}
          <path
            d="M93 66 H107 Q107 80 122 92 Q128 97 128 106 V158 a12 12 0 0 1 -12 12 H84 a12 12 0 0 1 -12 -12 V106 Q72 97 78 92 Q93 80 93 66 Z"
            fill={`url(#glass${id})`}
            stroke="#CBD5E1"
            strokeWidth="2"
          />
          {/* líquido */}
          <path d="M74 112 H126 V157 a11 11 0 0 1 -11 11 H85 a11 11 0 0 1 -11 -11 Z" fill={`url(#liq${id})`} opacity="0.92" />
          {/* rótulo */}
          <rect x="78" y="120" width="44" height="28" rx="4" fill="#ffffff" opacity="0.95" />
          <rect x="83" y="126" width="24" height="5" rx="2.5" fill={dark} />
          <rect x="83" y="135" width="34" height="3.5" rx="1.75" fill={main} opacity="0.5" />
          {/* reflexo */}
          <rect x="79" y="100" width="5" height="62" rx="2.5" fill="#ffffff" opacity="0.75" />
        </g>
      )}
    </svg>
  )
}
