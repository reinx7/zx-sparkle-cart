import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: banned } = await admin.rpc("is_banned", { _user_id: user.id, _scope: "withdraw" });
    if (banned) return json({ error: "Saque bloqueado para esta conta." }, 403);

    const body = await req.json();
    const amount = Number(body.amount);
    if (!amount || amount <= 0) return json({ error: "Valor inválido" }, 400);

    // Sync pix to profile if provided
    const pixKey = String(body.pix_key || "").trim();
    const pixType = String(body.pix_type || "").trim();
    if (!pixKey || !pixType) return json({ error: "Chave Pix obrigatória" }, 400);

    const { data: wallet } = await admin.from("wallets").select("*").eq("user_id", user.id).single();
    if (!wallet || Number(wallet.available_balance) < amount) {
      return json({ error: "Saldo insuficiente" }, 400);
    }

    // Deduct now (hold). Refund on rejection/error.
    await admin.from("wallets").update({
      available_balance: Number(wallet.available_balance) - amount,
    }).eq("user_id", user.id);

    await admin.from("profiles").update({ pix_key: pixKey, pix_type: pixType }).eq("id", user.id);

    const { data: cfg } = await admin.from("app_config").select("withdraw_processing_days_min, withdraw_processing_days_max").eq("id", 1).single();
    const dMax = cfg?.withdraw_processing_days_max ?? 7;
    const estimated = new Date(Date.now() + dMax * 86400000).toISOString();

    const { data: wr, error } = await admin.from("withdraw_requests").insert({
      user_id: user.id, amount, pix_key: pixKey, pix_type: pixType,
      status: "pending", estimated_release_at: estimated,
    }).select().single();
    if (error) return json({ error: error.message }, 500);

    await admin.from("notifications").insert({
      user_id: user.id, type: "withdraw_pending",
      title: "Saque solicitado",
      body: `Seu saque de R$ ${amount.toFixed(2)} será processado em ${cfg?.withdraw_processing_days_min ?? 5} a ${dMax} dias úteis.`,
    });

    return json({ ok: true, withdraw: wr });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
