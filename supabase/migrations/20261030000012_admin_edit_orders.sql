-- =============================================================================
-- Painel: editar e excluir pedidos (pedido da proprietária, 30/10/2026).
-- - O admin edita os dados do cliente e as observações do pedido.
-- - O admin inclui, altera e remove itens; o total do pedido é sempre
--   recalculado pelo banco a partir dos itens (nunca digitado).
-- - O admin exclui pedidos (itens e histórico saem junto, em cascata).
-- Continuam travados: número, tipo e data do pedido.
-- =============================================================================

-- Trava de campos: libera os dados do cliente; o total só muda pelo recálculo dos itens.
create or replace function public.orders_protect_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind is distinct from old.kind
     or new.order_number is distinct from old.order_number
     or new.created_at is distinct from old.created_at then
    raise exception 'Número, tipo e data do pedido não podem ser alterados.';
  end if;
  if (new.total_cents is distinct from old.total_cents
      or new.has_unpriced_items is distinct from old.has_unpriced_items
      or new.requires_document_review is distinct from old.requires_document_review)
     and coalesce(current_setting('glow.recalc', true), '') <> 'on' then
    raise exception 'O total é calculado a partir dos itens do pedido.';
  end if;
  return new;
end;
$$;

-- Excluir pedido: somente admin
grant delete on public.orders to authenticated;
create policy "orders: admin exclui"
  on public.orders for delete to authenticated
  using ((select private.is_admin()));

-- Itens: somente admin inclui, altera e remove
grant insert, update, delete on public.order_items to authenticated;
create policy "order_items: admin inclui"
  on public.order_items for insert to authenticated
  with check ((select private.is_admin()));
create policy "order_items: admin altera"
  on public.order_items for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "order_items: admin remove"
  on public.order_items for delete to authenticated
  using ((select private.is_admin()));

-- Total da linha = preço unitário x quantidade (sem preço = sem total)
create function private.order_items_line_total()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.line_total_cents := case when new.unit_price_cents is null then null else new.unit_price_cents * new.quantity end;
  return new;
end;
$$;

create trigger order_items_line_total
  before insert or update on public.order_items
  for each row execute function private.order_items_line_total();

-- Recalcula total, "itens sem preço" e "exige receita" do pedido a cada mudança nos itens
create function private.order_recalc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.order_id, old.order_id);
begin
  perform set_config('glow.recalc', 'on', true);
  update public.orders o
     set total_cents = coalesce((select sum(i.line_total_cents) from public.order_items i where i.order_id = v_id), 0),
         has_unpriced_items = exists (select 1 from public.order_items i where i.order_id = v_id and i.unit_price_cents is null),
         requires_document_review = exists (select 1 from public.order_items i where i.order_id = v_id and i.requires_prescription)
   where o.id = v_id;
  perform set_config('glow.recalc', 'off', true);
  return null;
end;
$$;

revoke all on function private.order_recalc() from public;
revoke all on function private.order_items_line_total() from public;

create trigger order_items_recalc
  after insert or update or delete on public.order_items
  for each row execute function private.order_recalc();
