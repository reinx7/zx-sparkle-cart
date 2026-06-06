
-- Replace SECURITY DEFINER view with a function
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE (
  id uuid,
  public_id text,
  name text,
  avatar_url text,
  is_verified_seller boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.public_id, p.name, p.avatar_url, p.is_verified_seller
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO anon, authenticated;

-- Switch storage helper to SECURITY INVOKER (products has public read for approved)
CREATE OR REPLACE FUNCTION public.storage_object_in_approved_product(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
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

-- Trigger functions should not be callable via the API
REVOKE EXECUTE ON FUNCTION public.disputes_restrict_admin_fields() FROM PUBLIC, anon, authenticated;
