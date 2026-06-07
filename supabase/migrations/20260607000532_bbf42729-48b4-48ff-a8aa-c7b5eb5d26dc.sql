
-- 1. App config: novos campos
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS min_withdraw_amount numeric(12,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS withdraw_fee_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_admin_window_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS terms_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS privacy_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS faq_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rules_text text NOT NULL DEFAULT '';

UPDATE public.app_config SET
  terms_text = CASE WHEN coalesce(terms_text,'')='' THEN
'TERMOS DE USO — ZXMAX

1. ACEITAÇÃO
Ao usar a plataforma ZXMAX você concorda integralmente com estes Termos.

2. SOBRE O SERVIÇO
A ZXMAX é um marketplace de produtos digitais — atuamos como intermediadora entre compradores e vendedores.

3. CONTA
Você é responsável pela segurança da sua conta. Compartilhar credenciais é proibido.

4. PRODUTOS PERMITIDOS
Não é permitido vender conteúdo ilegal, material com direitos autorais sem licença, contas em violação de termos, ou qualquer item proibido pela lei brasileira.

5. PAGAMENTOS E TAXAS
Compras via Pix pela Evopay. A ZXMAX cobra comissão sobre cada venda. Saldo do vendedor fica retido por até 7 dias antes de liberar para saque.

6. SAQUES
Saques manuais em 5 a 7 dias úteis. Mínimo e taxa configurados pela plataforma.

7. DISPUTAS
O comprador pode abrir disputa no chat do pedido. Após 5 minutos sem acordo, um admin entra.

8. PROIBIÇÕES
Golpes, falsas disputas, chargeback fraudulento, lavagem de dinheiro, venda fora da plataforma, contas múltiplas para fraude — banimento e bloqueio dos saldos.

9. ENCERRAMENTO
Podemos suspender contas que violem estes Termos.

10. LIMITAÇÃO
A ZXMAX não se responsabiliza pelo conteúdo de produtos digitais vendidos por terceiros, apenas pela intermediação.'
  ELSE terms_text END,
  privacy_text = CASE WHEN coalesce(privacy_text,'')='' THEN
'POLÍTICA DE PRIVACIDADE — ZXMAX

1. DADOS COLETADOS — nome, e-mail, avatar, ID público, chave Pix (só ao solicitar saque), documentos de verificação.

2. USO — autenticação, pagamentos via Evopay, verificação KYC, prevenção a fraude e comunicação de pedidos.

3. COMPARTILHAMENTO — dados mínimos com a Evopay para gerar Pix. Não vendemos dados.

4. RETENÇÃO — enquanto a conta estiver ativa + período legal (5 anos para registros financeiros).

5. LGPD — você pode pedir acesso, correção, exclusão ou portabilidade dos dados via Suporte.

6. SEGURANÇA — criptografia em trânsito e em repouso. Conteúdo sensível só visível após pagamento confirmado.

7. COOKIES — apenas essenciais de sessão. Sem rastreamento de terceiros.'
  ELSE privacy_text END,
  rules_text = CASE WHEN coalesce(rules_text,'')='' THEN
'REGRAS DA COMUNIDADE — ZXMAX

PARA TODOS
• Respeito entre compradores e vendedores. Ofensas e discurso de ódio = banimento.
• Não tente burlar a comissão pagando por fora — anula a Entrega Garantida.
• Não crie contas falsas para inflar avaliações.

PARA VENDEDORES
• Anúncio claro e honesto. Print enganoso = remoção.
• Entrega manual: responda em até 24h.
• Entrega automática: conteúdo precisa ser válido e único por venda.
• Proibido vender contas roubadas, crackeadas ou keys piratas.

PARA COMPRADORES
• Tente resolver no chat antes de abrir disputa.
• Disputas falsas (usou o produto e pediu reembolso) = bloqueio.
• Confirme a entrega quando tudo estiver certo.

PUNIÇÕES
• Leve: aviso + remoção.
• Reincidência: bloqueio por escopo (compra, venda ou saque).
• Fraude: banimento total + bloqueio dos saldos.'
  ELSE rules_text END,
  faq_text = CASE WHEN coalesce(faq_text,'')='' THEN
'FAQ — PERGUNTAS FREQUENTES

— COMO COMPRAR?
Escolha um produto, clique em Comprar com Pix. Pague no QR ou copia-e-cola. O pedido aparece em Minhas Compras como Pendente e depois vira Pago.

— A ENTREGA É IMEDIATA?
Produtos com Entrega Automática liberam o conteúdo na hora. Produtos com Entrega Manual dependem do vendedor responder no chat (até 24h).

— ESQUECI DE PAGAR E A TELA SUMIU?
Volte em Minhas Compras → clique no pedido pendente → Pagar com Pix reabre o QR.

— COMO RECEBO MEU DINHEIRO (VENDEDOR)?
Saldo fica em Pendente por 7 dias (anti-fraude) e depois libera em Disponível. Saque em Anúncios → Sacar. Mínimo R$ 10. Processamento em 5–7 dias úteis.

— EXISTE SAQUE INSTANTÂNEO?
NÃO. Qualquer um oferecendo saque instantâneo é golpe.

— FUI ENGANADO, E AGORA?
No chat do pedido pago, clique em Abrir Disputa. O outro lado tem 5 min antes do admin entrar. Não exclua o chat — é prova.

— COMO VIRO VENDEDOR VERIFICADO?
Perfil → Verificação. Envie frente e verso do documento + selfie segurando o documento. Análise em até 48h.

— DICAS DE SEGURANÇA
Nunca pague fora da plataforma. Nunca compartilhe senha. Desconfie de descontos absurdos.'
  ELSE faq_text END
WHERE id = 1;

-- 2. Disputes
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS admin_required_at timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;

-- 3. Orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_by uuid,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS checkout_expires_at timestamptz;

-- 4. order_messages
CREATE TABLE IF NOT EXISTS public.order_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL DEFAULT 'user',
  body text,
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_messages TO authenticated;
GRANT ALL ON public.order_messages TO service_role;

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_messages parties read" ON public.order_messages FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role)))
  );

