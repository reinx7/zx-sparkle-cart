import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DbProduct = Database["public"]["Tables"]["products"]["Row"] & {
  seller_name?: string;
  seller_public_id?: string;
  category_name?: string;
};
export type DbCategory = Database["public"]["Tables"]["categories"]["Row"];

export function useDbProducts(opts: { onlyMine?: boolean; userId?: string | null } = {}) {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const productCols = "id, seller_id, category_id, name, description, price, image_url, banner_url, gallery, delivery_type, variations, stock, sales_count, status, rejection_reason, created_at, updated_at";
    const [{ data: prods }, { data: cats }] = await Promise.all([
      opts.onlyMine && opts.userId
        ? supabase.from("products").select(`${productCols}, categories(name)`).eq("seller_id", opts.userId).order("created_at", { ascending: false })
        : supabase.from("products").select(`${productCols}, categories(name)`).eq("status", "approved").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").eq("active", true).order("sort_order"),
    ]);

    // Fetch seller info via SECURITY DEFINER RPC (safe public fields only)
    let enriched = (prods || []) as any[];
    if (!opts.onlyMine && enriched.length > 0) {
      const sellerIds = [...new Set(enriched.map((p: any) => p.seller_id))];
      const { data: profs } = await (supabase.rpc as any)("get_public_profiles", { _ids: sellerIds });
      const map = new Map(((profs as any[]) || []).map((p: any) => [p.id, p]));
      enriched = enriched.map((p: any) => ({
        ...p,
        seller_name: (map.get(p.seller_id) as any)?.name || "Vendedor",
        seller_public_id: (map.get(p.seller_id) as any)?.public_id,
        seller_verified: (map.get(p.seller_id) as any)?.is_verified_seller,
        category_name: p.categories?.name,
      }));
    } else {
      enriched = enriched.map((p: any) => ({ ...p, category_name: p.categories?.name }));
    }

    setProducts(enriched as DbProduct[]);
    setCategories(cats || []);
    setLoading(false);
  }, [opts.onlyMine, opts.userId]);

  useEffect(() => { load(); }, [load]);

  return { products, categories, loading, reload: load };
}

export async function uploadProductImage(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600", upsert: false,
  });
  if (error) { console.error(error); return null; }
  // Signed URL with long expiry (1 year)
  const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl || null;
}
