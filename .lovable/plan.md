## Objetivo

Fechar o ciclo completo de venda usando o banco (Lovable Cloud) em vez do localStorage atual:

- editar/excluir os próprios produtos
- comprar → ver como **Pendente** em "Minhas Compras" e **conseguir voltar ao Pix** mesmo se trocar de aba
- depois de pago: chat liberado, e conteúdo automático aparece (se for entrega "auto")
- vendedor enxerga as compras recebidas e usa o chat para entregar manualmente

## O que muda

### 1. Editar e excluir produtos (Anúncios)

- Cada card em "Meus Anúncios" ganha botões Editar e Excluir.
- Editar abre o mesmo formulário de criação pré-preenchido (nome, categoria, descrição, preço, imagem, variações, tipo de entrega, conteúdo de entrega automática).
  - Trocar a imagem é opcional.
  - Ao salvar, o produto volta para "Em análise" se algo essencial (preço/conteúdo) mudou; caso contrário mantém o status.
- Excluir pede confirmação. Se o produto já tem pedidos, o sistema oferece "Pausar" no lugar de excluir (não dá pra apagar histórico).

### 2. "Minhas Compras" passando a usar o banco

- Substitui o uso de `localStorage` por consulta direta à tabela `orders` (filtrando `buyer_id = eu`).
- Lista mostra os status reais: **Pendente**, **Pago**, **Entregue**, **Disputa**, **Cancelado**.
- Pedido pendente exibe botão **"Pagar com Pix"** que reabre o modal do Evopay reaproveitando o QR já gerado (busca em `payments` pelo `order_id`). Resolve o caso de "saí da tela e o pagamento sumiu".
  - Se o Pix já expirou, o botão vira **"Gerar novo Pix"**.
- Pedido pago abre a tela de detalhes com:
  - **Entrega automática**: caixa destacada mostrando o conteúdo (chave/login/link) com botão de copiar.
  - **Entrega manual**: caixa "Aguardando o vendedor entregar" + chat liberado.

### 3. Chat de pedido (real, no banco)

- Nova tabela `order_messages` (mensagens trocadas entre comprador e vendedor de um pedido).
- Chat **só fica liberado quando o pedido está pago ou entregue** (regra reforçada no banco).
- Suporta texto e imagem (imagem é enviada para o bucket `report-evidence` numa pasta por pedido; URL assinada no chat).
- Atualização em tempo real (Realtime) para os dois lados verem mensagens novas sem precisar atualizar a página.
- O vendedor pode marcar um pedido manual como "Entregue" depois de enviar o conteúdo pelo chat.

### 4. "Vendas Recebidas" para o vendedor

- Dentro de **Anúncios** ganha duas abas no topo: **Meus Produtos** e **Vendas Recebidas**.
- "Vendas Recebidas" lista todos os pedidos onde sou o vendedor, com filtro por status (pendente, pago, entregue, disputa).
- Cada pedido abre o mesmo chat do comprador + dados da compra (produto, variação, valor, comprador via ID público).
- Para pedidos com entrega manual: botão **"Marcar como entregue"**.

### 5. Pequenos arrumos no fluxo de compra

- Quando o webhook do Evopay confirma o pagamento, o comprador recebe a notificação (já existe) e o pedido pula direto pra "Pago" na lista — sem precisar reabrir o modal de pagamento.
- Modal do Pix agora também pode ser fechado sem perder o pedido: o pedido fica como "Pendente" em "Minhas Compras" e pode ser retomado.

## Tabelas/regras do banco (parte técnica)

- `order_messages`: `id, order_id, sender_id, body (text|null), image_path (text|null), created_at`.
  - Leitura: comprador, vendedor ou admin do pedido.
  - Inserção: comprador ou vendedor do pedido, **somente se** o pedido está `paid` ou `delivered`. Forçar `sender_id = auth.uid()`.
  - Realtime habilitado.
