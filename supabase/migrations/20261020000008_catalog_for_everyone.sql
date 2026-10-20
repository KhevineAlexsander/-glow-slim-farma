-- =============================================================================
-- Vitrine para visitantes E clientes logados.
-- A view security_invoker dependia da RLS de products, que só liberava
-- visitantes (anon) e admins: cliente logado via a loja vazia.
-- Agora a view lê de uma função no esquema privado (fora da API) que devolve
-- somente produtos publicados e somente colunas públicas, para qualquer papel.
-- Assim ninguém além do admin precisa ler a tabela products diretamente.
-- =============================================================================

create function private.catalog_rows()
returns table (
  id uuid,
  name text,
  slug text,
  sku text,
  brand text,
  category_id uuid,
  category_name text,
  category_slug text,
  short_description text,
  description text,
  composition text,
  presentation text,
  usage_route text,
  price_cents integer,
  promo_price_cents integer,
  track_stock boolean,
  is_available boolean,
  is_featured boolean,
  is_bestseller boolean,
  is_offer boolean,
  requires_prescription boolean,
  restricted_sale boolean,
  sort_order integer,
  created_at timestamptz,
  search_text text,
  images json
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.name, p.slug, p.sku, p.brand, p.category_id,
    c.name, c.slug,
    p.short_description, p.description, p.composition, p.presentation, p.usage_route,
    -- preço de produto com prescrição/venda restrita nunca sai do banco
    p.public_price_cents, p.public_promo_price_cents,
    p.track_stock,
    (p.is_available and (not p.track_stock or p.stock_quantity > 0)),
    p.is_featured, p.is_bestseller, p.is_offer,
    p.requires_prescription, p.restricted_sale,
    p.sort_order, p.created_at, p.search_text,
    coalesce(
      (select json_agg(json_build_object('url', i.url, 'alt', i.alt) order by i.sort_order, i.created_at)
         from public.product_images i where i.product_id = p.id),
      '[]'::json
    )
  from public.products p
  left join public.categories c on c.id = p.category_id
  where p.status = 'published'
    and (p.category_id is null or c.is_visible);
$$;

revoke all on function private.catalog_rows() from public;
grant execute on function private.catalog_rows() to anon, authenticated;

drop view public.catalog_products;
create view public.catalog_products
with (security_invoker = true)
as select * from private.catalog_rows();

grant select on public.catalog_products to anon, authenticated;

-- O visitante não precisa mais ler as tabelas diretamente.
drop policy "products: visitante lê publicados" on public.products;
revoke select on public.products from anon;
drop policy "product_images: visitante lê imagens de publicados" on public.product_images;
revoke select on public.product_images from anon;