CREATE POLICY "order_messages parties insert" ON public.order_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND o.status IN ('paid','delivered','disputed')
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))
    )
  );

CREATE INDEX IF NOT EXISTS idx_order_messages_order ON public.order_messages(order_id, created_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;

-- 5. mark_order_delivered
CREATE OR REPLACE FUNCTION public.mark_order_delivered(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF o.seller_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas o vendedor ou admin podem entregar';
  END IF;
  IF o.status <> 'paid' THEN RAISE EXCEPTION 'Pedido precisa estar pago'; END IF;
  UPDATE public.orders SET status='delivered' WHERE id=_order_id;
  INSERT INTO public.notifications(user_id, type, title, body)
    VALUES (o.buyer_id, 'order_delivered', 'Pedido entregue', 'O vendedor marcou seu pedido como entregue.');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_order_delivered(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_order_delivered(uuid) TO authenticated;

-- 6. refund_order
CREATE OR REPLACE FUNCTION public.refund_order(_order_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders%ROWTYPE; w public.wallets%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id=_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF o.seller_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas vendedor ou admin podem reembolsar';
  END IF;
  IF o.status NOT IN ('paid','delivered','disputed') THEN
    RAISE EXCEPTION 'Pedido não pode ser reembolsado neste status';
  END IF;
  IF o.refunded_at IS NOT NULL THEN RAISE EXCEPTION 'Pedido já reembolsado'; END IF;

  SELECT * INTO w FROM public.wallets WHERE user_id=o.seller_id;
  IF w.pending_balance >= o.seller_amount THEN
    UPDATE public.wallets SET pending_balance=pending_balance-o.seller_amount WHERE user_id=o.seller_id;
  ELSE
    UPDATE public.wallets SET available_balance=available_balance-o.seller_amount WHERE user_id=o.seller_id;
  END IF;

  UPDATE public.orders SET status='refunded', refunded_at=now(), refunded_by=auth.uid(), refund_reason=_reason WHERE id=_order_id;
  UPDATE public.disputes SET status='resolved', resolution='refunded', updated_at=now() WHERE order_id=_order_id AND status='open';

  INSERT INTO public.notifications(user_id, type, title, body) VALUES
    (o.buyer_id, 'order_refunded', 'Pedido reembolsado', coalesce(_reason,'Seu pedido foi reembolsado.')),
    (o.seller_id, 'order_refunded', 'Reembolso aplicado', 'Pedido reembolsado: '||coalesce(_reason,''));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refund_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_order(uuid, text) TO authenticated;

-- 7. open_order_dispute
CREATE OR REPLACE FUNCTION public.open_order_dispute(_order_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders%ROWTYPE; d_id uuid; win int;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id=_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF o.buyer_id <> auth.uid() AND o.seller_id <> auth.uid() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF o.status NOT IN ('paid','delivered') THEN RAISE EXCEPTION 'Disputa só em pedidos pagos'; END IF;
  SELECT dispute_admin_window_minutes INTO win FROM public.app_config WHERE id=1;
  INSERT INTO public.disputes(order_id, opened_by, reason, status, admin_required_at)
    VALUES (_order_id, auth.uid(), _reason, 'open', now() + make_interval(mins => coalesce(win,5)))
    RETURNING id INTO d_id;
  UPDATE public.orders SET status='disputed' WHERE id=_order_id;
  INSERT INTO public.notifications(user_id, type, title, body) VALUES
    (CASE WHEN auth.uid()=o.buyer_id THEN o.seller_id ELSE o.buyer_id END,
     'dispute_opened', 'Disputa aberta no seu pedido', _reason);
  INSERT INTO public.order_messages(order_id, sender_id, sender_role, body)
    VALUES (_order_id, auth.uid(), 'system', '⚠️ DISPUTA ABERTA: '||_reason||' — Admin em até '||coalesce(win,5)||' min se não houver acordo.');
  RETURN d_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.open_order_dispute(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_order_dispute(uuid, text) TO authenticated;

-- 8. cancel_order_dispute
CREATE OR REPLACE FUNCTION public.cancel_order_dispute(_dispute_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.disputes%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.disputes WHERE id=_dispute_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Disputa não encontrada'; END IF;
  IF d.opened_by <> auth.uid() AND NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF d.status <> 'open' THEN RAISE EXCEPTION 'Disputa não está aberta'; END IF;
  UPDATE public.disputes SET status='resolved', resolution='canceled_by_user', canceled_at=now() WHERE id=_dispute_id;
  UPDATE public.orders SET status='paid' WHERE id=d.order_id AND status='disputed';
  INSERT INTO public.order_messages(order_id, sender_id, sender_role, body)
    VALUES (d.order_id, auth.uid(), 'system', '✅ Disputa cancelada pelo solicitante.');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cancel_order_dispute(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order_dispute(uuid) TO authenticated;

-- 9. Trigger KYC notify
CREATE OR REPLACE FUNCTION public.notify_kyc_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status='approved' THEN
      INSERT INTO public.notifications(user_id, type, title, body)
        VALUES (NEW.user_id,'kyc_approved','Documentos aprovados ✅','Sua verificação foi aprovada. Você agora é Vendedor Verificado.');
      UPDATE public.profiles SET is_verified_seller=true WHERE id=NEW.user_id;
    ELSIF NEW.status='rejected' THEN
      INSERT INTO public.notifications(user_id, type, title, body)
        VALUES (NEW.user_id,'kyc_rejected','Documentos rejeitados ❌', coalesce(NEW.admin_note,'Sua verificação foi rejeitada. Envie novos documentos.'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_kyc_status_notify ON public.seller_documents;
CREATE TRIGGER trg_kyc_status_notify AFTER UPDATE ON public.seller_documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_kyc_status_change();

-- 10. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
