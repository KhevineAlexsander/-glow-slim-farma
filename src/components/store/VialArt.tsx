import { buildCategoryTree, groupOf } from '../../lib/categoryTree'
import type { Category } from '../../types'

/**
 * Imagem padrão para produtos sem foto: um vidro (frasco ou ampola) desenhado em SVG.
 * O desenho é sempre o mesmo; só as cores principais mudam. A cor é a do grupo de
 * categorias do produto (loja, página inicial e painel usam a mesma), então a cor diz
 * o grupo. Produto sem categoria cai numa cor tirada do seu slug.
 * Cores chapadas (sem gradientes) e sem violeta/índigo, conforme a TasteSkill.
 */

// Uma cor por grupo, na ordem dos grupos; matizes bem separadas entre si.
const GROUP_PALETTE: [string, string][] = [
  ['#1677F2', '#0756B5'], // azul da marca
  ['#0EA5A4', '#0B6B6A'], // turquesa
  ['#EC4899', '#BE185D'], // rosa
  ['#F59E0B', '#B45309'], // âmbar
  ['#16A34A', '#166534'], // verde
  ['#EF4444', '#B91C1C'], // vermelho
]

/** Cores do grupo na posição `index` da árvore de categorias. */
export function groupColors(index: number): [string, string] {
  return GROUP_PALETTE[((index % GROUP_PALETTE.length) + GROUP_PALETTE.length) % GROUP_PALETTE.length]
}

/** Cores do frasco de um produto: as do grupo da sua categoria. */
export function categoryColors(categorySlug: string | null | undefined, categories: Category[]): [string, string] | undefined {
  if (!categorySlug) return undefined
  const group = groupOf(categorySlug, categories)
  if (!group) return undefined
  const index = buildCategoryTree(categories).findIndex((g) => g.group.id === group.id)
  return index >= 0 ? groupColors(index) : undefined
}

// Reserva para produtos sem grupo. [cor principal, cor escura]
const PALETTE: [string, string][] = [
  ['#1677F2', '#0756B5'], // azul da marca
  ['#22A9E8', '#0B76A8'], // ciano
  ['#0EA5A4', '#0B6B6A'], // turquesa
  ['#10B981', '#047857'], // esmeralda
  ['#65A30D', '#3F6212'], // verde-limão
  ['#F59E0B', '#B45309'], // âmbar
  ['#F97316', '#C2410C'], // laranja
  ['#EF4444', '#B91C1C'], // vermelho
  ['#EC4899', '#BE185D'], // rosa
  ['#E11D48', '#9F1239'], // framboesa
  ['#0369A1', '#0C4A6E'], // azul-petróleo
  ['#16A34A', '#166534'], // verde
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
  color,
  kind = 'frasco',
  className = '',
  title,
  background = true,
}: {
  seed: string
  /** Cores explícitas (o palco do topo usa as cores do grupo ativo). */
  color?: [string, string]
  kind?: 'ampola' | 'frasco'
  className?: string
  title?: string
  background?: boolean
}) {
  const [main, dark] = color ?? vialColors(seed)
  const glass = '#ffffff'
  const metal = '#CBD5E1'
  const edge = '#94A3B8'

  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={title ?? 'Imagem ilustrativa do produto'}>
      {background && (
        <>
          <rect width="200" height="200" fill={main} opacity="0.14" />
          <rect y="168" width="200" height="32" fill={main} opacity="0.1" />
        </>
      )}
      <ellipse cx="100" cy="171" rx="42" ry="5" fill={dark} opacity="0.18" />

      {kind === 'frasco' ? (
        <g style={{ transition: 'fill 300ms' }}>
          {/* tampa flip-off colorida + lacre de alumínio */}
          <rect x="76" y="34" width="48" height="16" rx="4" fill={main} />
          <rect x="76" y="44" width="48" height="6" fill={dark} />
          <rect x="82" y="50" width="36" height="16" fill={metal} />
          <rect x="82" y="50" width="36" height="4" fill={edge} opacity="0.7" />
          {/* corpo de vidro */}
          <rect x="66" y="64" width="68" height="106" rx="12" fill={glass} stroke={metal} strokeWidth="2.5" />
          {/* líquido */}
          <path d="M68 102 H132 V158 a10 10 0 0 1 -10 10 H78 a10 10 0 0 1 -10 -10 Z" fill={main} />
          <rect x="68" y="102" width="64" height="6" fill={dark} opacity="0.35" />
          {/* rótulo */}
          <rect x="72" y="114" width="56" height="34" fill={glass} />
          <rect x="78" y="120" width="30" height="5" fill={dark} />
          <rect x="78" y="129" width="44" height="3.5" fill={main} />
          <rect x="78" y="136" width="34" height="3.5" fill={metal} />
          {/* reflexo */}
          <rect x="73" y="70" width="6" height="30" rx="3" fill={metal} opacity="0.55" />
        </g>
      ) : (
        <g>
          {/* ponta da ampola */}
          <path d="M94 30 Q100 22 106 30 L108 56 Q100 62 92 56 Z" fill={glass} stroke={metal} strokeWidth="2.5" />
          {/* anel de quebra colorido */}
          <rect x="90" y="60" width="20" height="6" rx="3" fill={main} />
          {/* gargalo + ombro + corpo */}
          <path
            d="M93 66 H107 Q107 80 122 92 Q128 97 128 106 V158 a12 12 0 0 1 -12 12 H84 a12 12 0 0 1 -12 -12 V106 Q72 97 78 92 Q93 80 93 66 Z"
            fill={glass}
            stroke={metal}
            strokeWidth="2.5"
          />
          {/* líquido */}
          <path d="M74 112 H126 V157 a11 11 0 0 1 -11 11 H85 a11 11 0 0 1 -11 -11 Z" fill={main} />
          <rect x="74" y="112" width="52" height="5" fill={dark} opacity="0.35" />
          {/* rótulo */}
          <rect x="78" y="122" width="44" height="28" fill={glass} />
          <rect x="83" y="128" width="24" height="5" fill={dark} />
          <rect x="83" y="137" width="34" height="3.5" fill={main} />
          {/* reflexo */}
          <rect x="79" y="96" width="5" height="12" rx="2.5" fill={metal} opacity="0.55" />
        </g>
      )}
    </svg>
  )
}
