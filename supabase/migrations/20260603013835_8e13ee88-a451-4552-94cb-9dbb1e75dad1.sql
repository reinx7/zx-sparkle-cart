
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('user', 'seller', 'admin');
CREATE TYPE public.user_status AS ENUM ('active', 'suspended', 'banned', 'pending_review');
CREATE TYPE public.kyc_status AS ENUM ('not_submitted', 'in_review', 'approved', 'rejected');

-- =========================
-- PUBLIC ID GENERATOR
-- =========================
CREATE OR REPLACE FUNCTION public.generate_public_id()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
  attempt int := 0;
BEGIN
  LOOP
    result := 'ZX-';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE public_id = result) THEN
      RETURN result;
    END IF;
    attempt := attempt + 1;
    IF attempt > 10 THEN
      RAISE EXCEPTION 'Could not generate unique public_id';
    END IF;
  END LOOP;
END;
$$;

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  public_id text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT '',
  email text,
  avatar_url text,
  phone text,
  pix_key text,
  pix_type text,
  auth_provider text DEFAULT 'email',
  status public.user_status NOT NULL DEFAULT 'active',
  kyc_status public.kyc_status NOT NULL DEFAULT 'not_submitted',
  is_verified_seller boolean NOT NULL DEFAULT false,
  banned_reason text,
  banned_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================
-- USER ROLES
-- =========================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- =========================
-- WALLETS
-- =========================
CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pending_balance numeric(12,2) NOT NULL DEFAULT 0,
  available_balance numeric(12,2) NOT NULL DEFAULT 0,
  total_earned numeric(12,2) NOT NULL DEFAULT 0,
  total_withdrawn numeric(12,2) NOT NULL DEFAULT 0,
  total_spent numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- =========================
-- AUTH SETTINGS (singleton)
-- =========================
CREATE TABLE public.auth_settings (
  id int PRIMARY KEY DEFAULT 1,
  email_enabled boolean NOT NULL DEFAULT true,
  google_enabled boolean NOT NULL DEFAULT true,
  discord_enabled boolean NOT NULL DEFAULT false,
  registration_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_settings_singleton CHECK (id = 1)
);

INSERT INTO public.auth_settings (id) VALUES (1);

GRANT SELECT ON public.auth_settings TO anon, authenticated;
GRANT ALL ON public.auth_settings TO service_role;

ALTER TABLE public.auth_settings ENABLE ROW LEVEL SECURITY;

-- =========================
-- APP CONFIG (singleton)
-- =========================
CREATE TABLE public.app_config (
  id int PRIMARY KEY DEFAULT 1,
  site_name text NOT NULL DEFAULT 'ZXMAX',
  logo_url text,
  discord_link text DEFAULT '',
  platform_fee_percent numeric(5,2) NOT NULL DEFAULT 10,
  withdraw_processing_days_min int NOT NULL DEFAULT 5,
  withdraw_processing_days_max int NOT NULL DEFAULT 7,
  balance_release_days int NOT NULL DEFAULT 7,
  maintenance_mode boolean NOT NULL DEFAULT false,
  global_notice text DEFAULT '',
  terms_url text,
  privacy_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_config_singleton CHECK (id = 1)
);

INSERT INTO public.app_config (id) VALUES (1);

GRANT SELECT ON public.app_config TO anon, authenticated;
GRANT ALL ON public.app_config TO service_role;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- =========================
-- POLICIES
-- =========================

-- profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users see own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- wallets
CREATE POLICY "Users see own wallet"
  ON public.wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- auth_settings
CREATE POLICY "Anyone reads auth settings"
  ON public.auth_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins update auth settings"
  ON public.auth_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- app_config
CREATE POLICY "Anyone reads app config"
  ON public.app_config FOR SELECT
  USING (true);

CREATE POLICY "Admins update app config"
  ON public.app_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- SIGNUP TRIGGER
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display_name text;
  provider text;
BEGIN
  display_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

  INSERT INTO public.profiles (id, public_id, name, email, avatar_url, auth_provider)
  VALUES (
    NEW.id,
    public.generate_public_id(),
    display_name,
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    provider
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- updated_at helper
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER wallets_updated BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER auth_settings_updated BEFORE UPDATE ON public.auth_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_config_updated BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
