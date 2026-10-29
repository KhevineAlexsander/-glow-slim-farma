import { STORAGE_BUCKET, supabase } from '../lib/supabase'
import { normalizeSearch, sanitizeSearch } from './catalog'
import type {
  Banner,
  Category,
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusHistory,
  Product,
  ProductImage,
  ProductStatus,
  StoreSettings,
} from '../types'

// -----------------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------------
export interface DashboardStats {
  products_total: number
  products_published: number
  products_no_price: number
  products_review: number
  categories_total: number
  orders_total: number
  orders_new: number
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('admin_dashboard_stats')
  if (error) throw error
  return data as DashboardStats
}

// -----------------------------------------------------------------------------
// Produtos
// -----------------------------------------------------------------------------
export interface ProductListQuery {
  search?: string
  status?: ProductStatus | 'active' | ''
  categoryId?: string
  /** Grupo selecionado: o próprio id e os das subcategorias. */
  categoryIds?: string[]
  noPrice?: boolean
  needsReview?: boolean
  page: number
  pageSize: number
}

export type ProductRow = Product & { product_images: { url: string; sort_order: number }[] }

export async function listProducts(q: ProductListQuery): Promise<{ rows: ProductRow[]; total: number }> {
  let query = supabase
    .from('products')
    .select('*, product_images(url, sort_order)', { count: 'exact' })
    .order('updated_at', { ascending: false })

  const term = q.search ? normalizeSearch(q.search) : ''
  if (term) query = query.like('search_text', `%${term}%`)
  if (q.status === 'active') query = query.neq('status', 'archived')
  else if (q.status) query = query.eq('status', q.status)
  if (q.categoryId === 'none') query = query.is('category_id', null)
  else if (q.categoryIds?.length) query = query.in('category_id', q.categoryIds)
  else if (q.categoryId) query = query.eq('category_id', q.categoryId)
  if (q.noPrice) query = query.eq('price_cents', 0)
  if (q.needsReview) query = query.eq('needs_review', true)

  const from = (q.page - 1) * q.pageSize
  const { data, error, count } = await query.range(from, from + q.pageSize - 1)
  if (error) throw error
  return { rows: data as ProductRow[], total: count ?? 0 }
}

export async function getProduct(id: string): Promise<Product> {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
  if (error) throw error
  return data as Product
}

export type ProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at'>

/** Campos que só o banco controla (chave, datas e colunas calculadas). */
const DB_MANAGED = ['id', 'created_at', 'updated_at', 'public_price_cents', 'public_promo_price_cents', 'search_text', 'product_images']

function writable(input: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([k]) => !DB_MANAGED.includes(k)))
}

/** Cria o produto (o banco força preço zero na criação). */
export async function createProduct(input: Partial<ProductInput>): Promise<Product> {
  const { data, error } = await supabase.from('products').insert(writable(input)).select('*').single()
  if (error) throw error
  return data as Product
}

export async function updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product> {
  const { data, error } = await supabase.from('products').update(writable(patch)).eq('id', id).select('*').single()
  if (error) throw error
  return data as Product
}

export async function updateProductPrice(id: string, priceCents: number, promoCents: number | null) {
  return updateProduct(id, { price_cents: priceCents, promo_price_cents: promoCents })
}

export async function deleteProduct(id: string) {
  const { data: images } = await supabase.from('product_images').select('storage_path').eq('product_id', id)
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
  const paths = (images ?? []).map((i) => i.storage_path).filter((p): p is string => Boolean(p))
  if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths)
}

export async function fetchExistingProductKeys() {
  const all: { id: string; sku: string | null; slug: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('products')
      .select('id, sku, slug')
      .range(from, from + 999)
    if (error) throw error
    all.push(...data)
    if (data.length < 1000) break
  }
  return all
}

// -----------------------------------------------------------------------------
// Imagens
// -----------------------------------------------------------------------------
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']

export function validateImageFile(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Formato não suportado. Use JPG, PNG, WEBP, GIF ou SVG.'
  if (file.size > MAX_IMAGE_BYTES) return 'A imagem deve ter no máximo 5 MB.'
  return null
}

/** Envia uma imagem para o storage e devolve a URL pública. */
export async function uploadImage(file: File, folder: string): Promise<{ url: string; path: string }> {
  const problem = validateImageFile(file)
  if (problem) throw new Error(problem)
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
  })
  if (error) throw error
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

export async function removeStoredImage(path: string | null) {
  if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path])
}

export async function listProductImages(productId: string): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return data as ProductImage[]
}

export async function addProductImage(productId: string, image: { url: string; path: string | null }, sortOrder: number) {
  const { error } = await supabase
    .from('product_images')
    .insert({ product_id: productId, url: image.url, storage_path: image.path, sort_order: sortOrder })
  if (error) throw error
}

export async function deleteProductImage(img: ProductImage) {
  const { error } = await supabase.from('product_images').delete().eq('id', img.id)
  if (error) throw error
  await removeStoredImage(img.storage_path)
}

