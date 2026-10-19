-- =============================================================================
-- Glow Slim Farma — esquema principal
-- Valores monetários são armazenados em CENTAVOS (integer). Nunca use float.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles: usuários do painel. Todo usuário nasce com role 'none'.
-- Somente um admin (ou o SQL Editor do Supabase) pode promover alguém a admin.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text check (full_name is null or char_length(full_name) <= 120),
  role        text not null default 'none' check (role in ('admin', 'none')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Verifica se o usuário autenticado é administrador.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (description is null or char_length(description) <= 500),
  icon        text check (icon is null or char_length(icon) <= 40),
  image_url   text,
  sort_order  integer not null default 0,
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index categories_sort_idx on public.categories (sort_order, name);

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table public.products (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (char_length(btrim(name)) between 2 and 200),
  slug                  text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sku                   text unique check (sku is null or char_length(btrim(sku)) between 1 and 60),
  brand                 text check (brand is null or char_length(brand) <= 120),
  category_id           uuid references public.categories (id) on delete set null,
  short_description     text check (short_description is null or char_length(short_description) <= 300),
  description           text check (description is null or char_length(description) <= 10000),
  composition           text check (composition is null or char_length(composition) <= 5000),
  presentation          text check (presentation is null or char_length(presentation) <= 120),
  usage_route           text check (usage_route is null or char_length(usage_route) <= 60),

  -- Preço em centavos. 0 = "sem preço cadastrado" (nunca exibido como grátis).
  price_cents           integer not null default 0
                        check (price_cents between 0 and 100000000),
  promo_price_cents     integer
                        check (promo_price_cents is null or promo_price_cents > 0),

  track_stock           boolean not null default false,
  stock_quantity        integer not null default 0 check (stock_quantity >= 0),
  is_available          boolean not null default true,
  is_featured           boolean not null default false,
  is_bestseller         boolean not null default false,
  is_offer              boolean not null default false,
  status                text not null default 'draft'
                        check (status in ('draft', 'published', 'archived')),
  sort_order            integer not null default 0,

  -- Controles sanitários / regulatórios
  requires_prescription boolean not null default false,
  restricted_sale       boolean not null default false,
  compliance_reviewed   boolean not null default false,
  compliance_notes      text check (compliance_notes is null or char_length(compliance_notes) <= 2000),

  -- Revisão de dados importados
  needs_review          boolean not null default false,
  review_notes          text check (review_notes is null or char_length(review_notes) <= 5000),
  source_catalog        text check (source_catalog is null or char_length(source_catalog) <= 200),
  source_page           integer check (source_page is null or source_page > 0),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Preço promocional precisa ser menor que o preço normal.
  constraint products_promo_lt_price
    check (promo_price_cents is null or promo_price_cents < price_cents),

  -- Produto com prescrição/restrição só pode ser publicado após revisão do responsável.
  constraint products_restricted_needs_review
    check (
      status <> 'published'
      or not (requires_prescription or restricted_sale)
      or compliance_reviewed
    )
);

create index products_status_idx      on public.products (status);
create index products_category_idx    on public.products (category_id);
create index products_featured_idx    on public.products (is_featured) where is_featured;
create index products_bestseller_idx  on public.products (is_bestseller) where is_bestseller;
create index products_offer_idx       on public.products (is_offer) where is_offer;
create index products_name_idx        on public.products (lower(name));
create index products_no_price_idx    on public.products (price_cents) where price_cents = 0;

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Regra de negócio: TODO produto nasce com preço zero.
-- O preço só é definido depois, por um administrador, via UPDATE.
create or replace function public.products_force_zero_price()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.price_cents = 0;
  new.promo_price_cents = null;
  return new;
end;
$$;

create trigger products_zero_price_on_insert before insert on public.products
  for each row execute function public.products_force_zero_price();

-- -----------------------------------------------------------------------------
-- product_images
-- -----------------------------------------------------------------------------
create table public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  url           text not null check (char_length(url) <= 1000),
  storage_path  text,
  alt           text check (alt is null or char_length(alt) <= 200),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, sort_order);