- Storage `order-attachments` (novo bucket privado): caminho `<order_id>/<auth.uid()>/<arquivo>`. Leitura/escrita restritas às partes do pedido. (Não reaproveitamos `report-evidence` pra não misturar fluxos.)
- `products`: já tem políticas de update/delete pelo dono — UI vai usar `update` direto e `delete` (com tratamento amigável quando houver FK de `orders`, sugerindo pausar).
- Edge function nova `mark-order-delivered`: vendedor marca pedido manual como entregue (valida vendedor + status `paid`).
- `EvopayCheckoutModal` ganha modo "retomar": recebe `orderId` em vez de `productId` e busca o QR existente em `payments`.

## Fora de escopo agora

- Sistema de notificações em tempo real (sino) com push.
- Notas/avaliações no banco (hoje vivem no `useStore`; vou deixar a UI antiga só pra entregues manuais até a próxima rodada).
- Disputas no fluxo novo (continuam só pela visão antiga até a Fase 4).

## Ordem de execução

1. Migração: `order_messages` + políticas + bucket `order-attachments` + função `mark-order-delivered`.
2. Anúncios: editar/excluir + aba "Vendas Recebidas".
3. Minhas Compras: passar a ler `orders`, botão "Pagar com Pix" reabrindo o modal.
4. Chat real (componente compartilhado entre comprador e vendedor) + entrega manual.
5. Smoke test: criar produto manual → comprar com outro usuário → reabrir QR depois de trocar aba → pagar → chat libera → vendedor marca entregue.
6. deve aparecer a foto do vendedor no produto quando clicar vai aparecer o perfil dele com o id dele no chat produto também deve aparecer 

&nbsp;

&nbsp;

&nbsp;

&nbsp;

você deve implementar ferramentas que você acha que pode ajudar 

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

ainda tem um erro de quando aperta pra comprar,você deve me garantir que não vai ter mais nenhum erro que vai funcionar tudo certinho,erro " Edge function returned 401: Error, {"error":"Unauthorized"}

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

{

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

  "timestamp": 1780787327234,

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

  "error_type": "RUNTIME_ERROR",

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

  "filename": "supabase/functions/evopay-create-payment/index.ts",

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

  "lineno": 0,

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

  "colno": 0,

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

  "stack": "not_applicable",

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

  "has_blank_screen": true" 

&nbsp;

&nbsp;

&nbsp;

Ainda tem alguma falhas de segurança,tudo tem que funcionar corretamente

&nbsp;

&nbsp;

&nbsp;

Remova aquilo de" Saque Instantâneo (taxa 7%) " para não der golpes futuros, quando eu clico para verificar os documentos do usuário simplesmente some os botões de aprovar e rejeitar, quando eu aprovar ou rejeitar deve aparecer nas notificações uma mensagem dizendo ou que foi aprovado os documentos ou que foi rejeitado, coloque um lugar para regras, privacidade, FAQ,etc e crie todos os textos para esta opções,crie um sistema de notificação quando o usuário aceitar o navegador vai conseguir mandar notificação quando tiver atualizações da minha loja,eu mesmo vou conseguir sacar o dinheiro ali mesmo no painel de admin então implemente isso, lembrando que deve ter uma taxa,o saque mínimo para o usuário é de 10 reais não se esqueça que temos uma taxa que no painel de admin posso configurar ela,no chat do produto deve ter um lugar para fazer uma disputa onde quando fazer deve ter um time de 5 minutos para um admin chegar lá quando o usuário clicar ele vai colocar o motivo deve ter uma opção para o usuário cancelar também,se caso o usuário levar um golpe lá vai deve ter uma opção para ou o admin para reembolsar o dinheiro ou para o vendedor reembolsar o dinheiro essa opção não deve aparecer para o usuário normal.

&nbsp;

Você deve corrigir o sistema de segurança se tiver algum erro.

&nbsp;

&nbsp;

&nbsp;

você deve fazer tudo de uma vez e devagar para não ter erros porque meus créditos da lovable não são infinitos.