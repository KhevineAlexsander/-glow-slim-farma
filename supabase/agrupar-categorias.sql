-- =============================================================================
-- Agrupa as 16 categorias dos catálogos em 6 grupos (pode rodar mais de uma vez).
-- Execute no SQL Editor do Supabase. Categorias não encontradas são ignoradas;
-- depois é possível ajustar tudo pelo painel (Categorias > Editar > Grupo).
-- =============================================================================

-- 1) Grupos novos (Capilar e Correlatos já são categorias únicas e viram grupos sozinhas)
insert into public.categories (name, slug, icon, sort_order, is_visible) values
  ('Emagrecimento e Corpo',   'emagrecimento-e-corpo',   'scale',    1, true),
  ('Estética Facial',         'estetica-facial',         'sparkles', 2, true),
  ('Vitaminas e Soroterapia', 'vitaminas-e-soroterapia', 'droplet',  4, true),
  ('Ativos e Medicamentos',   'ativos-e-medicamentos',   'syringe',  5, true)
on conflict (slug) do nothing;

-- 2) Subcategorias em cada grupo
with mapa(filha, grupo) as (values
  ('gordura-localizada-e-peso',  'emagrecimento-e-corpo'),
  ('gluteo-celulite-e-musculo',  'emagrecimento-e-corpo'),
  ('facial-e-skinbooster',       'estetica-facial'),
  ('melasma-e-clareamento',      'estetica-facial'),
  ('toxina-botulinica',          'estetica-facial'),
  ('preenchedores',              'estetica-facial'),
  ('vitaminas-injetaveis',       'vitaminas-e-soroterapia'),
  ('aminoacidos',                'vitaminas-e-soroterapia'),
  ('minerais',                   'vitaminas-e-soroterapia'),
  ('soroterapia',                'vitaminas-e-soroterapia'),
  ('ativos-injetaveis',          'ativos-e-medicamentos'),
  ('anestesicos',                'ativos-e-medicamentos'),
  ('medicamentos-injetaveis',    'ativos-e-medicamentos'),
  ('soros-e-diluentes',          'ativos-e-medicamentos')
)
update public.categories c
   set parent_id = g.id
  from mapa m
  join public.categories g on g.slug = m.grupo
 where c.slug = m.filha
   and c.parent_id is distinct from g.id;

-- 3) Grupos de categoria única: ícone e ordem
update public.categories set icon = 'scissors', sort_order = 3 where slug = 'capilar' and parent_id is null;
update public.categories set icon = 'package',  sort_order = 6 where slug = 'correlatos-e-descartaveis' and parent_id is null;

-- Conferência
select coalesce(g.name, c.name) as grupo, case when c.parent_id is null then '—' else c.name end as subcategoria
  from public.categories c
  left join public.categories g on g.id = c.parent_id
 order by coalesce(g.sort_order, c.sort_order), grupo, c.parent_id nulls first, c.name;
