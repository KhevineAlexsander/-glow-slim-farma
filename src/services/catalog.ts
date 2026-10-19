import { supabase } from '../lib/supabase'
import type { Banner, CatalogProduct, Category, PlacedOrder } from '../types'

/** Remove caracteres com significado especial nos filtros do PostgREST. */
export function sanitizeSearch(term: string): string {
  return term.replace(/[,()%*\\:"']/g, ' ').trim().slice(0, 80)
}

/** Igual à normalização do banco (search_normalize): sem acentos e minúsculo. */
export function normalizeSearch(term: string): string {
  return sanitizeSearch(term)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Categorias visíveis que têm ao menos um produto publicado (evita páginas vazias). */
export async function fetchCategories(): Promise<Category[]> {
  const [cats, used] = await Promise.all([
    supabase.from('categories').select('*').eq('is_visible', true).order('sort_order').order('name'),
    supabase.from('catalog_products').select('category_id').not('category_id', 'is', null),
  ])
  if (cats.error) throw cats.error
  if (used.error) throw used.error
  const withProducts = new Set(used.data.map((r) => r.category_id as string))
  return (cats.data as Category[]).filter((c) => withProducts.has(c.id))
}

export async function fetchBanners(placement: 'hero' | 'secondary'): Promise<Banner[]> {
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .eq('is_active', true)
    .eq('placement', placement)
    .order('sort_order')
  if (error) throw error
  return data as Banner[]
}

export type CatalogSort = 'relevance' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc'

export interface CatalogQuery {
  search?: string
  categorySlug?: string
  sort?: CatalogSort
  flag?: 'is_featured' | 'is_bestseller' | 'is_offer'
  limit?: number
}

export async function fetchCatalog(q: CatalogQuery = {}): Promise<CatalogProduct[]> {
  let query = supabase.from('catalog_products').select('*')
  const term = q.search ? normalizeSearch(q.search) : ''
  if (term) query = query.like('search_text', `%${term}%`)
  if (q.categorySlug) query = query.eq('category_slug', q.categorySlug)
  if (q.flag) query = query.eq(q.flag, true)

  switch (q.sort) {
    case 'name_asc':
      query = query.order('name')
      break
    case 'name_desc':
      query = query.order('name', { ascending: false })
      break
    default:
      query = query.order('sort_order').order('name')
  }
  query = query.limit(q.limit ?? 500)

  const { data, error } = await query
  if (error) throw error
  return data as CatalogProduct[]
}

export async function fetchProductBySlug(slug: string): Promise<CatalogProduct | null> {
  const { data, error } = await supabase.from('catalog_products').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data as CatalogProduct | null
}

export async function fetchProductsByIds(ids: string[]): Promise<CatalogProduct[]> {
  if (!ids.length) return []
  const { data, error } = await supabase.from('catalog_products').select('*').in('id', ids)
  if (error) throw error
  return data as CatalogProduct[]
}

export interface CustomerInput {
  name: string
  phone: string
  email?: string
  city?: string
  notes?: string
}

export async function placeOrder(
  customer: CustomerInput,
  items: { product_id: string; quantity: number }[],
): Promise<PlacedOrder> {
  const { data, error } = await supabase.rpc('place_order', { p_customer: customer, p_items: items })
  if (error) throw error
  return data as PlacedOrder
}
