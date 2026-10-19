-- =============================================================================
-- Promover um usuário a ADMINISTRADOR do painel.
--
-- 1) No Supabase: Authentication > Users > "Add user" > "Create new user"
--    (informe e-mail e senha forte; marque "Auto Confirm User").
-- 2) Troque o e-mail abaixo e execute este script no SQL Editor do Supabase.
--
-- Somente quem tem acesso ao painel do Supabase consegue fazer isso.
-- Visitantes do site não conseguem se cadastrar nem se promover.
-- =============================================================================
update public.profiles
   set role = 'admin'
 where email = 'email-do-proprietario@exemplo.com'
returning id, email, role;

-- Para remover o acesso de alguém:
-- update public.profiles set role = 'none' where email = 'pessoa@exemplo.com';
