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

    // Ban check (scope=buy)
    const { data: banned } = await admin.rpc("is_banned", { _user_id: user.id, _scope: "buy" });
    if (banned) return json({ error: "Conta bloqueada para compras." }, 403);

    const body = await req.json();
    const { product_id, variation_index } = body;
    if (!product_id) return json({ error: "product_id required" }, 400);

    const { data: product, error: pErr } = await admin
      .from("products").select("*").eq("id", product_id).eq("status", "approved").maybeSingle();
    if (pErr || !product) return json({ error: "Produto indisponível" }, 404);

    if (product.seller_id === user.id) return json({ error: "Não pode comprar o próprio produto" }, 400);

    let amount = Number(product.price);
    let variation = null;
    if (typeof variation_index === "number" && Array.isArray(product.variations) && product.variations[variation_index]) {
      variation = product.variations[variation_index];
      amount = Number(variation.price);
    }

    const { data: cfg } = await admin.from("app_config").select("platform_fee_percent, balance_release_days").eq("id", 1).single();
    const feePct = Number(cfg?.platform_fee_percent ?? 10);
    const platform_fee = +(amount * feePct / 100).toFixed(2);
    const seller_amount = +(amount - platform_fee).toFixed(2);

    // Create order
    const { data: order, error: oErr } = await admin.from("orders").insert({
      buyer_id: user.id, seller_id: product.seller_id, product_id: product.id,
      variation, amount, platform_fee, seller_amount, status: "pending",
    }).select().single();
    if (oErr) return json({ error: oErr.message }, 500);

    // Webhook URL
    const callbackUrl = `${SUPABASE_URL}/functions/v1/evopay-webhook`;

    // Profile for buyer
    const { data: profile } = await admin.from("profiles").select("name, email, phone").eq("id", user.id).single();

    const rawName = profile?.name || "Cliente ZXMAX";
    let safeName = rawName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z ]/g, " ").replace(/\s+/g, " ").trim();
    if (!safeName) safeName = "Cliente ZXMAX";

    const evoResp = await fetch(`${EVOPAY_BASE}/pix`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${EVOPAY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        callbackUrl,
        generatedName: safeName,
        generatedEmail: profile?.email || user.email,
        expiresIn: 3600,
        clientReference: order.id,
      }),
    });

    const evoData = await evoResp.json();
    if (!evoResp.ok) {
      await admin.from("orders").update({ status: "canceled" }).eq("id", order.id);
      return json({ error: "Evopay error", detail: evoData }, 502);
    }

    await admin.from("payments").insert({
      order_id: order.id,
      provider: "evopay",
      provider_payment_id: evoData.id,
      status: "PENDING",
      amount,
      service_fee: evoData.serviceFeeCharged ?? 0,
      qr_code_text: evoData.qrCodeText,
      qr_code_url: evoData.qrCodeUrl,
      raw: evoData,
    });

    return json({
      order_id: order.id,
      payment_id: evoData.id,
      qr_code_text: evoData.qrCodeText,
      qr_code_url: evoData.qrCodeUrl,
      amount,
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
