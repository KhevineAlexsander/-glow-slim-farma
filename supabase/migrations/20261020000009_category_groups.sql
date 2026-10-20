-- =============================================================================
-- Grupos de categorias (um único nível): a loja mostra poucos grupos e, dentro
-- de cada grupo, as subcategorias como filtro. Os produtos continuam ligados à
-- subcategoria; o grupo é só a categoria-mãe.
-- =============================================================================

alter table public.categories
  add column parent_id uuid references public.categories (id) on delete set null;

create index categories_parent_idx on public.categories (parent_id);

-- Só um nível: a mãe não pode ter mãe, e uma categoria com filhas não vira filha.
create or replace function public.categories_check_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'Uma categoria não pode ser grupo de si mesma.' using errcode = '23514';
  end if;
  if exists (select 1 from public.categories where id = new.parent_id and parent_id is not null) then
    raise exception 'O grupo escolhido já está dentro de outro grupo.' using errcode = '23514';
  end if;
  if exists (select 1 from public.categories where parent_id = new.id) then
    raise exception 'Esta categoria é um grupo (tem subcategorias) e não pode ficar dentro de outro.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger categories_check_parent
  before insert or update of parent_id on public.categories
  for each row execute function public.categories_check_parent();
