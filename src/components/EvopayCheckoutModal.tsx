import React, { useEffect, useState } from "react";
import { X, Copy, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  productId: string;
  variationIndex?: number;
  onClose: () => void;
  onPaid?: () => void;
}

export default function EvopayCheckoutModal({ productId, variationIndex, onClose, onPaid }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"PENDING" | "COMPLETED" | "FAILED">("PENDING");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: res, error: err } = await supabase.functions.invoke("evopay-create-payment", {
        body: { product_id: productId, variation_index: variationIndex },
      });
      if (err || res?.error) {
        setError(res?.error || err?.message || "Erro ao gerar cobrança");
        setLoading(false);
        return;
      }
      setData(res);
      setLoading(false);
    })();
  }, [productId, variationIndex]);

  // Poll status every 4s
  useEffect(() => {
    if (!data?.order_id) return;
    const t = setInterval(async () => {
      const { data: order } = await supabase.from("orders").select("status").eq("id", data.order_id).maybeSingle();
      if (order && ["paid", "delivered"].includes(order.status)) {
        setStatus("COMPLETED");
        clearInterval(t);
        toast.success("Pagamento confirmado!");
        onPaid?.();
        setTimeout(onClose, 2000);
      } else if (order && ["canceled", "refunded"].includes(order.status)) {
        setStatus("FAILED");
        clearInterval(t);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [data?.order_id, onClose, onPaid]);

  const copy = async () => {
    if (!data?.qr_code_text) return;
    await navigator.clipboard.writeText(data.qr_code_text);
    setCopied(true);
    toast.success("Pix copia-e-cola copiado!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 bg-foreground/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card w-full max-w-md bg-card p-6 animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-foreground">Pagamento via Pix</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        {loading && (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
            Gerando cobrança Evopay…
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-center">
            <p className="text-sm font-bold text-destructive">{error}</p>
            <button onClick={onClose} className="mt-3 text-xs underline">Fechar</button>
          </div>
        )}

        {data && !error && (
          <>
            {status === "COMPLETED" ? (
              <div className="py-8 text-center">
                <CheckCircle className="w-16 h-16 text-success mx-auto mb-3" />
                <p className="text-lg font-bold text-foreground">Pagamento confirmado!</p>
                <p className="text-sm text-muted-foreground mt-1">Você receberá a entrega no chat do pedido.</p>
              </div>
            ) : (
              <>
                <p className="text-2xl font-black text-foreground text-center mb-1">R$ {Number(data.amount).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground text-center mb-4">Aguardando pagamento…</p>

                {data.qr_code_url && (
                  <div className="bg-white rounded-2xl p-4 mb-4 flex items-center justify-center">
                    <img src={data.qr_code_url} alt="QR Code Pix" className="w-56 h-56 object-contain" />
                  </div>
                )}

                {data.qr_code_text && (
                  <div className="mb-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Pix copia-e-cola</label>
                    <div className="flex gap-2">
                      <input readOnly value={data.qr_code_text} className="flex-1 p-3 rounded-xl bg-muted text-foreground text-xs font-mono border-none outline-none truncate" />
                      <button onClick={copy} className="btn-gradient px-4 py-2 text-xs flex items-center gap-1">
                        {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 mt-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <p className="text-xs text-foreground">Após pagar, o saldo é confirmado automaticamente.</p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
