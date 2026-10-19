# Glow Slim Farma — Loja virtual + painel administrativo

Loja virtual em React + TypeScript + Vite + Tailwind, com Supabase (PostgreSQL, autenticação e armazenamento de imagens).
O proprietário administra produtos, preços, categorias, banners, textos, contatos e pedidos pelo painel em `/admin`,
sem mexer em código.

## O que está pronto

| Área | Funcionalidades |
| --- | --- |
| Loja | Página inicial com banners, categorias, Destaques, Mais Vendidos e Ofertas; busca; listagem com filtro por categoria e ordenação por nome/preço; página do produto; carrinho/lista de orçamento; navegação inferior no celular |
| Pedidos | O pedido ou orçamento fica registrado no banco, com preços calculados **no servidor**. Depois, o cliente pode enviar o resumo pelo WhatsApp. **Não há pagamento online.** |
| Painel | Dashboard; produtos (cadastro, edição, várias imagens, arquivar/excluir, **edição de preço direto na lista**, filtros e paginação); categorias; banners; configurações da loja; pedidos com status, histórico e observações; importação CSV |
| Segurança | RLS em todas as tabelas, permissões verificadas no banco, cadastro público desativado, chave `service_role` nunca usada no frontend |

### Regras de negócio garantidas pelo banco

- **Todo produto nasce com preço R$ 0,00.** Um gatilho no banco zera o preço em qualquer inserção, inclusive na importação.
- Preço zero **nunca** aparece como grátis: a loja mostra "Preço sob consulta" ou "Consulte pelo WhatsApp" (configurável).
- Valores em **centavos inteiros**, nunca em ponto flutuante.
- No modo **compra**, só entram no checkout produtos com preço válido e sem restrição. O banco recusa o restante.
- O navegador envia apenas IDs e quantidades. O total é calculado pela função `place_order` com os preços do banco, e o preço aplicado fica gravado em cada item do pedido.
- Valores e dados do cliente registrados no pedido não podem ser alterados depois. O painel muda apenas status, observações e verificação documental.
- Produto vinculado a pedido **não pode ser excluído** (use "Arquivar").
- Produtos marcados como **prescrição** ou **venda restrita**:
  - não exibem preço na loja;
  - nunca entram no checkout normal;
  - **só podem ser publicados depois de marcados como "Revisado pelo responsável técnico"** (restrição no banco);
  - em orçamentos, deixam o pedido marcado como "Verificar documentação" no painel.

## Estrutura

```
src/
  components/   store/ (loja), admin/ (painel), ui/ (botões, toasts, ícones)
  contexts/     configurações da loja, autenticação, carrinho
  lib/          regras puras: dinheiro, preço/exibição, CSV, WhatsApp, slug (com testes)
  pages/        store/ e admin/
  services/     acesso ao Supabase (catálogo público e painel)
supabase/
  migrations/   esquema, RLS, storage e funções
  tests/        testes automatizados do banco (pgTAP)
  criar-admin.sql
importacao/
  catalogo-mr-vitaminas.csv     273 itens transcritos do PDF
  tabela-esthetike-shop.csv     172 itens transcritos do PDF
  imagens/                      imagens extraídas dos PDFs
```

## 1. Configurar o Supabase (produção)

1. Crie um projeto em <https://supabase.com> (plano gratuito serve para começar). Região sugerida: **South America (São Paulo)**.
2. **Aplique o banco** com uma das opções:
   - **CLI (recomendado):**
     ```bash
     npx supabase login
     npx supabase link --project-ref SEU_REF     # o REF está na URL do painel: supabase.com/dashboard/project/SEU_REF
     npx supabase db push                         # aplica as 5 migrations em ordem
     npx supabase db advisors --linked            # deve responder "No issues found"
     ```
   - **SQL Editor:** abra *SQL Editor* e execute **um arquivo por vez, nesta ordem**, o conteúdo de `supabase/migrations/`:
     `20261018000001_schema.sql` → `20261018000002_security.sql` → `20261018000003_storage_admin_select.sql` →
     `20261019000004_catalog_security_invoker.sql` → `20261019000005_search_unaccent.sql`.
3. **Desative o cadastro público:** *Authentication > Sign In / Providers* → desligue **"Allow new users to sign up"**.
   Mantenha o provedor **Email** ligado, porque é por ele que o administrador entra.
