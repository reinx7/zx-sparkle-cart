// Cron-style: move released pending balances to available. Called manually or by client poll.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: orders } = await admin.from("orders")
    .select("*")
    .in("status", ["paid", "delivered"])
    .eq("released", false)
    .lte("release_at", new Date().toISOString());

  let count = 0;
  for (const o of orders ?? []) {
    const { data: w } = await admin.from("wallets").select("*").eq("user_id", o.seller_id).single();
    if (!w) continue;
    await admin.from("wallets").update({
      pending_balance: Math.max(0, Number(w.pending_balance) - Number(o.seller_amount)),
      available_balance: Number(w.available_balance) + Number(o.seller_amount),
    }).eq("user_id", o.seller_id);
    await admin.from("orders").update({ released: true }).eq("id", o.id);
    await admin.from("notifications").insert({
      user_id: o.seller_id, type: "balance_released",
      title: "Saldo liberado", body: `R$ ${Number(o.seller_amount).toFixed(2)} disponível para saque.`,
    });
    count++;
  }

  return new Response(JSON.stringify({ released: count }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