-- -----------------------------------------------------------------------------
-- store_settings: linha única (id = 1)
-- -----------------------------------------------------------------------------
create table public.store_settings (
  id                    smallint primary key default 1 check (id = 1),
  store_name            text not null default 'Glow Slim Farma' check (char_length(store_name) between 1 and 80),
  slogan                text default 'Saúde • Beleza • Bem-estar' check (slogan is null or char_length(slogan) <= 120),
  logo_url              text,

  primary_color         text not null default '#1677F2' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  primary_dark_color    text not null default '#0756B5' check (primary_dark_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color          text not null default '#22A9E8' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  light_color           text not null default '#EAF8FF' check (light_color ~ '^#[0-9A-Fa-f]{6}$'),

  whatsapp_number       text check (whatsapp_number is null or whatsapp_number ~ '^[0-9]{10,15}$'),
  contact_email         text check (contact_email is null or char_length(contact_email) <= 120),
  contact_phone         text check (contact_phone is null or char_length(contact_phone) <= 40),
  instagram_url         text check (instagram_url is null or char_length(instagram_url) <= 300),
  facebook_url          text check (facebook_url is null or char_length(facebook_url) <= 300),
  tiktok_url            text check (tiktok_url is null or char_length(tiktok_url) <= 300),
  address               text check (address is null or char_length(address) <= 300),
  business_info         text check (business_info is null or char_length(business_info) <= 500),
  opening_hours         text check (opening_hours is null or char_length(opening_hours) <= 200),
  footer_text           text check (footer_text is null or char_length(footer_text) <= 500),

  announcement_text     text check (announcement_text is null or char_length(announcement_text) <= 200),
  announcement_active   boolean not null default false,

  -- 'order' = carrinho com pedido (somente produtos com preço e sem restrição)
  -- 'quote' = tudo vira solicitação de orçamento
  sales_mode            text not null default 'quote' check (sales_mode in ('order', 'quote')),
  -- Depois de registrar o pedido, oferecer envio do resumo pelo WhatsApp
  send_to_whatsapp      boolean not null default true,
  -- Rótulo para produtos sem preço: 'consult' = "Preço sob consulta", 'whatsapp' = "Consulte pelo WhatsApp"
  no_price_label        text not null default 'consult' check (no_price_label in ('consult', 'whatsapp')),
  restricted_notice     text default 'Produtos sujeitos a prescrição ou de uso profissional são comercializados somente mediante apresentação de receita/documentação e avaliação do responsável técnico.'
                        check (restricted_notice is null or char_length(restricted_notice) <= 600),

  -- Seções da página inicial
  show_categories       boolean not null default true,
  show_featured         boolean not null default true,
  show_bestsellers      boolean not null default true,
  show_offers           boolean not null default true,
  show_secondary_banners boolean not null default true,
  categories_title      text not null default 'Categorias',
  featured_title        text not null default 'Destaques',
  bestsellers_title     text not null default 'Mais Vendidos',
  offers_title          text not null default 'Ofertas Especiais',

  policy_privacy        text check (policy_privacy is null or char_length(policy_privacy) <= 20000),
  policy_terms          text check (policy_terms is null or char_length(policy_terms) <= 20000),
  policy_shipping       text check (policy_shipping is null or char_length(policy_shipping) <= 20000),

  updated_at            timestamptz not null default now()
);

create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function public.set_updated_at();

insert into public.store_settings (id) values (1);

-- -----------------------------------------------------------------------------
-- banners
-- -----------------------------------------------------------------------------
create table public.banners (
  id            uuid primary key default gen_random_uuid(),
  placement     text not null default 'hero' check (placement in ('hero', 'secondary')),
  eyebrow       text check (eyebrow is null or char_length(eyebrow) <= 80),
  title         text not null check (char_length(title) between 1 and 120),
  subtitle      text check (subtitle is null or char_length(subtitle) <= 300),
  button_label  text check (button_label is null or char_length(button_label) <= 40),
  button_link   text check (button_link is null or char_length(button_link) <= 500),
  image_url     text,
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index banners_active_idx on public.banners (placement, sort_order) where is_active;

create trigger banners_updated_at before update on public.banners
  for each row execute function public.set_updated_at();

insert into public.banners (placement, eyebrow, title, subtitle, button_label, button_link, sort_order)
values ('hero', 'Sua saúde e bem-estar', 'Os melhores produtos e marcas',
        'Saúde, beleza e bem-estar com atendimento próximo. Edite este banner no painel administrativo.',
        'Ver produtos', '/produtos', 0);

-- -----------------------------------------------------------------------------
-- orders / order_items / order_status_history
-- -----------------------------------------------------------------------------
create table public.orders (
  id                        uuid primary key default gen_random_uuid(),
  order_number              bigint generated always as identity (start with 1001) unique,
  kind                      text not null check (kind in ('order', 'quote')),
  status                    text not null default 'new'
                            check (status in ('new', 'in_review', 'confirmed', 'completed', 'cancelled')),
  customer_name             text not null check (char_length(btrim(customer_name)) between 2 and 120),
  customer_phone            text not null check (customer_phone ~ '^[0-9]{10,15}$'),
  customer_email            text check (customer_email is null or char_length(customer_email) <= 120),
  customer_city             text check (customer_city is null or char_length(customer_city) <= 120),
  notes                     text check (notes is null or char_length(notes) <= 1000),
  total_cents               integer not null default 0 check (total_cents >= 0),
  has_unpriced_items        boolean not null default false,
  requires_document_review  boolean not null default false,
  documents_verified        boolean not null default false,
  admin_notes               text check (admin_notes is null or char_length(admin_notes) <= 5000),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index orders_created_idx on public.orders (created_at desc);
create index orders_status_idx  on public.orders (status);
create index orders_phone_idx   on public.orders (customer_phone, created_at desc);

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders (id) on delete cascade,
  -- RESTRICT: impede apagar produto que já está em pedidos (use "arquivar").
  product_id            uuid not null references public.products (id) on delete restrict,
  product_name          text not null,
  product_sku           text,
  quantity              integer not null check (quantity between 1 and 999),
  -- Preço aplicado no momento do pedido. NULL = sem preço (sob consulta).
  unit_price_cents      integer check (unit_price_cents is null or unit_price_cents > 0),
  line_total_cents      integer check (line_total_cents is null or line_total_cents > 0),
  requires_prescription boolean not null default false,
  created_at            timestamptz not null default now()
);

create index order_items_order_idx   on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  old_status  text,
  new_status  text not null,
  changed_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, old_status, new_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger orders_status_log
  after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- Pedidos não podem ter seus dados de origem alterados pelo painel:
-- apenas status, notas internas e verificação documental.
create or replace function public.orders_protect_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind is distinct from old.kind
     or new.order_number is distinct from old.order_number
     or new.customer_name is distinct from old.customer_name
     or new.customer_phone is distinct from old.customer_phone
     or new.customer_email is distinct from old.customer_email
     or new.customer_city is distinct from old.customer_city
     or new.notes is distinct from old.notes
     or new.total_cents is distinct from old.total_cents
     or new.has_unpriced_items is distinct from old.has_unpriced_items
     or new.requires_document_review is distinct from old.requires_document_review
     or new.created_at is distinct from old.created_at then
    raise exception 'Somente status, observações internas e verificação documental podem ser alterados.';
  end if;
  return new;
end;
$$;

create trigger orders_protect before update on public.orders
  for each row execute function public.orders_protect_fields();

-- -----------------------------------------------------------------------------
-- Vitrine pública: somente produtos publicados e colunas públicas.
-- (Notas internas, revisão e origem do catálogo NÃO são expostas.)
-- -----------------------------------------------------------------------------
create view public.catalog_products
with (security_barrier = true)
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
  p.price_cents,
  p.promo_price_cents,
  p.track_stock,
  -- Disponível = marcado como disponível e, se controla estoque, com saldo.
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
  and (c.id is null or c.is_visible);

-- -----------------------------------------------------------------------------
-- place_order: única forma de um visitante registrar pedido/orçamento.
-- Os preços são lidos do banco — o navegador envia apenas IDs e quantidades.
-- -----------------------------------------------------------------------------
create or replace function public.place_order(p_customer jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings      public.store_settings;
  v_name          text := btrim(coalesce(p_customer ->> 'name', ''));
  v_phone         text := regexp_replace(coalesce(p_customer ->> 'phone', ''), '[^0-9]', '', 'g');
  v_email         text := nullif(btrim(coalesce(p_customer ->> 'email', '')), '');
  v_city          text := nullif(btrim(coalesce(p_customer ->> 'city', '')), '');
  v_notes         text := nullif(btrim(coalesce(p_customer ->> 'notes', '')), '');
  v_order_id      uuid;
  v_order_number  bigint;
  v_kind          text;
  v_total         integer := 0;
  v_unpriced      boolean := false;
  v_restricted    boolean := false;
  v_item          record;
  v_product       public.products;
  v_effective     integer;
  v_unit          integer;
  v_result_items  jsonb := '[]'::jsonb;
begin
  select * into v_settings from public.store_settings where id = 1;

  -- Validações do cliente
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Informe seu nome (2 a 120 caracteres).' using errcode = '22023';
  end if;
  if v_phone !~ '^[0-9]{10,15}$' then
    raise exception 'Informe um telefone/WhatsApp válido com DDD.' using errcode = '22023';
  end if;
  if v_email is not null and (char_length(v_email) > 120 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'E-mail inválido.' using errcode = '22023';
  end if;
  if v_city is not null and char_length(v_city) > 120 then
    raise exception 'Cidade muito longa.' using errcode = '22023';
  end if;
  if v_notes is not null and char_length(v_notes) > 1000 then
    raise exception 'Observações devem ter até 1000 caracteres.' using errcode = '22023';
  end if;

  -- Validações dos itens
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'O carrinho deve ter entre 1 e 50 itens.' using errcode = '22023';
  end if;

  -- Proteção simples contra abuso: até 5 envios por telefone a cada 10 minutos.
  if (select count(*) from public.orders
       where customer_phone = v_phone and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Muitas solicitações em sequência. Aguarde alguns minutos.' using errcode = '22023';
  end if;

  v_kind := case when v_settings.sales_mode = 'order' then 'order' else 'quote' end;

  -- 1) Valida e precifica cada item com os dados do banco.
  for v_item in
    select (e ->> 'product_id')::uuid as product_id,
           sum((e ->> 'quantity')::integer)::integer as quantity
      from jsonb_array_elements(p_items) e
     group by 1
  loop
    if v_item.quantity is null or v_item.quantity < 1 or v_item.quantity > 999 then
      raise exception 'Quantidade inválida.' using errcode = '22023';
    end if;

    select * into v_product from public.products
     where id = v_item.product_id and status = 'published';
    if not found or not v_product.is_available then
      raise exception 'Um dos produtos não está mais disponível. Atualize o carrinho.' using errcode = '22023';
    end if;
    if v_product.track_stock and v_item.quantity > v_product.stock_quantity then
      raise exception 'Estoque insuficiente para "%".', v_product.name using errcode = '22023';
    end if;

    v_effective := case
      when v_product.promo_price_cents is not null
           and v_product.promo_price_cents > 0
           and v_product.promo_price_cents < v_product.price_cents
        then v_product.promo_price_cents
      else v_product.price_cents
    end;

    if v_product.requires_prescription or v_product.restricted_sale then
      v_restricted := true;
    end if;

    if v_kind = 'order' then
      -- Checkout normal: somente produtos com preço válido e sem restrição.
      if v_effective <= 0 then
        raise exception '"%" está sem preço e não pode ser comprado pelo checkout.', v_product.name using errcode = '22023';
      end if;
      if v_product.requires_prescription or v_product.restricted_sale then
        raise exception '"%" exige avaliação/prescrição e não pode ser comprado pelo checkout.', v_product.name using errcode = '22023';
      end if;
      v_unit := v_effective;
    else
      -- Orçamento: preço de referência apenas para itens com preço e sem restrição.
      if v_effective > 0 and not (v_product.requires_prescription or v_product.restricted_sale) then
        v_unit := v_effective;
      else
        v_unit := null;
        v_unpriced := true;
      end if;
    end if;

    v_total := v_total + coalesce(v_unit * v_item.quantity, 0);

    v_result_items := v_result_items || jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'sku', v_product.sku,
      'quantity', v_item.quantity,
      'unit_price_cents', v_unit,
      'requires_prescription', v_product.requires_prescription or v_product.restricted_sale
    );
  end loop;

  -- 2) Grava o pedido já com os totais calculados no servidor.
  insert into public.orders
    (kind, customer_name, customer_phone, customer_email, customer_city, notes,
     total_cents, has_unpriced_items, requires_document_review)
  values
    (v_kind, v_name, v_phone, v_email, v_city, v_notes,
     v_total, v_unpriced, v_restricted)
  returning id, order_number into v_order_id, v_order_number;

  -- 3) Grava os itens com o preço aplicado no momento do pedido.
  insert into public.order_items
    (order_id, product_id, product_name, product_sku, quantity,
     unit_price_cents, line_total_cents, requires_prescription)
  select v_order_id, x.product_id, x.name, x.sku, x.quantity,
         x.unit_price_cents, x.unit_price_cents * x.quantity, x.requires_prescription
    from jsonb_to_recordset(v_result_items)
         as x(product_id uuid, name text, sku text, quantity integer,
              unit_price_cents integer, requires_prescription boolean);

  return jsonb_build_object(
    'order_number', v_order_number,
    'kind', v_kind,
    'total_cents', v_total,
    'has_unpriced_items', v_unpriced,
    'requires_document_review', v_restricted,
    'items', v_result_items
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Dashboard (somente admin)
-- -----------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'products_total',     (select count(*) from public.products where status <> 'archived'),
    'products_published', (select count(*) from public.products where status = 'published'),
    'products_no_price',  (select count(*) from public.products where status <> 'archived' and price_cents = 0),
    'products_review',    (select count(*) from public.products where status <> 'archived' and needs_review),
    'categories_total',   (select count(*) from public.categories),
    'orders_total',       (select count(*) from public.orders),
    'orders_new',         (select count(*) from public.orders where status = 'new')
  );
end;
$$;
