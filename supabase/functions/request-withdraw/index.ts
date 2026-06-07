import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function authUser(req: Request) {
  const h = req.headers.get("Authorization") || "";
  const token = h.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await authUser(req);
    if (!user) return json({ error: "Faça login" }, 401);

    const { data: banned } = await admin.rpc("is_banned", { _user_id: user.id, _scope: "withdraw" });
    if (banned) return json({ error: "Saque bloqueado para esta conta." }, 403);

    const body = await req.json();
    const amount = Number(body.amount);
    const pixKey = String(body.pix_key || "").trim();
    const pixType = String(body.pix_type || "").trim();
    if (!amount || amount <= 0) return json({ error: "Valor inválido" }, 400);
    if (!pixKey || !pixType) return json({ error: "Chave Pix obrigatória" }, 400);

    const { data: cfg } = await admin.from("app_config").select("min_withdraw_amount, withdraw_fee_percent, withdraw_processing_days_min, withdraw_processing_days_max").eq("id", 1).single();
    const minAmount = Number(cfg?.min_withdraw_amount ?? 10);
    const feePct = Number(cfg?.withdraw_fee_percent ?? 0);
    if (amount < minAmount) return json({ error: `Saque mínimo: R$ ${minAmount.toFixed(2)}` }, 400);

    const { data: wallet } = await admin.from("wallets").select("*").eq("user_id", user.id).single();
    if (!wallet || Number(wallet.available_balance) < amount) return json({ error: "Saldo insuficiente" }, 400);

    const fee = +(amount * feePct / 100).toFixed(2);
    const netAmount = +(amount - fee).toFixed(2);

    await admin.from("wallets").update({ available_balance: Number(wallet.available_balance) - amount }).eq("user_id", user.id);
    await admin.from("profiles").update({ pix_key: pixKey, pix_type: pixType }).eq("id", user.id);

    const dMax = cfg?.withdraw_processing_days_max ?? 7;
    const estimated = new Date(Date.now() + dMax * 86400000).toISOString();

    const { data: wr, error } = await admin.from("withdraw_requests").insert({
      user_id: user.id, amount: netAmount, pix_key: pixKey, pix_type: pixType,
      status: "pending", estimated_release_at: estimated,
      admin_note: fee > 0 ? `Taxa: R$ ${fee.toFixed(2)} (bruto R$ ${amount.toFixed(2)})` : null,
    }).select().single();
    if (error) return json({ error: error.message }, 500);

    await admin.from("notifications").insert({
      user_id: user.id, type: "withdraw_pending",
      title: "Saque solicitado",
      body: `R$ ${netAmount.toFixed(2)}${fee > 0 ? ` (taxa R$ ${fee.toFixed(2)})` : ""} em ${cfg?.withdraw_processing_days_min ?? 5}–${dMax} dias úteis.`,
    });

    return json({ ok: true, withdraw: wr, fee, net: netAmount });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