4. Em *Authentication > URL Configuration*, coloque em **Site URL** o endereço do site publicado
   (ex.: `https://glowslimfarma.com.br` ou `https://glow-slim-farma.vercel.app`).
5. O bucket de imagens `store-images` é criado pela migration: público para leitura e com envio permitido só a administradores.
6. Em *Project Settings > API Keys*, copie a **Project URL** e a chave pública (**anon** ou **publishable**, que começa com `sb_publishable_`).
   **Nunca** use a chave `service_role`/`secret`: o build recusa essa chave de propósito.
7. Confira *Advisors > Security Advisor*: o projeto foi validado sem nenhum alerta.

## 2. Criar o primeiro administrador

1. *Authentication > Users > Add user > Create new user*: informe e-mail e senha forte e marque **Auto Confirm User**.
2. Abra `supabase/criar-admin.sql`, troque o e-mail e execute no *SQL Editor*.
3. Acesse `https://SEU-SITE/admin` e entre com esse e-mail e senha.

Todo usuário nasce com a permissão `none`. Só quem tem acesso ao painel do Supabase consegue promover alguém a
administrador. Um usuário comum não consegue alterar a própria permissão, e isso está coberto pelos testes.

**Esqueceu a senha do painel?** No Supabase: *Authentication > Users* → clique no usuário → **Send password recovery**
(o e-mail padrão do Supabase tem limite de poucos envios por hora; para volume maior configure um SMTP próprio em
*Authentication > Emails*). Também é possível definir uma nova senha direto nessa tela.

## 3. Executar localmente

Requisitos: Node 20+ e, para o banco local, Docker Desktop.

```bash
npm install
cp .env.example .env        # preencha com URL e chave anon do seu projeto Supabase
npm run dev                 # http://localhost:5173
```

**Banco local opcional, sem precisar de conta:**

```bash
npm run db:start            # sobe o Supabase local e aplica as migrations
npx supabase status         # mostra a API URL e a anon key para o .env.local
```

Crie o admin local em <http://127.0.0.1:54323> (Studio): Authentication > Add user, depois rode `criar-admin.sql` no SQL Editor.

### Testes

```bash
npm test          # regras de preço, dinheiro, CSV, WhatsApp e validação dos CSVs dos catálogos
npm run test:db   # 41 testes do banco: RLS, preço zero, checkout, prescrição, vitrine, busca, histórico
npm run build     # checagem de tipos + build de produção
```

## 4. Importar os produtos dos catálogos

Os dois PDFs fornecidos já foram transcritos para CSV em `importacao/`:

- **Sem preços:** os valores do catálogo foram ignorados, conforme a regra do projeto.
- **Sem as "indicações" do catálogo** (ex.: "acelera perda de peso"): são alegações terapêuticas que precisam de validação antes de qualquer publicação.
- Itens com texto duvidoso no PDF (colunas embaralhadas, erros de digitação, dados faltando ou conflitantes) estão
  marcados como **revisar**, com a explicação e a página de origem no campo de observações.
- Injetáveis e medicamentos vêm marcados como **prescrição**. Preenchedores, toxinas, tirzepatida e itens de uso
  profissional (agulhas, seringas, cateteres) vêm como **venda restrita**. O responsável pode ajustar produto a produto.
- Os catálogos não têm códigos de referência, então a duplicidade é verificada pelo nome. Ao importar o segundo
  arquivo, 6 produtos iguais aos do primeiro são detectados e ignorados automaticamente.

**Passo a passo no painel:**

1. *Importar* → **Escolher arquivo CSV** → selecione `importacao/catalogo-mr-vitaminas.csv`.
2. Confira a pré-visualização (novos, já existentes, erros) e clique em **Confirmar importação**.
3. Repita com `importacao/tabela-esthetike-shop.csv`.
4. Todos os produtos entram **ocultos** e **sem preço**. Em *Produtos*, use os filtros "A revisar" e "Sem preço",
   preencha os preços direto na lista e publique o que estiver pronto.

**Imagens:** as fotos extraídas dos PDFs estão em `importacao/imagens/` (o nome do arquivo indica a página).
Essa pasta fica só na máquina local e não vai para o repositório.
Abra o produto no painel e use **Imagens > Adicionar**. Confirme que você tem direito de uso das fotos de fabricantes.

