
-- 1) PROFILES: drop public select, restrict to owner/admin; create safe public view
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "profiles owner select" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);
CREATE POLICY "profiles admin select" ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT id, public_id, name, avatar_url, is_verified_seller, created_at
FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) PRODUCTS: hide delivery_content from clients; expose via SECURITY DEFINER fn
REVOKE SELECT (delivery_content) ON public.products FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_product_delivery_content(_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.delivery_content FROM public.products p
  WHERE p.id = _id
    AND (p.seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
$$;
REVOKE EXECUTE ON FUNCTION public.get_product_delivery_content(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_delivery_content(uuid) TO authenticated;

-- 3) DISPUTES: prevent non-admin parties from changing status/resolution
CREATE OR REPLACE FUNCTION public.disputes_restrict_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only admins can change dispute status';
    END IF;
    IF NEW.resolution IS DISTINCT FROM OLD.resolution THEN
      RAISE EXCEPTION 'Only admins can change dispute resolution';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_disputes_restrict_admin_fields ON public.disputes;
CREATE TRIGGER trg_disputes_restrict_admin_fields
BEFORE UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.disputes_restrict_admin_fields();

-- 4) STORAGE report-evidence: add owner/admin update + delete
CREATE POLICY "report owner update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'report-evidence' AND (((auth.uid())::text = (storage.foldername(name))[1]) OR public.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "report owner delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'report-evidence' AND (((auth.uid())::text = (storage.foldername(name))[1]) OR public.has_role(auth.uid(), 'admin'::public.app_role)));

-- 5) STORAGE product-images: restrict reads to owner OR images of approved products
CREATE OR REPLACE FUNCTION public.storage_object_in_approved_product(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.status = 'approved'
      AND (
        p.image_url LIKE '%' || _name OR
        p.banner_url LIKE '%' || _name OR
        p.gallery::text LIKE '%' || _name || '%'
      )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.storage_object_in_approved_product(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_object_in_approved_product(text) TO anon, authenticated;

DROP POLICY IF EXISTS "product-images read auth" ON storage.objects;
CREATE POLICY "product-images read owner or approved" ON storage.objects FOR SELECT
USING (
  bucket_id = 'product-images' AND (
    ((auth.uid())::text = (storage.foldername(name))[1])
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.storage_object_in_approved_product(name)
  )
);

-- 6) Revoke EXECUTE on internal SECURITY DEFINER helpers from API roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_public_id() FROM PUBLIC, anon, authenticated;
