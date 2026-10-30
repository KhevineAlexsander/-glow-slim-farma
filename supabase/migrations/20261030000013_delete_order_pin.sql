-- =============================================================================
-- Excluir pedido exige senha (pedido da proprietária, 30/10/2026).
-- A exclusão direta deixa de existir: só pela função admin_delete_order, que
-- confere se quem pede é admin e se a senha bate. A senha não fica guardada
-- em texto: só o hash SHA-256, numa tabela do esquema private (fora da API).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Sem exclusão direta pela API
drop policy if exists "orders: admin exclui" on public.orders;
revoke delete on public.orders from authenticated;

-- Segredos do app (fora da API; só funções security definer leem)
create table if not exists private.app_secrets (
  key   text primary key,
  value text not null
);
revoke all on private.app_secrets from public, anon, authenticated;

-- Hash SHA-256 da senha de exclusão
insert into private.app_secrets (key, value)
values ('delete_order_pin_sha256', '3189722cce958adc1be93bfd677c6f9370eef5c2f75e2be123c1f06b3e8c6840')
on conflict (key) do update set value = excluded.value;

create or replace function private.admin_delete_order(p_order_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  if not private.is_admin() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  select value into v_hash from private.app_secrets where key = 'delete_order_pin_sha256';
  if v_hash is null
     or encode(extensions.digest(coalesce(p_pin, ''), 'sha256'), 'hex') <> v_hash then
    raise exception 'Senha incorreta.' using errcode = '28P01';
  end if;
  delete from public.orders where id = p_order_id;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function private.admin_delete_order(uuid, text) from public;
grant execute on function private.admin_delete_order(uuid, text) to authenticated;

-- Porta de entrada pela API (mesmo padrão de place_order)
create or replace function public.admin_delete_order(p_order_id uuid, p_pin text)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.admin_delete_order(p_order_id, p_pin); $$;

revoke all on function public.admin_delete_order(uuid, text) from public;
grant execute on function public.admin_delete_order(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- O admin pode editar tudo no pedido (pedido da proprietária: "adm pode fazer tudo").
-- Só o total segue a soma dos itens (o admin controla quantidades e preços), e o
-- número continua sendo a sequência automática do banco.
-- -----------------------------------------------------------------------------
create or replace function public.orders_protect_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.total_cents is distinct from old.total_cents
      or new.has_unpriced_items is distinct from old.has_unpriced_items
      or new.requires_document_review is distinct from old.requires_document_review)
     and coalesce(current_setting('glow.recalc', true), '') <> 'on' then
    raise exception 'O total é calculado a partir dos itens do pedido: altere as quantidades ou os preços.';
  end if;
  return new;
end;
$$;
