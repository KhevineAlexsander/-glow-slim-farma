-- Testes de regras de negócio e segurança. Execute com:  npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
-- Em produção o pgTAP pode estar em outro esquema: procura nos dois.
set local search_path to public, extensions;
select plan(57);

-- ---------------------------------------------------------------------------
-- Dados de teste (como postgres, ignorando RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000000a1', 'admin@teste.local', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-0000000000b2', 'comum@teste.local', 'authenticated', 'authenticated');

select is((select role from public.profiles where id = '00000000-0000-0000-0000-0000000000b2'),
          'none', 'novo usuário nasce sem permissão de admin');

insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000c3', 'cadastro@teste.local', 'authenticated', 'authenticated',
        '{"full_name":"Cliente Novo","phone":"(11) 96666-5555","role":"admin"}');
select is((select full_name || '|' || phone || '|' || role from public.profiles where id = '00000000-0000-0000-0000-0000000000c3'),
          'Cliente Novo|11966665555|none', 'cadastro grava nome e telefone, e ignora role enviada pelo cliente');

update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';

insert into public.categories (id, name, slug) values ('10000000-0000-0000-0000-000000000001', 'Teste pgTAP', 'teste-pgtap');

insert into public.products (id, name, slug, sku, category_id, price_cents, promo_price_cents, status)
values ('20000000-0000-0000-0000-000000000001', 'Produto Com Preço', 'produto-com-preco', 'P1',
        '10000000-0000-0000-0000-000000000001', 99999, 500, 'published');

select is((select price_cents from public.products where sku = 'P1'), 0,
          'todo produto é criado com preço zero, mesmo se enviado outro valor');
select is((select promo_price_cents from public.products where sku = 'P1'), null,
          'preço promocional também é zerado na criação');

update public.products set price_cents = 10000, promo_price_cents = 8000 where sku = 'P1';

insert into public.products (id, name, slug, sku, status)
values ('20000000-0000-0000-0000-000000000002', 'Produto Sem Preço', 'produto-sem-preco', 'P2', 'published'),
       ('20000000-0000-0000-0000-000000000004', 'Rascunho', 'rascunho', 'P4', 'draft');

select throws_ok(
  $$insert into public.products (name, slug, status, requires_prescription) values ('Rx', 'rx', 'published', true)$$,
  '23514', null, 'produto com prescrição não pode ser publicado sem revisão do responsável');

insert into public.products (id, name, slug, sku, status, requires_prescription, compliance_reviewed)
values ('20000000-0000-0000-0000-000000000003', 'Produto Rx', 'produto-rx', 'P3', 'published', true, true);
update public.products set price_cents = 5000 where sku = 'P3';

select throws_ok(
  $$update public.products set promo_price_cents = 20000 where sku = 'P1'$$,
  '23514', null, 'promoção maior que o preço é rejeitada');

-- Grupos de categorias: um único nível
insert into public.categories (id, name, slug) values ('10000000-0000-0000-0000-000000000010', 'Grupo pgTAP', 'grupo-pgtap');
update public.categories set parent_id = '10000000-0000-0000-0000-000000000010' where id = '10000000-0000-0000-0000-000000000001';
select is((select parent_id from public.categories where id = '10000000-0000-0000-0000-000000000001'),
          '10000000-0000-0000-0000-000000000010'::uuid, 'categoria entra num grupo');
select throws_ok($$update public.categories set parent_id = '10000000-0000-0000-0000-000000000001' where id = '10000000-0000-0000-0000-000000000010'$$,
                 '23514', null, 'grupo com subcategorias não vira subcategoria');
select throws_ok($$insert into public.categories (name, slug, parent_id) values ('Neta', 'neta-pgtap', '10000000-0000-0000-0000-000000000001')$$,
                 '23514', null, 'só um nível de grupo');

-- Os testes de orçamento abaixo exigem o modo orçamento (independe do estado do banco)
update public.store_settings set sales_mode = 'quote';

-- Produto publicado dentro de categoria oculta + imagens
insert into public.categories (id, name, slug, is_visible) values ('10000000-0000-0000-0000-000000000002', 'Oculta pgTAP', 'oculta-pgtap', false);
insert into public.products (id, name, slug, sku, category_id, status)
values ('20000000-0000-0000-0000-000000000005', 'Em Categoria Oculta', 'em-categoria-oculta', 'P5',
        '10000000-0000-0000-0000-000000000002', 'published');
