import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOPAY_API_TOKEN = Deno.env.get("EVOPAY_API_TOKEN")!;
const EVOPAY_BASE = "https://api.evopay.cash/v1";

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
    const { order_id } = await req.json();
    if (!order_id) return json({ error: "order_id required" }, 400);

    const { data: order } = await admin.from("orders").select("*").eq("id", order_id).maybeSingle();
    if (!order) return json({ error: "Pedido não encontrado" }, 404);
    if (order.buyer_id !== user.id) return json({ error: "Sem permissão" }, 403);
    if (order.status !== "pending") return json({ error: "Pedido não está pendente" }, 400);

    // Try existing payment
    const { data: pay } = await admin.from("payments").select("*").eq("order_id", order_id).order("created_at", { ascending: false }).maybeSingle();
    const expired = !order.checkout_expires_at || new Date(order.checkout_expires_at).getTime() < Date.now();

    if (pay && !expired) {
      return json({
        order_id, payment_id: pay.provider_payment_id,
        qr_code_text: pay.qr_code_text, qr_code_url: pay.qr_code_url,
        amount: Number(order.amount),
      });
    }

    // Regenerate Pix
    const { data: profile } = await admin.from("profiles").select("name, email").eq("id", user.id).single();
    const rawName = profile?.name || "Cliente ZXMAX";
    let safeName = rawName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z ]/g, " ").replace(/\s+/g, " ").trim();
    if (safeName.length < 3) safeName = "Cliente ZXMAX";
    const callbackUrl = `${SUPABASE_URL}/functions/v1/evopay-webhook`;

    const evoResp = await fetch(`${EVOPAY_BASE}/pix`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${EVOPAY_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(order.amount), callbackUrl, generatedName: safeName,
        generatedEmail: profile?.email || user.email, expiresIn: 3600, clientReference: order.id,
      }),
    });
    const evoData = await evoResp.json();
    if (!evoResp.ok) return json({ error: evoData?.message || "Erro Evopay", detail: evoData }, 502);

    const expiresAt = new Date(Date.now() + 3600_000).toISOString();
    await admin.from("orders").update({ checkout_expires_at: expiresAt }).eq("id", order_id);
    await admin.from("payments").insert({
      order_id, provider: "evopay", provider_payment_id: evoData.id,
      status: "PENDING", amount: Number(order.amount),
      service_fee: evoData.serviceFeeCharged ?? 0,
      qr_code_text: evoData.qrCodeText, qr_code_url: evoData.qrCodeUrl, raw: evoData,
    });

    return json({
      order_id, payment_id: evoData.id,
      qr_code_text: evoData.qrCodeText, qr_code_url: evoData.qrCodeUrl,
      amount: Number(order.amount),
    });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
