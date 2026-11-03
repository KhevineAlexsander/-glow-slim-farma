-- =============================================================================
-- Desconto nos pedidos (pedido da proprietária, 03/11/2026).
-- O admin dá o desconto em R$ ou em %. Com percentual preenchido, ele vale sobre
-- o valor fixo e acompanha as mudanças nos itens. O desconto nunca passa da soma
-- dos itens com preço, e o total continua sendo calculado só pelo banco.
-- Pedidos existentes não mudam: nascem com desconto zero.
-- =============================================================================

alter table public.orders
  add column discount_cents integer not null default 0
    check (discount_cents between 0 and 100000000),
  add column discount_percent numeric(5, 2)
    check (discount_percent is null or (discount_percent > 0 and discount_percent <= 100));

-- Total = soma dos itens com preço - desconto
create function private.order_apply_totals(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subtotal integer;
  v_discount integer;
begin
  select coalesce(sum(i.line_total_cents), 0)::integer into v_subtotal
    from public.order_items i where i.order_id = p_order_id;
  select least(
           v_subtotal,
           case when o.discount_percent is not null
                then round(v_subtotal * o.discount_percent / 100)::integer
                else o.discount_cents end)
    into v_discount
    from public.orders o where o.id = p_order_id;

  perform set_config('glow.recalc', 'on', true);
  update public.orders o
     set total_cents = v_subtotal - coalesce(v_discount, 0),
         has_unpriced_items = exists (select 1 from public.order_items i where i.order_id = p_order_id and i.unit_price_cents is null),
         requires_document_review = exists (select 1 from public.order_items i where i.order_id = p_order_id and i.requires_prescription)
   where o.id = p_order_id;
  perform set_config('glow.recalc', 'off', true);
end;
$$;

revoke all on function private.order_apply_totals(uuid) from public;

-- Mudança nos itens (mesmo gatilho de antes, agora considerando o desconto)
create or replace function private.order_recalc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.order_apply_totals(coalesce(new.order_id, old.order_id));
  return null;
end;
$$;

-- Mudança no desconto
create function private.order_discount_recalc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.order_apply_totals(new.id);
  return null;
end;
$$;

revoke all on function private.order_discount_recalc() from public;

create trigger orders_discount_recalc
  after update of discount_cents, discount_percent on public.orders
  for each row execute function private.order_discount_recalc();

-- Pedido manual: já pode nascer com desconto (os itens calculam o total ao entrar)
create or replace function private.admin_create_order(p_order jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_item     jsonb;
  v_product  public.products;
  v_kind     text := coalesce(p_order ->> 'kind', 'order');
  v_status   text := coalesce(p_order ->> 'status', 'confirmed');
  v_name     text := btrim(coalesce(p_order ->> 'name', ''));
  v_phone    text := regexp_replace(coalesce(p_order ->> 'phone', ''), '[^0-9]', '', 'g');
begin
  if not private.is_admin() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 then
    raise exception 'Informe o nome do cliente.' using errcode = '22023';
  end if;
  if v_phone !~ '^[0-9]{10,15}$' then
    raise exception 'Telefone inválido: use DDD + número.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 200 then
    raise exception 'Inclua ao menos um produto no pedido.' using errcode = '22023';
  end if;

  perform set_config('glow.manual_order', 'on', true);
  insert into public.orders
    (kind, status, customer_name, customer_phone, customer_email, customer_city, notes, discount_cents, discount_percent)
  values (v_kind, v_status, v_name, v_phone,
          nullif(btrim(coalesce(p_order ->> 'email', '')), ''),
          nullif(btrim(coalesce(p_order ->> 'city', '')), ''),
          nullif(btrim(coalesce(p_order ->> 'notes', '')), ''),
          coalesce((p_order ->> 'discount_cents')::integer, 0),
          (p_order ->> 'discount_percent')::numeric)
  returning id into v_order_id;
  perform set_config('glow.manual_order', 'off', true);

  -- O gatilho de insert vincula o pedido a quem está logado (aqui, o admin).
  -- O pedido é do cliente: não pode aparecer em "Minha conta" do admin.
  update public.orders set user_id = null where id = v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid;
    if not found then
      raise exception 'Produto não encontrado.' using errcode = 'P0002';
    end if;
    insert into public.order_items
      (order_id, product_id, product_name, product_sku, quantity, unit_price_cents, requires_prescription)
    values
      (v_order_id, v_product.id, v_product.name, v_product.sku,
       (v_item ->> 'quantity')::integer,
       nullif((v_item ->> 'unit_price_cents')::integer, 0),
       v_product.requires_prescription or v_product.restricted_sale);
  end loop;

  return v_order_id;
end;
$$;
