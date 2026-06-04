import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    console.log("EVOPAY WEBHOOK:", JSON.stringify(body));
    const providerId = body.id;
    const status = body.status as string;
    const type = body.type as string; // DEPOSIT | WITHDRAW

    if (!providerId || !status) return ok();

    if (type === "DEPOSIT" || !type) {
      // Find payment
      const { data: payment } = await admin.from("payments")
        .select("*, orders(*)")
        .eq("provider_payment_id", providerId).maybeSingle();
      if (!payment) return ok();

      // Idempotent
      if (payment.status === status) return ok();

      await admin.from("payments").update({
        status,
        paid_at: status === "COMPLETED" ? new Date().toISOString() : payment.paid_at,
        raw: body,
      }).eq("id", payment.id);

      if (status === "COMPLETED" && payment.orders) {
        const order = payment.orders;
        const { data: cfg } = await admin.from("app_config").select("balance_release_days").eq("id", 1).single();
        const days = cfg?.balance_release_days ?? 7;
        const releaseAt = new Date(Date.now() + days * 86400000).toISOString();

        await admin.from("orders").update({
          status: "paid",
          release_at: releaseAt,
        }).eq("id", order.id);

        // Credit seller pending
        const { data: wallet } = await admin.from("wallets").select("*").eq("user_id", order.seller_id).single();
        if (wallet) {
          await admin.from("wallets").update({
            pending_balance: Number(wallet.pending_balance) + Number(order.seller_amount),
            total_earned: Number(wallet.total_earned) + Number(order.seller_amount),
          }).eq("user_id", order.seller_id);
        }

        // Increment product sales
        const { data: product } = await admin.from("products").select("sales_count").eq("id", order.product_id).single();
        if (product) {
          await admin.from("products").update({ sales_count: (product.sales_count || 0) + 1 }).eq("id", order.product_id);
        }

        // Notify
        await admin.from("notifications").insert([
          { user_id: order.buyer_id, type: "order_paid", title: "Pagamento confirmado", body: "Seu pedido foi pago. O vendedor irá entregar em breve." },
          { user_id: order.seller_id, type: "order_paid", title: "Nova venda!", body: `Você recebeu uma nova compra. Saldo será liberado em ${days} dias.` },
        ]);

        // Auto-delivery
        const { data: prod } = await admin.from("products").select("delivery_type, delivery_content").eq("id", order.product_id).single();
        if (prod?.delivery_type === "auto" && prod.delivery_content) {
          await admin.from("orders").update({
            status: "delivered",
            delivered_content: prod.delivery_content,
          }).eq("id", order.id);
        }
      }
    } else if (type === "WITHDRAW") {
      const { data: wr } = await admin.from("withdraw_requests")
        .select("*").eq("provider_withdraw_id", providerId).maybeSingle();
      if (!wr) return ok();
      if (status === "COMPLETED") {
        await admin.from("withdraw_requests").update({
          status: "completed", processed_at: new Date().toISOString(),
        }).eq("id", wr.id);
        await admin.from("notifications").insert({
          user_id: wr.user_id, type: "withdraw_completed",
          title: "Saque concluído", body: `R$ ${Number(wr.amount).toFixed(2)} enviado para sua chave Pix.`,
        });
      } else if (["CANCELED", "REFUNDED", "ERROR", "EXPIRED"].includes(status)) {
        // Rollback funds to wallet
        const { data: wallet } = await admin.from("wallets").select("*").eq("user_id", wr.user_id).single();
        if (wallet) {
          await admin.from("wallets").update({
            available_balance: Number(wallet.available_balance) + Number(wr.amount),
          }).eq("user_id", wr.user_id);
        }
        await admin.from("withdraw_requests").update({
          status: "rejected", rejection_reason: `Gateway: ${status}`,
        }).eq("id", wr.id);
      }
    }

    return ok();
  } catch (e) {
    console.error("webhook err", e);
    return ok();
  }
});

function ok() { return new Response("ok", { status: 200, headers: corsHeaders }); }
