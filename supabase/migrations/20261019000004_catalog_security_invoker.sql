-- =============================================================================
-- Vitrine pública sem SECURITY DEFINER (alerta 0010 do Security Advisor).
-- A view passa a rodar com as permissões de quem consulta: visitantes leem
-- apenas produtos publicados (RLS) e apenas colunas públicas (GRANT por coluna).
-- Preço de produto com prescrição/venda restrita nunca sai do banco para o público.
-- =============================================================================

-- Preço "público": zero/nulo para produtos restritos (calculado pelo banco).
alter table public.products
  add column public_price_cents integer
    generated always as (case when requires_prescription or restricted_sale then 0 else price_cents end) stored,
  add column public_promo_price_cents integer
    generated always as (case when requires_prescription or restricted_sale then null else promo_price_cents end) stored;

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
  coalesce(
    (select json_agg(json_build_object('url', i.url, 'alt', i.alt) order by i.sort_order, i.created_at)
       from public.product_images i where i.product_id = p.id),
    '[]'::json
  ) as images
from public.products p
left join public.categories c on c.id = p.category_id
where p.status = 'published'
  -- Categoria oculta esconde seus produtos (a RLS esconde a categoria do visitante).
  and (p.category_id is null or c.is_visible);

grant select on public.catalog_products to anon, authenticated;

-- Visitante: somente colunas públicas da tabela de produtos.
-- (Notas internas, revisão, origem, preço bruto e estoque detalhado ficam de fora.)
grant select (
  id, name, slug, sku, brand, category_id, short_description, description, composition,
  presentation, usage_route, public_price_cents, public_promo_price_cents, track_stock,
  stock_quantity, is_available, is_featured, is_bestseller, is_offer, requires_prescription,
  restricted_sale, sort_order, created_at, status
) on public.products to anon;

create policy "products: visitante lê publicados"
  on public.products for select to anon
  using (status = 'published');

grant select (id, product_id, url, alt, sort_order, created_at) on public.product_images to anon;

create policy "product_images: visitante lê imagens de publicados"
  on public.product_images for select to anon
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));

-- Alerta 0003 (desempenho): avaliar auth.uid() uma vez por consulta, não por linha.
drop policy "profiles: ler o próprio perfil ou admin lê todos" on public.profiles;
create policy "profiles: ler o próprio perfil ou admin lê todos"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
