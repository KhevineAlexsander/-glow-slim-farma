-- =============================================================================
-- Contas de cliente (login opcional na loja).
-- - Todo cadastro nasce com role 'none' (cliente). Ninguém muda a própria role:
--   a coluna role não é atualizável pela API (promoção só pelo SQL Editor).
-- - Pedidos feitos com login ficam ligados à conta (user_id = auth.uid()).
-- - O cliente lê apenas os próprios pedidos; o admin continua lendo todos.
-- =============================================================================

-- Telefone do cliente (só dígitos, com DDD)
alter table public.profiles
  add column phone text check (phone is null or phone ~ '^[0-9]{10,15}$');

-- Cadastro: grava nome e telefone informados; role é sempre 'none'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name  text := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), '');
  v_phone text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g');
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, v_name, case when v_phone ~ '^[0-9]{10,15}$' then v_phone end)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- O cliente edita só nome e telefone; role e e-mail não são atualizáveis pela API.
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

drop policy "profiles: somente admin altera" on public.profiles;
create policy "profiles: dono ou admin altera"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

-- Pedido ligado à conta de quem estava logado (visitante = null)
alter table public.orders
  add column user_id uuid references auth.users (id) on delete set null;

create index orders_user_idx on public.orders (user_id, created_at desc);

create or replace function public.orders_set_user()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  return new;
end;
$$;

create trigger orders_set_user before insert on public.orders
  for each row execute function public.orders_set_user();

-- user_id também é protegido (só pode virar null, quando a conta é excluída).
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
     or new.created_at is distinct from old.created_at
     or (new.user_id is distinct from old.user_id and new.user_id is not null) then
    raise exception 'Somente status, observações internas e verificação documental podem ser alterados.';
  end if;
  return new;
end;
$$;

-- Leitura: admin vê todos; cliente vê os próprios (uma política por ação,
-- evitando o alerta de múltiplas políticas permissivas).
drop policy "orders: admin lê" on public.orders;
create policy "orders: admin ou dono lê"
  on public.orders for select to authenticated
  using ((select private.is_admin()) or user_id = (select auth.uid()));

drop policy "order_items: admin lê" on public.order_items;
create policy "order_items: admin ou dono do pedido lê"
  on public.order_items for select to authenticated
  using (
    (select private.is_admin())
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

drop policy "order_status_history: admin lê" on public.order_status_history;
create policy "order_status_history: admin ou dono do pedido lê"
  on public.order_status_history for select to authenticated
  using (
    (select private.is_admin())
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );
