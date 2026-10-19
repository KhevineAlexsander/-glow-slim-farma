import Papa from 'papaparse'
import { slugify } from './slug'

/**
 * Importação de produtos por CSV.
 * Colunas aceitas (cabeçalho, sem diferenciar maiúsculas/acentos):
 *   nome*, referencia, marca, categoria, descricao_curta, descricao, composicao,
 *   apresentacao, via_aplicacao, requer_prescricao, venda_restrita, revisar,
 *   observacoes_revisao, catalogo_origem, pagina_origem, imagem_url
 * Qualquer coluna de preço é IGNORADA: todo produto importado começa em R$ 0,00.
 */

export interface ImportRowData {
  name: string
  sku: string | null
  brand: string | null
  category: string | null
  short_description: string | null
  description: string | null
  composition: string | null
  presentation: string | null
  usage_route: string | null
  requires_prescription: boolean
  restricted_sale: boolean
  needs_review: boolean
  review_notes: string | null
  source_catalog: string | null
  source_page: number | null
  image_url: string | null
}

export interface ImportRow {
  line: number
  data: ImportRowData
  errors: string[]
  warnings: string[]
  /** Produto já existente que corresponde a esta linha (por referência ou slug). */
  duplicateOf: { id: string; by: 'referência' | 'nome' } | null
  /** Linha repetida dentro do próprio arquivo. */
  duplicateInFile: boolean
}

export interface ParsedImport {
  rows: ImportRow[]
  ignoredColumns: string[]
  fatal: string | null
}

const ALIASES: Record<keyof ImportRowData, string[]> = {
  name: ['nome', 'produto', 'name'],
  sku: ['referencia', 'ref', 'codigo', 'sku', 'cod'],
  brand: ['marca', 'laboratorio', 'fabricante', 'brand'],
  category: ['categoria', 'category'],
  short_description: ['descricao_curta', 'resumo'],
  description: ['descricao', 'description'],
  composition: ['composicao', 'formula'],
  presentation: ['apresentacao', 'embalagem', 'quantidade'],
  usage_route: ['via_aplicacao', 'via', 'aplicacao', 'uso'],
  requires_prescription: ['requer_prescricao', 'prescricao', 'receita'],
  restricted_sale: ['venda_restrita', 'restrito', 'uso_profissional'],
  needs_review: ['revisar', 'precisa_revisao', 'revisao'],
  review_notes: ['observacoes_revisao', 'observacoes', 'obs'],
  source_catalog: ['catalogo_origem', 'catalogo', 'origem'],
  source_page: ['pagina_origem', 'pagina'],
  image_url: ['imagem_url', 'imagem', 'foto'],
}

const PRICE_COLUMNS = ['preco', 'valor', 'price', 'preco_promocional', 'r$']

function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function text(v: unknown, max: number, field: string, warnings: string[]): string | null {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  if (s.length > max) {
    warnings.push(`${field} foi cortado para ${max} caracteres.`)
    return s.slice(0, max)
  }
  return s
}

function bool(v: unknown, field: string, errors: string[]): boolean {
  if (v == null) return false
  const s = normalizeHeader(String(v))
  if (s === '') return false
  if (['sim', 's', 'true', '1', 'x', 'yes'].includes(s)) return true
  if (['nao', 'n', 'false', '0', 'no'].includes(s)) return false
  errors.push(`${field}: valor "${v}" inválido (use sim/não).`)
  return false
}

export interface ExistingProductKey {
  id: string
  sku: string | null
  slug: string
}

