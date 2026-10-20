export type ProductStatus = 'draft' | 'published' | 'archived'
export type SalesMode = 'order' | 'quote'
export type NoPriceLabel = 'consult' | 'whatsapp'
export type OrderStatus = 'new' | 'in_review' | 'confirmed' | 'completed' | 'cancelled'
export type OrderKind = 'order' | 'quote'

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  image_url: string | null
  sort_order: number
  is_visible: boolean
  /** Grupo (categoria-mãe). null = é um grupo ou categoria solta. */
  parent_id: string | null
}

/** Produto como exposto pela view pública `catalog_products`. */
export interface CatalogProduct {
  id: string
  name: string
  slug: string
  sku: string | null
  brand: string | null
  category_id: string | null
  category_name: string | null
  category_slug: string | null
  short_description: string | null
  description: string | null
  composition: string | null
  presentation: string | null
  usage_route: string | null
  price_cents: number
  promo_price_cents: number | null
  track_stock: boolean
  is_available: boolean
  is_featured: boolean
  is_bestseller: boolean
  is_offer: boolean
  requires_prescription: boolean
  restricted_sale: boolean
  sort_order: number
  created_at: string
  images: { url: string; alt: string | null }[]
}

/** Produto completo (somente painel). */
export interface Product {
  id: string
  name: string
  slug: string
  sku: string | null
  brand: string | null
  category_id: string | null
  short_description: string | null
  description: string | null
  composition: string | null
  presentation: string | null
  usage_route: string | null
  price_cents: number
  promo_price_cents: number | null
  track_stock: boolean
  stock_quantity: number
  is_available: boolean
  is_featured: boolean
  is_bestseller: boolean
  is_offer: boolean
  status: ProductStatus
  sort_order: number
  requires_prescription: boolean
  restricted_sale: boolean
  compliance_reviewed: boolean
  compliance_notes: string | null
  needs_review: boolean
  review_notes: string | null
  source_catalog: string | null
  source_page: number | null
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  url: string
  storage_path: string | null
  alt: string | null
  sort_order: number
}

export interface StoreSettings {
  store_name: string
  slogan: string | null
  logo_url: string | null
  primary_color: string
  primary_dark_color: string
  accent_color: string
  light_color: string
  whatsapp_number: string | null
  contact_email: string | null
  contact_phone: string | null
  instagram_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  address: string | null
  business_info: string | null
  opening_hours: string | null
  footer_text: string | null
  announcement_text: string | null
  announcement_active: boolean
  sales_mode: SalesMode
  send_to_whatsapp: boolean
  no_price_label: NoPriceLabel
  restricted_notice: string | null
  show_categories: boolean
  show_featured: boolean
  show_bestsellers: boolean
  show_offers: boolean
  show_secondary_banners: boolean
  categories_title: string
  featured_title: string
  bestsellers_title: string
  offers_title: string
  policy_privacy: string | null
  policy_terms: string | null
  policy_shipping: string | null
}

export interface Banner {
  id: string
  placement: 'hero' | 'secondary'
  eyebrow: string | null
  title: string
  subtitle: string | null
  button_label: string | null
  button_link: string | null
  image_url: string | null
  sort_order: number
  is_active: boolean
}

export interface Order {
  id: string
  order_number: number
  kind: OrderKind
  status: OrderStatus
  customer_name: string
  customer_phone: string
  customer_email: string | null
  customer_city: string | null
  notes: string | null
  total_cents: number
  has_unpriced_items: boolean
  requires_document_review: boolean
  documents_verified: boolean
  admin_notes: string | null
  user_id: string | null
  created_at: string
  updated_at: string
}

/** Perfil do usuário logado (cliente ou admin). */
export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  role: 'admin' | 'none'
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  product_sku: string | null
  quantity: number
  unit_price_cents: number | null
  line_total_cents: number | null
  requires_prescription: boolean
}

export interface OrderStatusHistory {
  id: number
  order_id: string
  old_status: OrderStatus | null
  new_status: OrderStatus
  created_at: string
}

/** Resposta da função place_order. */
export interface PlacedOrder {
  order_number: number
  kind: OrderKind
  total_cents: number
  has_unpriced_items: boolean
  requires_document_review: boolean
  items: {
    name: string
    sku: string | null
    quantity: number
    unit_price_cents: number | null
    requires_prescription: boolean
  }[]
}
