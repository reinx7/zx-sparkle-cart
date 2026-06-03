
-- ============ ENUMS ============
CREATE TYPE public.product_status AS ENUM ('draft','pending','approved','rejected','paused');
CREATE TYPE public.order_status AS ENUM ('pending','paid','delivered','disputed','refunded','canceled');
CREATE TYPE public.payment_status AS ENUM ('PENDING','COMPLETED','CANCELED','WAITING_FOR_REFUND','REFUNDED','EXPIRED','ERROR');
CREATE TYPE public.withdraw_status AS ENUM ('pending','approved','processing','completed','rejected');
CREATE TYPE public.ban_scope AS ENUM ('full','sell','buy','withdraw');
CREATE TYPE public.report_status AS ENUM ('open','reviewing','resolved','dismissed');
CREATE TYPE public.dispute_status AS ENUM ('open','seller_response','admin_review','resolved_buyer','resolved_seller');
CREATE TYPE public.ticket_status AS ENUM ('open','answered','closed');
CREATE TYPE public.kyc_doc_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.delivery_type AS ENUM ('auto','manual');

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories read all" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories admin write" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  image_url text,
  banner_url text,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_type public.delivery_type NOT NULL DEFAULT 'manual',
  delivery_content text,
  variations jsonb NOT NULL DEFAULT '[]'::jsonb,
  stock int,
  sales_count int NOT NULL DEFAULT 0,
  status public.product_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_seller ON public.products(seller_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_category ON public.products(category_id);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public read approved" ON public.products FOR SELECT
  USING (status = 'approved' OR seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "products seller insert" ON public.products FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());
CREATE POLICY "products seller update" ON public.products FOR UPDATE TO authenticated
  USING (seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "products admin delete" ON public.products FOR DELETE TO authenticated
  USING (seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ QUESTIONS ============
CREATE TABLE public.product_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question text NOT NULL,
  answer text,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_questions_product ON public.product_questions(product_id);
GRANT SELECT ON public.product_questions TO anon, authenticated;
GRANT INSERT, UPDATE ON public.product_questions TO authenticated;
GRANT ALL ON public.product_questions TO service_role;
ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions read" ON public.product_questions FOR SELECT USING (true);
CREATE POLICY "questions insert auth" ON public.product_questions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "questions seller answer" ON public.product_questions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'));

-- ============ REVIEWS ============
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_id uuid,
  user_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews read all" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews insert own" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id),
  variation jsonb,
  amount numeric(12,2) NOT NULL,
  platform_fee numeric(12,2) NOT NULL DEFAULT 0,
  seller_amount numeric(12,2) NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'pending',
  release_at timestamptz,
  released boolean NOT NULL DEFAULT false,
  delivered_content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX idx_orders_seller ON public.orders(seller_id);
CREATE INDEX idx_orders_status ON public.orders(status);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders parties read" ON public.orders FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'evopay',
  provider_payment_id text UNIQUE,
  status public.payment_status NOT NULL DEFAULT 'PENDING',
  amount numeric(12,2) NOT NULL,
  service_fee numeric(12,2) DEFAULT 0,
  qr_code_text text,
  qr_code_url text,
  raw jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_order ON public.payments(order_id);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments parties read" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ WITHDRAW REQUESTS ============
CREATE TABLE public.withdraw_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  pix_key text NOT NULL,
  pix_type text NOT NULL,
  status public.withdraw_status NOT NULL DEFAULT 'pending',
  provider_withdraw_id text,
  admin_id uuid,
  admin_note text,
  rejection_reason text,
  estimated_release_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_withdraw_user ON public.withdraw_requests(user_id);
CREATE INDEX idx_withdraw_status ON public.withdraw_requests(status);
GRANT SELECT, INSERT ON public.withdraw_requests TO authenticated;
GRANT ALL ON public.withdraw_requests TO service_role;
ALTER TABLE public.withdraw_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdraw own read" ON public.withdraw_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "withdraw own insert" ON public.withdraw_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "withdraw admin update" ON public.withdraw_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER withdraw_updated BEFORE UPDATE ON public.withdraw_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ BANS ============
CREATE TABLE public.bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope public.ban_scope NOT NULL DEFAULT 'full',
  reason text NOT NULL,
  admin_id uuid NOT NULL,
  admin_note text,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bans_user_active ON public.bans(user_id) WHERE active = true;
GRANT SELECT ON public.bans TO authenticated;
GRANT ALL ON public.bans TO service_role;
ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bans user read own" ON public.bans FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "bans admin write" ON public.bans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.is_banned(_user_id uuid, _scope public.ban_scope DEFAULT 'full')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bans
    WHERE user_id = _user_id AND active = true
      AND (scope = 'full' OR scope = _scope)
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- ============ REPORTS ============
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_user_id uuid,
  target_product_id uuid,
  category text NOT NULL,
  description text NOT NULL,
  evidence_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority int NOT NULL DEFAULT 2,
  status public.report_status NOT NULL DEFAULT 'open',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports reporter read" ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "reports insert auth" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports admin update" ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER reports_updated BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ DISPUTES ============
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL,
  reason text NOT NULL,
  status public.dispute_status NOT NULL DEFAULT 'open',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disputes parties read" ON public.disputes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "disputes parties insert" ON public.disputes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())));
CREATE POLICY "disputes parties update" ON public.disputes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())) OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER disputes_updated BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SELLER DOCS (KYC) ============
CREATE TABLE public.seller_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  doc_front_path text,
  doc_back_path text,
  selfie_path text,
  status public.kyc_doc_status NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.seller_documents TO authenticated;
