import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DbWallet {
  available_balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
  total_spent: number;
}
export interface DbProfile {
  id: string;
  public_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  pix_key: string | null;
  pix_type: string | null;
  is_verified_seller: boolean;
  status: string;
  kyc_status: string;
}

export function useUserData(userId: string | null | undefined) {
  const [wallet, setWallet] = useState<DbWallet | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setWallet(null); setProfile(null); setIsAdmin(false); setLoading(false); return; }
    setLoading(true);
    const [{ data: w }, { data: p }, { data: roles }] = await Promise.all([
      supabase.from("wallets").select("available_balance, pending_balance, total_earned, total_withdrawn, total_spent").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("id, public_id, name, email, avatar_url, pix_key, pix_type, is_verified_seller, status, kyc_status").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setWallet(w as any);
    setProfile(p as any);
    setIsAdmin((roles || []).some((r: any) => r.role === "admin"));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { wallet, profile, isAdmin, loading, reload: load };
}