**Novos catálogos:** baixe o modelo em *Importar > Baixar modelo*, preencha no Excel ou Google Planilhas e salve como CSV.
Colunas de preço são ignoradas de propósito. A leitura automática de PDF não foi incluída no painel porque cada
catálogo tem um layout diferente e a extração automática erra composições, o que é arriscado para medicamentos.

## 5. Publicar o site

É um site estático (SPA), sem servidor próprio: o backend é o Supabase.

### Vercel (recomendado)

1. Envie o projeto para um repositório no GitHub (o `.gitignore` já impede que `.env*`, PDFs originais e fotos de
   fabricantes sejam enviados).
2. Em <https://vercel.com/new>, importe o repositório. O `vercel.json` já define tudo (framework Vite, `npm ci`,
   `npm run build`, pasta `dist`). Não altere essas opções.
3. Em **Environment Variables**, adicione para **Production** e **Preview**:

   | Nome | Valor |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://SEU_REF.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | a chave pública anon/publishable |

   Sem essas variáveis o build **falha de propósito**, com uma mensagem explicando o que falta. Assim um site quebrado não vai para o ar.
4. **Deploy.** Depois, coloque o endereço final em *Supabase > Authentication > URL Configuration > Site URL*.
5. Domínio próprio: *Vercel > Project > Settings > Domains*.

Já vem configurado no `vercel.json`:
- todas as rotas (`/produtos`, `/admin`...) abrem o app, inclusive em link direto ou ao recarregar a página;
- cabeçalhos de segurança: CSP que libera só o próprio site, o Supabase e o Google Fonts; proteção contra
  clickjacking; HSTS; `nosniff`;
- cache de 1 ano para os arquivos com hash em `/assets`;
- `/admin` fora dos buscadores (`noindex` e `robots.txt`).

Se um dia o site carregar imagens ou chamar serviços de outro domínio, ajuste a linha `Content-Security-Policy` do `vercel.json`.

### Netlify (alternativa)

Build `npm run build`, pasta `dist`, mesmas variáveis. O arquivo `public/_redirects` já está incluído.
Os cabeçalhos de segurança do `vercel.json` não se aplicam no Netlify.

### Checklist de publicação

- [ ] Migrations aplicadas e Security Advisor sem alertas
- [ ] Cadastro público desativado no Supabase (Email continua ligado)
- [ ] Primeiro admin criado com `criar-admin.sql`
- [ ] Variáveis definidas na Vercel (Production e Preview)
- [ ] Site URL do Supabase igual ao endereço publicado
- [ ] No painel: WhatsApp, contatos, endereço, informações comerciais (CNPJ, responsável técnico) e políticas preenchidos
- [ ] Catálogos importados; preços definidos; produtos restritos revisados pelo responsável técnico antes de publicar

## 6. Uso diário (proprietário)

| Tarefa | Onde |
| --- | --- |
| Definir/alterar preços | *Produtos* → digite o preço na linha e pressione Enter |
| Publicar/ocultar produto | *Produtos* → botão Publicar/Ocultar, ou dentro do produto |
| Destaque / mais vendido / oferta | Dentro do produto → seção *Vitrine* |
| Trocar banners | *Banners* |
| Logo, nome, cores, contatos, WhatsApp, redes sociais, rodapé, aviso | *Configurações* |
| Modo compra ou orçamento; texto dos produtos sem preço | *Configurações > Vendas* |
| Seções da página inicial | *Configurações > Página inicial* |
| Políticas (privacidade, termos, entregas) | *Configurações > Políticas* |
| Acompanhar pedidos e orçamentos | *Pedidos* |

## Aviso regulatório

O catálogo contém medicamentos, injetáveis e produtos de uso profissional. A venda desses itens está sujeita às normas
da ANVISA (incluindo regras de propaganda de medicamentos e de exigência de prescrição) e do conselho profissional
aplicável. O sistema oferece controles: publicação bloqueada até a revisão, ocultação de preço, exclusão do checkout,
sinalização de documentação e aviso configurável. Ele **não substitui** a análise do responsável técnico nem a
verificação de regularização (registro/notificação, autorização de funcionamento) de cada produto e da empresa.