insert into public.product_images (product_id, url) values
  ('20000000-0000-0000-0000-000000000001', 'https://exemplo.local/p1.png'),
  ('20000000-0000-0000-0000-000000000004', 'https://exemplo.local/rascunho.png');

-- ---------------------------------------------------------------------------
-- Visitante (anon)
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok($$select * from public.products$$, '42501', null, 'anon não lê a tabela products diretamente');
select is((select count(*)::int from public.catalog_products where sku in ('P1','P2','P3','P4')), 3, 'anon vê apenas produtos publicados na vitrine');
select is((select count(*)::int from public.catalog_products where slug = 'rascunho'), 0, 'rascunho não aparece');
select throws_ok($$select review_notes from public.catalog_products$$, '42703', null,
                 'notas internas não existem na vitrine');
select throws_ok($$select review_notes from public.products$$, '42501', null,
                 'anon não lê notas internas pela tabela');
select throws_ok($$select price_cents from public.products$$, '42501', null,
                 'anon não lê o preço bruto pela tabela');
select is((select price_cents from public.catalog_products where sku = 'P3'), 0,
          'preço de produto com prescrição não é exposto ao público');
select is((select price_cents || '/' || promo_price_cents from public.catalog_products where sku = 'P1'), '10000/8000',
          'preço e promoção de produto comum aparecem na vitrine');
select is((select count(*)::int from public.catalog_products where sku = 'P5'), 0,
          'produto de categoria oculta não aparece');
select is((select images::text from public.catalog_products where sku = 'P1'),
          '[{"url" : "https://exemplo.local/p1.png", "alt" : null}]', 'vitrine traz as imagens do produto');
select throws_ok($$select * from public.product_images$$, '42501', null,
                 'anon não lê a tabela de imagens diretamente (só pela vitrine)');
select is((select count(*)::int from public.catalog_products where search_text like '%produto com preco%'), 1,
          'busca ignora acentos e maiúsculas');
select throws_ok($$update public.store_settings set store_name = 'hack'$$, '42501', null,
                 'anon não altera configurações');
select throws_ok($$insert into public.categories (name, slug) values ('x', 'x')$$, '42501', null,
                 'anon não cria categorias');
select throws_ok($$select * from public.orders$$, '42501', null, 'anon não lê pedidos');
select throws_ok($$insert into public.orders (kind, customer_name, customer_phone) values ('order', 'x', '11999999999')$$,
                 '42501', null, 'anon não insere pedido direto (só via place_order)');
select throws_ok($$select public.admin_dashboard_stats()$$, '42501', null, 'anon não acessa estatísticas');

