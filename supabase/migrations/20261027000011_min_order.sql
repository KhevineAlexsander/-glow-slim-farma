-- =============================================================================
-- Pedido mínimo (pedido da proprietária: compra mínima de R$ 180,00).
-- Configurável em store_settings.min_order_cents (0 = sem mínimo). Vale para
-- pedidos de compra (kind = 'order'); orçamentos não têm mínimo.
-- A conferência fica num gatilho de orders: o total já vem calculado no servidor
-- por place_order, e nenhum pedido abaixo do mínimo é gravado.
-- =============================================================================

alter table public.store_settings
  add column min_order_cents integer not null default 18000
    check (min_order_cents >= 0);

create function private.orders_check_minimum()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_min integer;
begin
  if new.kind <> 'order' then
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

revoke all on function private.orders_check_minimum() from public;

create trigger orders_check_minimum
  before insert on public.orders
  for each row execute function private.orders_check_minimum();
