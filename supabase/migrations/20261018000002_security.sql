-- =============================================================================
-- Glow Slim Farma — segurança (RLS, permissões e storage)
-- Visitantes (anon) só LEEM dados públicos e registram pedidos via place_order.
-- Todas as escritas administrativas exigem public.is_admin() no banco.
-- =============================================================================

alter table public.profiles             enable row level security;
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.product_images       enable row level security;
alter table public.store_settings       enable row level security;
alter table public.banners              enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;

-- -----------------------------------------------------------------------------
-- Permissões de tabela (a RLS restringe as linhas)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

-- Leitura pública
grant select on public.categories, public.banners, public.store_settings to anon, authenticated;
grant select on public.catalog_products to anon, authenticated;

-- Painel (usuário autenticado; a RLS só libera para admin)
grant select, insert, update, delete on
  public.categories, public.products, public.product_images, public.banners
  to authenticated;
grant select, update on public.store_settings to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items, public.order_status_history to authenticated;
grant select, update on public.profiles to authenticated;

-- Funções
grant execute on function public.place_order(jsonb, jsonb) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy "profiles: ler o próprio perfil ou admin lê todos"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles: somente admin altera"
  on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
create policy "categories: público vê categorias visíveis"
  on public.categories for select to anon, authenticated
  using (is_visible or public.is_admin());

create policy "categories: admin insere"
  on public.categories for insert to authenticated with check (public.is_admin());
create policy "categories: admin altera"
  on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "categories: admin exclui"
  on public.categories for delete to authenticated using (public.is_admin());

-- -----------------------------------------------------------------------------
-- products / product_images (público lê pela view catalog_products)
-- -----------------------------------------------------------------------------
create policy "products: admin lê"
  on public.products for select to authenticated using (public.is_admin());
create policy "products: admin insere"
  on public.products for insert to authenticated with check (public.is_admin());
create policy "products: admin altera"
  on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "products: admin exclui"
  on public.products for delete to authenticated using (public.is_admin());

create policy "product_images: admin lê"
  on public.product_images for select to authenticated using (public.is_admin());
create policy "product_images: admin insere"
  on public.product_images for insert to authenticated with check (public.is_admin());
create policy "product_images: admin altera"
  on public.product_images for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "product_images: admin exclui"
  on public.product_images for delete to authenticated using (public.is_admin());

-- -----------------------------------------------------------------------------
-- store_settings
-- -----------------------------------------------------------------------------
create policy "store_settings: leitura pública"
  on public.store_settings for select to anon, authenticated using (true);
create policy "store_settings: admin altera"
  on public.store_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- banners
-- -----------------------------------------------------------------------------
create policy "banners: público vê ativos"
  on public.banners for select to anon, authenticated
  using (is_active or public.is_admin());
create policy "banners: admin insere"
  on public.banners for insert to authenticated with check (public.is_admin());
create policy "banners: admin altera"
  on public.banners for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "banners: admin exclui"
  on public.banners for delete to authenticated using (public.is_admin());

-- -----------------------------------------------------------------------------
-- orders (dados pessoais: somente admin)
-- -----------------------------------------------------------------------------
create policy "orders: admin lê"
  on public.orders for select to authenticated using (public.is_admin());
create policy "orders: admin altera"
  on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "order_items: admin lê"
  on public.order_items for select to authenticated using (public.is_admin());

create policy "order_status_history: admin lê"
  on public.order_status_history for select to authenticated using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Storage: bucket público para imagens da loja; somente admin envia/altera.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-images', 'store-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "store-images: admin envia"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'store-images' and public.is_admin());
create policy "store-images: admin altera"
  on storage.objects for update to authenticated
  using (bucket_id = 'store-images' and public.is_admin())
  with check (bucket_id = 'store-images' and public.is_admin());
create policy "store-images: admin exclui"
  on storage.objects for delete to authenticated
  using (bucket_id = 'store-images' and public.is_admin());
