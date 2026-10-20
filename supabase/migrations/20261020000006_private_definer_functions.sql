-- =============================================================================
-- Alertas 0028/0029 do Security Advisor: funções SECURITY DEFINER expostas na API.
-- Padrão recomendado pelo Supabase: a função privilegiada vive num esquema que a
-- API não expõe (private); no esquema público fica só um invólucro SECURITY INVOKER.
-- A segurança é a mesma: as regras de negócio continuam dentro das funções privadas.
-- As políticas RLS que usam is_admin() referenciam a função pelo OID e continuam
-- apontando para ela depois do ALTER ... SET SCHEMA.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

alter function public.is_admin() set schema private;
alter function public.place_order(jsonb, jsonb) set schema private;
alter function public.admin_dashboard_stats() set schema private;

-- Execução das funções privadas: mesmas permissões de antes.
revoke all on function private.is_admin() from public;
revoke all on function private.place_order(jsonb, jsonb) from public;
revoke all on function private.admin_dashboard_stats() from public;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.place_order(jsonb, jsonb) to anon, authenticated;
grant execute on function private.admin_dashboard_stats() to authenticated;

-- admin_dashboard_stats chamava public.is_admin() pelo nome: aponta para a privada.
create or replace function private.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
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

-- Invólucros públicos (SECURITY INVOKER) chamados pelo site via /rest/v1/rpc/...
create function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.is_admin(); $$;

create function public.place_order(p_customer jsonb, p_items jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.place_order(p_customer, p_items); $$;

create function public.admin_dashboard_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.admin_dashboard_stats(); $$;

revoke all on function public.is_admin() from public;
revoke all on function public.place_order(jsonb, jsonb) from public;
revoke all on function public.admin_dashboard_stats() from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb) to anon, authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
