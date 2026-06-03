# Plano — ZXMAX Marketplace Profissional

O escopo enviado é enorme (≈20 áreas, dezenas de telas, backend completo, gateway, moderação, KYC, disputas). Não é realista entregar tudo em uma única iteração sem quebrar o que já existe. Proponho dividir em **5 fases**, entregando cada uma funcional e testada antes de seguir.

Hoje o app é 100% `localStorage`, sem backend, sem auth real, sem uploads reais. Para fazer o que você pediu (IDs únicos, banimento real, Evopay com webhook, documentos, saques aprovados pelo admin, segurança), **precisamos ativar Lovable Cloud** (banco Postgres + auth + storage + edge functions). Sem isso nada acima é seguro nem persistente entre dispositivos.

---

## Fase 1 — Fundação (Cloud + Auth + Migração de dados)
- Ativar **Lovable Cloud**.
- Auth: Email/Senha + Google + Discord (Discord exige conectar Supabase próprio; confirmar se OK ou se mantemos só Email + Google nativos).
- Tabelas: `profiles` (com `public_id` tipo `ZX-XXXXXX`), `user_roles` (user/seller/admin), `auth_settings`, `app_config`.
- Trigger para criar profile + public_id + wallet no signup.
- RLS em todas as tabelas.
- Tela de login refeita (mostrar/ocultar senha, validação, loading, recuperar senha, /reset-password).
- Migrar componentes existentes para ler do banco em vez de `localStorage`.

## Fase 2 — Produtos + Uploads + Loja (corrigir bugs críticos)
- Corrigir formulário de criar produto (reload, scroll mobile, inputs travando).
- Storage buckets: `product-images`, `documents` (privado), `report-evidence` (privado).
- Upload real com preview, progresso, validação de tipo/tamanho, múltiplas imagens.
- Tabelas: `products`, `categories`, `product_questions`, `reviews`.
- Listagem na loja com filtro/busca/categoria, status approved.
- Página de produto com perguntas, avaliações, perfil público do vendedor.
- Painel admin: aprovar/reprovar/pausar produtos, gerenciar categorias.

## Fase 3 — Pagamentos Evopay + Pedidos + Carteira/Saques
- Edge functions: `evopay-create-payment`, `evopay-webhook`, `request-withdraw`, `admin-approve-withdraw`.
- Tabelas: `orders`, `payments`, `wallets`, `withdraw_requests`, `gateway_settings`.
- Aba admin "Pagamentos/Evopay" (URL, API key, secret, webhook secret, ambiente, testar conexão, logs).
- Secrets via Lovable Cloud (nunca no frontend).
- Fluxo: comprar → criar cobrança Evopay → webhook → saldo pendente → liberar após X dias → vendedor pede saque (só normal, 5–7 dias úteis) → admin aprova.
- Remover saque instantâneo e qualquer menção a Stripe como gateway principal.
- **Preciso da documentação da API Evopay** (endpoints, autenticação, formato de webhook). Você tem o link da doc ou exemplo de requisição? `https://processamento.evopay.cash/` sozinho não basta.

## Fase 4 — Moderação (Banimento + Denúncias + Disputas + KYC)
- Tabelas: `bans`, `reports`, `disputes`, `seller_documents`.
- Admin busca usuário por `public_id`/email/nome → modal com ações (banir/suspender/bloquear venda/compra/saque) + motivo + nota.
- Middleware que bloqueia usuário banido em todas as rotas sensíveis.
- Denúncias com upload de prints, prioridade, status, filtros no admin.
- Disputas em pedidos (comprador abre → vendedor responde → admin decide reembolso).
- KYC: upload de documentos (frente/verso/selfie), status (não enviado/em análise/aprovado/recusado), selo "Vendedor Verificado".

## Fase 5 — Suporte, Notificações, Polimento Mobile, Admin Completo
- Tickets de suporte (categorias, prioridade, anexos, respostas).
- Sistema de notificações in-app (sino com contagem, marcar como lida).
- Dashboard admin com métricas reais (usuários, vendas, volume, pendências).
- Logs de admin (`admin_logs`).
- Avisos globais, configurações de site, modo manutenção.
- Pass final de UX mobile: bottom nav não cobre botões, modais cabem na tela, abas roláveis, skeletons, empty states, toasts consistentes.

---

## Detalhes técnicos
- **Stack**: React + Vite + Tailwind + shadcn (já existente) + Lovable Cloud (Postgres + Auth + Storage + Edge Functions Deno).
- **IDs públicos**: função SQL gera `ZX-` + 6 chars base32, garantida única por constraint.
- **Roles**: tabela `user_roles` separada + função `has_role()` security definer (evita escalada de privilégio).
- **Financeiro**: todo cálculo de saldo/taxa/liberação roda em edge function, nunca no cliente.
- **Webhooks Evopay**: validados por assinatura HMAC, idempotentes por `provider_payment_id`.
- **Storage**: documentos privados com signed URLs; imagens de produto públicas.

---

## O que preciso de você antes de começar
1. **Confirmar ativação do Lovable Cloud** (obrigatório).
2. **Documentação/credenciais da Evopay** (endpoints da API, formato de webhook, modo sandbox). Sem isso a Fase 3 fica bloqueada.
3. **Discord login**: posso seguir só com Email + Google nativos? Discord exige você conectar um projeto Supabase próprio.
4. **Por onde começar?** Recomendo **Fase 1 + Fase 2** nesta primeira rodada — resolve os bugs críticos (upload, criar produto, mobile, IDs únicos, login real) e cria a base para o resto. Fases 3–5 nas rodadas seguintes.

Posso começar pela Fase 1+2 assim que você aprovar e responder os 4 itens acima.