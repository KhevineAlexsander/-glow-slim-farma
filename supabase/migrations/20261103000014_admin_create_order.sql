-- =============================================================================
-- Pedido manual pelo painel (pedido da proprietária, 03/11/2026).
-- O admin lança pedidos e orçamentos recebidos fora do site (telefone, balcão).
-- Tudo acontece numa transação só: pedido e itens entram juntos ou nada entra.
-- O total continua vindo da soma dos itens, pelos gatilhos de order_items.
-- =============================================================================

-- O pedido mínimo vale para a loja; o lançamento manual do admin fica de fora.
-- O sinal glow.manual_order só é ligado dentro de admin_create_order, que confere o admin.
create or replace function private.orders_check_minimum()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_min integer;
begin
  if new.kind <> 'order' or coalesce(current_setting('glow.manual_order', true), '') = 'on' then
    return new;
  end if;
  select min_order_cents into v_min from public.store_settings where id = 1;
  if coalesce(v_min, 0) > 0 and new.total_cents < v_min then
    raise exception 'O pedido mínimo é de R$ %.', replace(to_char(v_min / 100.0, 'FM999999990.00'), '.', ',')
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create function private.admin_create_order(p_order jsonb, p_items jsonb)
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
  insert into public.orders (kind, status, customer_name, customer_phone, customer_email, customer_city, notes)
  values (v_kind, v_status, v_name, v_phone,
          nullif(btrim(coalesce(p_order ->> 'email', '')), ''),
          nullif(btrim(coalesce(p_order ->> 'city', '')), ''),
          nullif(btrim(coalesce(p_order ->> 'notes', '')), ''))
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

revoke all on function private.admin_create_order(jsonb, jsonb) from public;
grant execute on function private.admin_create_order(jsonb, jsonb) to authenticated;

-- Porta de entrada pela API (mesmo padrão de place_order)
create function public.admin_create_order(p_order jsonb, p_items jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.admin_create_order(p_order, p_items); $$;

revoke all on function public.admin_create_order(jsonb, jsonb) from public;
grant execute on function public.admin_create_order(jsonb, jsonb) to authenticated;