export async function reorderProductImages(images: ProductImage[]) {
  await Promise.all(
    images.map((img, i) => supabase.from('product_images').update({ sort_order: i }).eq('id', img.id)),
  )
}

// -----------------------------------------------------------------------------
// Categorias
// -----------------------------------------------------------------------------
export async function listAllCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order').order('name')
  if (error) throw error
  return data as Category[]
}

export async function saveCategory(c: Partial<Category> & { name: string; slug: string }): Promise<Category> {
  const { id, ...fields } = c
  const req = id
    ? supabase.from('categories').update(fields).eq('id', id)
    : supabase.from('categories').insert(fields)
  const { data, error } = await req.select('*').single()
  if (error) throw error
  return data as Category
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

export async function countProductsByCategory(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('products').select('category_id').neq('status', 'archived')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const r of data) if (r.category_id) counts[r.category_id] = (counts[r.category_id] ?? 0) + 1
  return counts
}

// -----------------------------------------------------------------------------
// Banners
// -----------------------------------------------------------------------------
export async function listAllBanners(): Promise<Banner[]> {
  const { data, error } = await supabase.from('banners').select('*').order('placement').order('sort_order')
  if (error) throw error
  return data as Banner[]
}

export async function saveBanner(b: Partial<Banner> & { title: string }): Promise<Banner> {
  const { id, ...fields } = b
  const req = id ? supabase.from('banners').update(fields).eq('id', id) : supabase.from('banners').insert(fields)
  const { data, error } = await req.select('*').single()
  if (error) throw error
  return data as Banner
}

export async function deleteBanner(id: string) {
  const { error } = await supabase.from('banners').delete().eq('id', id)
  if (error) throw error
}

// -----------------------------------------------------------------------------
// Configurações
// -----------------------------------------------------------------------------
export async function updateSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  const { data, error } = await supabase.from('store_settings').update(patch).eq('id', 1).select('*').single()
  if (error) throw error
  return data as StoreSettings
}

// -----------------------------------------------------------------------------
// Pedidos
// -----------------------------------------------------------------------------
export async function listOrders(q: {
  status?: OrderStatus | ''
  search?: string
  page: number
  pageSize: number
}): Promise<{ rows: Order[]; total: number }> {
  let query = supabase.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  if (q.status) query = query.eq('status', q.status)
  const term = q.search ? sanitizeSearch(q.search) : ''
  if (term) {
    const digits = term.replace(/\D/g, '')
    const filters = [`customer_name.ilike.%${term}%`]
    if (digits) {
      filters.push(`customer_phone.ilike.%${digits}%`)
      if (digits.length <= 12) filters.push(`order_number.eq.${digits}`)
    }
    query = query.or(filters.join(','))
  }
  const from = (q.page - 1) * q.pageSize
  const { data, error, count } = await query.range(from, from + q.pageSize - 1)
  if (error) throw error
  return { rows: data as Order[], total: count ?? 0 }
}

export async function getOrder(id: string) {
  const [order, items, history] = await Promise.all([
    supabase.from('orders').select('*').eq('id', id).single(),
    supabase.from('order_items').select('*').eq('order_id', id).order('created_at'),
    supabase.from('order_status_history').select('*').eq('order_id', id).order('created_at'),
  ])
  if (order.error) throw order.error
  if (items.error) throw items.error
  if (history.error) throw history.error
  return {
    order: order.data as Order,
    items: items.data as OrderItem[],
    history: history.data as OrderStatusHistory[],
  }
}

export async function updateOrder(
  id: string,
  patch: Partial<Pick<Order, 'status' | 'admin_notes' | 'documents_verified'>>,
): Promise<Order> {
  const { data, error } = await supabase.from('orders').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as Order
}

// -----------------------------------------------------------------------------
// Alertas de pedido novo (o painel consulta a cada poucos segundos)
// -----------------------------------------------------------------------------
export type OrderAlert = Pick<Order, 'id' | 'order_number' | 'kind' | 'customer_name' | 'total_cents' | 'has_unpriced_items' | 'created_at'>

/** Pedidos criados depois de `since` (ISO), do mais antigo para o mais novo. */
export async function fetchOrdersSince(since: string): Promise<OrderAlert[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, kind, customer_name, total_cents, has_unpriced_items, created_at')
    .gt('created_at', since)
    .order('created_at', { ascending: true })
    .limit(20)
  if (error) throw error
  return data as OrderAlert[]
}

/** Momento do pedido mais recente (ponto de partida dos alertas, pelo relógio do banco). */
export async function latestOrderAt(): Promise<string> {
  const { data, error } = await supabase.from('orders').select('created_at').order('created_at', { ascending: false }).limit(1)
  if (error) throw error
  return data?.[0]?.created_at ?? new Date(0).toISOString()
}

/** Quantos pedidos estão com status "Novo" (a fila que precisa de resposta). */
export async function countNewOrders(): Promise<number> {
  const { count, error } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'new')
  if (error) throw error
  return count ?? 0
}