export function parseProductsCsv(csv: string, existing: ExistingProductKey[]): ParsedImport {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
  })

  const headers = parsed.meta.fields ?? []
  const fieldFor = new Map<string, keyof ImportRowData>()
  const ignoredColumns: string[] = []
  for (const h of headers) {
    const key = (Object.keys(ALIASES) as (keyof ImportRowData)[]).find((k) => ALIASES[k].includes(h))
    if (key) fieldFor.set(h, key)
    else ignoredColumns.push(h)
  }
  if (![...fieldFor.values()].includes('name')) {
    return { rows: [], ignoredColumns, fatal: 'O arquivo precisa ter uma coluna "nome".' }
  }
  const priceIgnored = ignoredColumns.some((c) => PRICE_COLUMNS.some((p) => c.startsWith(p)))

  const bySku = new Map(existing.filter((e) => e.sku).map((e) => [e.sku!.toLowerCase(), e.id]))
  const bySlug = new Map(existing.map((e) => [e.slug, e.id]))
  const seenInFile = new Set<string>()

  const rows: ImportRow[] = parsed.data.map((raw, i) => {
    const errors: string[] = []
    const warnings: string[] = []
    const get = (k: keyof ImportRowData) => {
      for (const [h, key] of fieldFor) if (key === k && raw[h] != null && String(raw[h]).trim() !== '') return raw[h]
      return undefined
    }

    const name = text(get('name'), 200, 'Nome', warnings) ?? ''
    if (name.length < 2) errors.push('Nome ausente ou muito curto.')

    let sourcePage: number | null = null
    const pageRaw = get('source_page')
    if (pageRaw != null) {
      const n = Number(String(pageRaw).trim())
      if (Number.isInteger(n) && n > 0) sourcePage = n
      else warnings.push(`Página de origem "${pageRaw}" ignorada.`)
    }

    const imageUrl = text(get('image_url'), 1000, 'Imagem', warnings)
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      warnings.push('URL da imagem ignorada (precisa começar com http:// ou https://).')
    }

    const data: ImportRowData = {
      name,
      sku: text(get('sku'), 60, 'Referência', warnings),
      brand: text(get('brand'), 120, 'Marca', warnings),
      category: text(get('category'), 80, 'Categoria', warnings),
      short_description: text(get('short_description'), 300, 'Descrição curta', warnings),
      description: text(get('description'), 10000, 'Descrição', warnings),
      composition: text(get('composition'), 5000, 'Composição', warnings),
      presentation: text(get('presentation'), 120, 'Apresentação', warnings),
      usage_route: text(get('usage_route'), 60, 'Via de aplicação', warnings),
      requires_prescription: bool(get('requires_prescription'), 'Requer prescrição', errors),
      restricted_sale: bool(get('restricted_sale'), 'Venda restrita', errors),
      needs_review: bool(get('needs_review'), 'Revisar', errors),
      review_notes: text(get('review_notes'), 5000, 'Observações', warnings),
      source_catalog: text(get('source_catalog'), 200, 'Catálogo', warnings),
      source_page: sourcePage,
      image_url: imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : null,
    }

    if (!data.category) warnings.push('Sem categoria.')

    const slug = slugify(name)
    let duplicateOf: ImportRow['duplicateOf'] = null
    if (data.sku && bySku.has(data.sku.toLowerCase())) {
      duplicateOf = { id: bySku.get(data.sku.toLowerCase())!, by: 'referência' }
    } else if (!data.sku && bySlug.has(slug)) {
      duplicateOf = { id: bySlug.get(slug)!, by: 'nome' }
    }

    const fileKey = data.sku ? `sku:${data.sku.toLowerCase()}` : `slug:${slug}`
    const duplicateInFile = seenInFile.has(fileKey)
    if (duplicateInFile) errors.push('Linha repetida no arquivo (mesma referência/nome).')
    seenInFile.add(fileKey)

    return { line: i + 2, data, errors, warnings, duplicateOf, duplicateInFile }
  })

  if (priceIgnored) {
    for (const r of rows) r.warnings.unshift('Coluna de preço ignorada: o produto será criado com R$ 0,00.')
  }

  return { rows, ignoredColumns, fatal: parsed.errors.length && !rows.length ? parsed.errors[0].message : null }
}

export const CSV_TEMPLATE_HEADERS = [
  'nome',
  'referencia',
  'marca',
  'categoria',
  'descricao_curta',
  'descricao',
  'composicao',
  'apresentacao',
  'via_aplicacao',
  'requer_prescricao',
  'venda_restrita',
  'revisar',
  'observacoes_revisao',
  'catalogo_origem',
  'pagina_origem',
  'imagem_url',
]