GRANT ALL ON public.seller_documents TO service_role;
ALTER TABLE public.seller_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller_docs own read" ON public.seller_documents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "seller_docs own write" ON public.seller_documents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "seller_docs own update" ON public.seller_documents FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER seller_docs_updated BEFORE UPDATE ON public.seller_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ GATEWAY SETTINGS ============
CREATE TABLE public.gateway_settings (
  id int PRIMARY KEY DEFAULT 1,
  provider text NOT NULL DEFAULT 'evopay',
  enabled boolean NOT NULL DEFAULT true,
  environment text NOT NULL DEFAULT 'live',
  base_url text NOT NULL DEFAULT 'https://api.evopay.cash/v1',
  webhook_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
GRANT SELECT ON public.gateway_settings TO authenticated;
GRANT ALL ON public.gateway_settings TO service_role;
ALTER TABLE public.gateway_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gateway admin read" ON public.gateway_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "gateway admin update" ON public.gateway_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============ SUPPORT TICKETS ============
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  priority int NOT NULL DEFAULT 2,
  subject text NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets own read" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tickets own insert" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "tickets own update" ON public.support_tickets FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER tickets_updated BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif own read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notif own update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ============ ADMIN LOGS ============
CREATE TABLE public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_logs admin read" ON public.admin_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============ AUTO-PROMOTE admin@keybot.com ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  display_name text;
  provider text;
  default_role public.app_role;
BEGIN
  display_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  default_role := CASE WHEN lower(NEW.email) = 'admin@keybot.com' THEN 'admin'::public.app_role ELSE 'user'::public.app_role END;

  INSERT INTO public.profiles (id, public_id, name, email, avatar_url, auth_provider)
  VALUES (NEW.id, public.generate_public_id(), display_name, NEW.email,
          NEW.raw_user_meta_data->>'avatar_url', provider);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, default_role);
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- If admin@keybot.com already exists, promote now
DO $$
DECLARE u uuid;
BEGIN
  SELECT id INTO u FROM auth.users WHERE lower(email) = 'admin@keybot.com' LIMIT 1;
  IF u IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (u, 'admin') ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============ SEED ============
INSERT INTO public.categories (name, slug, sort_order) VALUES
  ('Streaming','streaming',1),
  ('Jogos','jogos',2),
  ('Software','software',3),
  ('eBooks','ebooks',4),
  ('Cursos','cursos',5),
  ('Templates','templates',6),
  ('Outros','outros',99)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.gateway_settings (id, provider, enabled, environment, base_url)
VALUES (1,'evopay',true,'live','https://api.evopay.cash/v1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
