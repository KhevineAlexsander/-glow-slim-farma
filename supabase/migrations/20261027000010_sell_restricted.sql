-- =============================================================================
-- Venda de produtos com prescrição/venda restrita, com preço, pelo checkout.
-- Pedido da proprietária (27/10/2026): todos os produtos têm preço e devem
-- aparecer com preço na loja e poder ser comprados, com o pedido finalizado
-- pelo WhatsApp.
--
-- Fica como configuração (store_settings.sell_restricted, ligada por padrão)
-- para poder ser desligada no painel. Mesmo ligada, nada some da conformidade:
-- o produto continua marcado, a loja mostra o aviso, o cliente confirma no
-- carrinho que tem a receita/documentação e o pedido vai com
-- requires_document_review = true para o responsável técnico avaliar.
-- =============================================================================

alter table public.store_settings
  add column sell_restricted boolean not null default true;

-- Modo pedido com finalização no WhatsApp (há um número de WhatsApp configurado)
update public.store_settings
   set sales_mode = 'order',
       send_to_whatsapp = true
 where id = 1
   and whatsapp_number is not null;

-- -----------------------------------------------------------------------------
-- Vitrine: o preço de item restrito sai do banco só quando a venda está ligada.
-- -----------------------------------------------------------------------------
create or replace function private.catalog_rows()
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
    -- preço de item restrito só sai do banco com a venda de restritos ligada
    case when s.sell_restricted then p.price_cents else p.public_price_cents end,
    case when s.sell_restricted then p.promo_price_cents else p.public_promo_price_cents end,
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
  cross join (select coalesce((select sell_restricted from public.store_settings where id = 1), false) as sell_restricted) s
  left join public.categories c on c.id = p.category_id
  where p.status = 'published'
    and (p.category_id is null or c.is_visible);
$$;

-- -----------------------------------------------------------------------------
-- Pedido: item restrito entra no checkout quando a venda está ligada.
-- (mesma função de 20261018000001, que hoje vive no esquema private)
-- -----------------------------------------------------------------------------
create or replace function private.place_order(p_customer jsonb, p_items jsonb)
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
  v_is_restricted boolean;
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

    v_is_restricted := v_product.requires_prescription or v_product.restricted_sale;
    if v_is_restricted then
      v_restricted := true;
    end if;

    if v_kind = 'order' then
      -- Checkout: preço válido; item restrito só com a venda de restritos ligada.
      if v_effective <= 0 then
        raise exception '"%" está sem preço e não pode ser comprado pelo checkout.', v_product.name using errcode = '22023';
      end if;
      if v_is_restricted and not v_settings.sell_restricted then
        raise exception '"%" exige avaliação/prescrição e não pode ser comprado pelo checkout.', v_product.name using errcode = '22023';
      end if;
      v_unit := v_effective;
    else
      -- Orçamento: preço de referência para itens com preço (restritos só com a venda ligada).
      if v_effective > 0 and (not v_is_restricted or v_settings.sell_restricted) then
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
      'requires_prescription', v_is_restricted
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
