import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOPAY_API_TOKEN = Deno.env.get("EVOPAY_API_TOKEN")!;
const EVOPAY_BASE = "https://api.evopay.cash/v1";

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
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admin only" }, 403);

    const body = await req.json();
    const { withdraw_id, action, note } = body; // action: approve | reject
    if (!withdraw_id || !["approve", "reject"].includes(action)) return json({ error: "Bad request" }, 400);

    const { data: wr } = await admin.from("withdraw_requests").select("*").eq("id", withdraw_id).single();
    if (!wr || wr.status !== "pending") return json({ error: "Solicitação inválida" }, 400);

    if (action === "reject") {
      // refund
      const { data: wallet } = await admin.from("wallets").select("*").eq("user_id", wr.user_id).single();
      if (wallet) {
        await admin.from("wallets").update({
          available_balance: Number(wallet.available_balance) + Number(wr.amount),
        }).eq("user_id", wr.user_id);
      }
      await admin.from("withdraw_requests").update({
        status: "rejected", admin_id: user.id, admin_note: note,
        rejection_reason: note || "Rejeitado pelo admin",
        processed_at: new Date().toISOString(),
      }).eq("id", withdraw_id);
      await admin.from("notifications").insert({
        user_id: wr.user_id, type: "withdraw_rejected",
        title: "Saque rejeitado", body: note || "Seu saque foi rejeitado. Valor devolvido ao saldo.",
      });
      await admin.from("admin_logs").insert({ admin_id: user.id, action: "withdraw_reject", target_type: "withdraw_request", target_id: withdraw_id, meta: { note } });
      return json({ ok: true });
    }

    // Approve: call Evopay withdraw
    const callbackUrl = `${SUPABASE_URL}/functions/v1/evopay-webhook`;
    const evoResp = await fetch(`${EVOPAY_BASE}/withdraw`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${EVOPAY_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(wr.amount),
        pixKey: wr.pix_key,
        pixType: wr.pix_type,
        callbackUrl,
        clientReference: wr.id,
      }),
    });
    const evoData = await evoResp.json();
    if (!evoResp.ok) {
      await admin.from("admin_logs").insert({ admin_id: user.id, action: "withdraw_approve_failed", target_id: withdraw_id, meta: evoData });
      return json({ error: "Evopay falhou", detail: evoData }, 502);
    }

    await admin.from("withdraw_requests").update({
      status: "processing", admin_id: user.id, admin_note: note,
      provider_withdraw_id: evoData.id, processed_at: new Date().toISOString(),
    }).eq("id", withdraw_id);

    // Wallet stats: move from holding -> count as withdrawn (already deducted from available)
    const { data: wallet } = await admin.from("wallets").select("*").eq("user_id", wr.user_id).single();
    if (wallet) {
      await admin.from("wallets").update({
        total_withdrawn: Number(wallet.total_withdrawn) + Number(wr.amount),
      }).eq("user_id", wr.user_id);
    }

    await admin.from("notifications").insert({
      user_id: wr.user_id, type: "withdraw_processing",
      title: "Saque aprovado", body: `Seu saque de R$ ${Number(wr.amount).toFixed(2)} está sendo processado.`,
    });
    await admin.from("admin_logs").insert({ admin_id: user.id, action: "withdraw_approve", target_type: "withdraw_request", target_id: withdraw_id });

    return json({ ok: true, provider_id: evoData.id });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
