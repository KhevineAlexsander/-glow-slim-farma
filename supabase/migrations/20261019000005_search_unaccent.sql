-- =============================================================================
-- Busca sem diferenciar acentos/maiúsculas ("mascara" encontra "Máscara").
-- =============================================================================
create extension if not exists unaccent with schema extensions;

-- unaccent() não é IMMUTABLE; este invólucro fixa o dicionário para poder
-- ser usado em coluna gerada.
create or replace function public.search_normalize(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, '')));
$$;

alter table public.products
  add column search_text text generated always as (
    public.search_normalize(
      coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(sku, '') || ' ' || coalesce(short_description, '')
    )
  ) stored;

create index products_search_text_idx on public.products using btree (search_text text_pattern_ops);

grant select (search_text) on public.products to anon;

-- Recria a vitrine incluindo a coluna de busca (mesma definição da migration 0004).
drop view public.catalog_products;

create view public.catalog_products
with (security_invoker = true, security_barrier = true)
as
select
  p.id,
  p.name,
  p.slug,
  p.sku,
  p.brand,
  p.category_id,
  c.name  as category_name,
  c.slug  as category_slug,
  p.short_description,
  p.description,
  p.composition,
  p.presentation,
  p.usage_route,
  p.public_price_cents       as price_cents,
  p.public_promo_price_cents as promo_price_cents,
  p.track_stock,
  (p.is_available and (not p.track_stock or p.stock_quantity > 0)) as is_available,
  p.is_featured,
  p.is_bestseller,
  p.is_offer,
  p.requires_prescription,
  p.restricted_sale,
  p.sort_order,
  p.created_at,
  p.search_text,
  coalesce(
    (select json_agg(json_build_object('url', i.url, 'alt', i.alt) order by i.sort_order, i.created_at)
       from public.product_images i where i.product_id = p.id),
    '[]'::json
  ) as images
from public.products p
left join public.categories c on c.id = p.category_id
where p.status = 'published'
  and (p.category_id is null or c.is_visible);

grant select on public.catalog_products to anon, authenticated;