-- Modo orçamento (padrão)
select is(
  (public.place_order('{"name":"Ana","phone":"(11) 99999-0000"}',
    '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":2},
      {"product_id":"20000000-0000-0000-0000-000000000002","quantity":1},
      {"product_id":"20000000-0000-0000-0000-000000000003","quantity":1}]') ->> 'total_cents')::int,
  16000, 'orçamento: total usa preço promocional do banco e ignora itens sem preço/restritos');

reset role;
select is((select count(*)::int from public.order_items oi join public.orders o on o.id = oi.order_id
           where o.customer_name = 'Ana' and oi.unit_price_cents is null), 2,
          'orçamento: itens sem preço e com prescrição ficam sem valor');
select ok((select requires_document_review and has_unpriced_items and kind = 'quote'
             from public.orders where customer_name = 'Ana'),
          'orçamento com item de prescrição exige verificação documental');
select is((select count(*)::int from public.order_status_history h join public.orders o on o.id = h.order_id
           where o.customer_name = 'Ana'), 1, 'histórico registra a criação do pedido');

-- Modo pedido
update public.store_settings set sales_mode = 'order';
set local role anon;

select is(
  (public.place_order('{"name":"Bia","phone":"11988887777"}',
    '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":3}]') ->> 'total_cents')::int,
  24000, 'pedido: total calculado no servidor (3 x R$ 80,00)');
select throws_ok(
  $$select public.place_order('{"name":"Bia","phone":"11988887777"}',
    '[{"product_id":"20000000-0000-0000-0000-000000000002","quantity":1}]')$$,
  '22023', null, 'pedido: produto sem preço não passa pelo checkout');
select throws_ok(
  $$select public.place_order('{"name":"Bia","phone":"11988887777"}',
    '[{"product_id":"20000000-0000-0000-0000-000000000003","quantity":1}]')$$,
  '22023', null, 'pedido: produto com prescrição não passa pelo checkout');
select throws_ok(
  $$select public.place_order('{"name":"Bia","phone":"11988887777"}',
    '[{"product_id":"20000000-0000-0000-0000-000000000004","quantity":1}]')$$,
  '22023', null, 'pedido: rascunho não pode ser comprado');
select throws_ok(
  $$select public.place_order('{"name":"Bia","phone":"123"}',
    '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":1}]')$$,
  '22023', null, 'telefone inválido é rejeitado');
select throws_ok(
  $$select public.place_order('{"name":"Bia","phone":"11988887777"}',
    '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":0}]')$$,
  '22023', null, 'quantidade inválida é rejeitada');

-- ---------------------------------------------------------------------------
-- Usuário autenticado sem permissão
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

select is((select count(*)::int from public.products), 0, 'usuário comum não lê produtos do painel');
update public.products set price_cents = 1 where sku = 'P1';
select throws_ok($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b2'$$, '42501', null,
                 'cliente não consegue alterar a própria permissão');
select is(public.is_admin(), false, 'usuário comum não consegue se promover a admin');
select is((select count(*)::int from public.orders), 0, 'cliente não vê pedidos de outras pessoas');
select is((select count(*)::int from public.catalog_products where sku in ('P1','P2','P3','P4','P5')), 3,
          'cliente logado vê a vitrine (só publicados, sem categoria oculta)');
select is((select price_cents from public.catalog_products where sku = 'P3'), 0,
          'cliente logado também não vê preço de produto com prescrição');
select lives_ok($$update public.profiles set full_name = 'Cliente B', phone = '11977776666' where id = '00000000-0000-0000-0000-0000000000b2'$$,
                'cliente atualiza o próprio nome e telefone');
update public.profiles set full_name = 'invadido' where id = '00000000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 0, 'cliente não vê o perfil de outra pessoa');
select ok((public.place_order('{"name":"Cliente B","phone":"11977776666"}',
             '[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":1}]') ->> 'order_number') is not null,
          'cliente logado faz pedido');
select is((select count(*)::int from public.orders), 1, 'cliente vê o próprio pedido');
select is((select count(*)::int from public.order_items), 1, 'cliente vê os itens do próprio pedido');
select is((select count(*)::int from public.order_status_history), 1, 'cliente vê o histórico do próprio pedido');

-- ---------------------------------------------------------------------------
-- Administrador
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select is((select price_cents from public.products where sku = 'P1'), 10000,
          'preço não foi alterado pelo usuário comum');
select lives_ok($$update public.products set price_cents = 12345 where sku = 'P2'$$, 'admin altera preço');
select is((select count(*)::int from public.orders where customer_name in ('Ana','Bia')), 2, 'admin lê pedidos');
select is((select count(*)::int from public.orders where customer_name = 'Cliente B' and user_id = '00000000-0000-0000-0000-0000000000b2'), 1,
          'pedido do cliente logado fica ligado à conta');
select is((select count(*)::int from public.orders where customer_name in ('Ana','Bia') and user_id is null), 2,
          'pedido de visitante fica sem conta');
select isnt((select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'invadido', 'cliente não altera o perfil de outra pessoa');
select lives_ok(
  $$update public.orders set status = 'in_review', documents_verified = true where customer_name = 'Ana'$$,
  'admin altera status do pedido');
select throws_ok($$update public.orders set total_cents = 1 where customer_name = 'Ana'$$, 'P0001', null,
                 'valores registrados no pedido não podem ser alterados');
select throws_ok($$delete from public.products where sku = 'P1'$$, '23503', null,
                 'produto vinculado a pedido não pode ser excluído');

select * from finish();
rollback;
