import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import { BagCheckEmoji } from "@/components/CustomEmojis";
import { ArrowLeft, Loader2, CreditCard } from "lucide-react";
import OrderChat from "@/components/OrderChat";
import EvopayCheckoutModal from "@/components/EvopayCheckoutModal";

export default function MyPurchasesView() {
  const { user, userId } = useAuthUser();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase.from("orders")
      .select("*, products(name, image_url, delivery_type)")
      .eq("buyer_id", userId).order("created_at", { ascending: false });
    let rows = data || [];
    if (rows.length) {
      const ids = [...new Set(rows.map((r: any) => r.seller_id))];
      const { data: profs } = await (supabase.rpc as any)("get_public_profiles", { _ids: ids });
      const map = new Map(((profs as any[]) || []).map((p: any) => [p.id, p]));
      rows = rows.map((r: any) => ({ ...r, seller: map.get(r.seller_id) }));
    }
    setOrders(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`buyer-orders-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `buyer_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!user) return <div className="p-8 text-center text-muted-foreground">Faça login</div>;
  if (loading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  if (selected) {
    return (
      <div className="animate-fade-in-up max-w-2xl mx-auto">
        <button onClick={() => { setSelected(null); load(); }} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-5"><ArrowLeft className="w-4 h-4" /> Voltar</button>
        <div className="glass-card p-4 mb-3 flex items-center gap-3">
          {selected.products?.image_url && <img src={selected.products.image_url} className="w-14 h-14 rounded-xl object-cover" alt="" />}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground truncate">{selected.products?.name}</p>
            <p className="text-xs text-muted-foreground">Vendedor: {selected.seller?.name || "—"} <span className="font-mono">{selected.seller?.public_id}</span></p>
            <p className="text-sm font-bold text-foreground">R$ {Number(selected.amount).toFixed(2)}</p>
          </div>
          <StatusPill s={selected.status} />
        </div>

        {selected.status === "pending" && (
          <button onClick={() => setResumeId(selected.id)} className="w-full btn-gradient py-3 text-sm flex items-center justify-center gap-2 mb-3">
            <CreditCard className="w-4 h-4" /> Pagar com Pix
          </button>
        )}

        <OrderChat
          orderId={selected.id}
          buyerId={selected.buyer_id}
          sellerId={selected.seller_id}
          myRole="buyer"
          status={selected.status}
          deliveredContent={selected.delivered_content}
          onChanged={load}
        />

        {resumeId && <EvopayCheckoutModal resumeOrderId={resumeId} onClose={() => setResumeId(null)} onPaid={load} />}
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-3xl md:text-4xl font-black text-foreground">Minhas Compras</h1>
        <BagCheckEmoji className="w-8 h-8" />
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20">
          <BagCheckEmoji className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-muted-foreground font-medium">Você ainda não comprou nada.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {orders.map((o) => (
            <button key={o.id} onClick={() => setSelected(o)} className="glass-card p-4 flex gap-3 items-center text-left hover:ring-2 hover:ring-primary/30">
              {o.products?.image_url && <img src={o.products.image_url} className="w-14 h-14 rounded-xl object-cover shrink-0" alt="" />}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-foreground text-sm truncate">{o.products?.name}</h3>
                <p className="text-xs text-muted-foreground">por {o.seller?.name || "—"}</p>
                <p className="text-sm font-black text-foreground">R$ {Number(o.amount).toFixed(2)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusPill s={o.status} />
                {o.status === "pending" && (
                  <span className="text-[10px] text-primary font-bold flex items-center gap-1"><CreditCard className="w-3 h-3" /> Pagar</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ s }: { s: string }) {
  const map: Record<string, { l: string; c: string }> = {
    pending: { l: "Pendente", c: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30" },
    paid: { l: "Pago", c: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" },
    delivered: { l: "Entregue", c: "bg-primary/20 text-primary border-primary/30" },
    disputed: { l: "Disputa", c: "bg-destructive/20 text-destructive border-destructive/30" },
    refunded: { l: "Reembolsado", c: "bg-muted text-muted-foreground" },
    canceled: { l: "Cancelado", c: "bg-muted text-muted-foreground" },
  };
  const m = map[s] || { l: s, c: "bg-muted text-muted-foreground" };
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${m.c}`}>{m.l}</span>;
}
