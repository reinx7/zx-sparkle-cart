import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import { Send, Lock, Image as ImageIcon, ShieldAlert, X, Copy, ExternalLink, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Msg {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
}

interface Props {
  orderId: string;
  buyerId: string;
  sellerId: string;
  myRole: "buyer" | "seller" | "admin";
  status: string; // order status
  deliveredContent?: string | null;
  onChanged?: () => void;
}

export default function OrderChat({ orderId, buyerId, sellerId, myRole, status, deliveredContent, onChanged }: Props) {
  const { user } = useAuthUser();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showRefund, setShowRefund] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [dispute, setDispute] = useState<any | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const locked = !["paid", "delivered", "disputed"].includes(status);

  // Load messages + dispute
  const loadAll = async () => {
    const [{ data: msgs }, { data: disp }] = await Promise.all([
      supabase.from("order_messages").select("*").eq("order_id", orderId).order("created_at"),
      supabase.from("disputes").select("*").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setMessages((msgs as any) || []);
    setDispute(disp || null);
  };

  useEffect(() => {
    loadAll();
    const ch = supabase.channel(`order-${orderId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (p) => setMessages((cur) => [...cur, p.new as Msg]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Dispute countdown
  useEffect(() => {
    if (!dispute || dispute.status !== "open" || !dispute.admin_required_at) { setCountdown(0); return; }
    const tick = () => {
      const ms = new Date(dispute.admin_required_at).getTime() - Date.now();
      setCountdown(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [dispute]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    if (!user || !text.trim() || locked) return;
    setSending(true);
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("order_messages").insert({
      order_id: orderId, sender_id: user.id, sender_role: myRole === "admin" ? "admin" : "user", body,
    });
    setSending(false);
    if (error) { toast.error(error.message); setText(body); }
  };

  const sendImage = async (file: File) => {
    if (!user || locked) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem máx. 5MB");
    setSending(true);
    const path = `${user.id}/orders/${orderId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("report-evidence").upload(path, file);
    if (upErr) { setSending(false); return toast.error(upErr.message); }
    const { data: signed } = await supabase.storage.from("report-evidence").createSignedUrl(path, 60 * 60 * 24 * 30);
    await supabase.from("order_messages").insert({
      order_id: orderId, sender_id: user.id, sender_role: myRole === "admin" ? "admin" : "user",
      image_path: signed?.signedUrl || path, body: null,
    });
    setSending(false);
  };

  const markDelivered = async () => {
    const { error } = await (supabase.rpc as any)("mark_order_delivered", { _order_id: orderId });
    if (error) return toast.error(error.message);
    toast.success("Pedido marcado como entregue!");
    onChanged?.();
  };

  const openDispute = async () => {
    if (!disputeReason.trim()) return toast.error("Descreva o motivo");
    const { error } = await (supabase.rpc as any)("open_order_dispute", { _order_id: orderId, _reason: disputeReason.trim() });
    if (error) return toast.error(error.message);
    toast.success("Disputa aberta. Admin será notificado.");
    setShowDispute(false); setDisputeReason("");
    onChanged?.(); loadAll();
  };

  const cancelDispute = async () => {
    if (!dispute) return;
    const { error } = await (supabase.rpc as any)("cancel_order_dispute", { _dispute_id: dispute.id });
    if (error) return toast.error(error.message);
    toast.success("Disputa cancelada");
    onChanged?.(); loadAll();
  };

  const refund = async () => {
    if (!refundReason.trim()) return toast.error("Informe o motivo");
    const { error } = await (supabase.rpc as any)("refund_order", { _order_id: orderId, _reason: refundReason.trim() });
    if (error) return toast.error(error.message);
    toast.success("Reembolso registrado");
    setShowRefund(false); setRefundReason("");
    onChanged?.();
  };

  const canRefund = (myRole === "seller" || myRole === "admin") && ["paid", "delivered", "disputed"].includes(status);
  const canMarkDelivered = myRole === "seller" && status === "paid";
  const canOpenDispute = (myRole === "buyer" || myRole === "seller") && ["paid", "delivered"].includes(status) && (!dispute || dispute.status !== "open");
  const myDispute = dispute && dispute.status === "open" && dispute.opened_by === user?.id;

  return (
    <div className="space-y-3">
      {/* Auto delivery */}
      {deliveredContent && (
        <div className="glass-card p-4 border-2 border-success/30 bg-success/5">
          <p className="text-xs font-bold text-success uppercase mb-2">📦 Produto entregue (automático)</p>
          <div className="flex items-center gap-2 bg-muted rounded-xl p-3">
            <p className="flex-1 text-sm font-mono text-foreground break-all">{deliveredContent}</p>
            <button onClick={() => { navigator.clipboard.writeText(deliveredContent); toast.success("Copiado!"); }} className="p-1.5 hover:bg-card rounded-lg"><Copy className="w-4 h-4" /></button>
            {deliveredContent.startsWith("http") && (
              <a href={deliveredContent} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-card rounded-lg"><ExternalLink className="w-4 h-4 text-primary" /></a>
            )}
          </div>
        </div>
      )}

      {/* Dispute banner */}
      {dispute && dispute.status === "open" && (
        <div className="glass-card p-4 border-2 border-destructive/40 bg-destructive/5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            <p className="text-sm font-bold text-destructive">Disputa em andamento</p>
          </div>
          <p className="text-xs text-foreground mb-2">Motivo: {dispute.reason}</p>
          {countdown > 0 ? (
            <p className="text-xs text-muted-foreground">Admin entra automaticamente em <b>{Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}</b></p>
          ) : (
            <p className="text-xs text-destructive font-bold">⏰ Aguardando admin...</p>
          )}
          {myDispute && (
            <button onClick={cancelDispute} className="mt-2 text-xs underline text-primary">Cancelar disputa</button>
          )}
        </div>
      )}

      {/* Chat */}
      <div className="glass-card p-3 min-h-[260px] max-h-[420px] overflow-y-auto flex flex-col gap-2">
        {locked && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Lock className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Finalize o pagamento para conversar.</p>
          </div>
        )}
        {!locked && messages.length === 0 && (
          <p className="text-center text-muted-foreground text-xs py-10">Nenhuma mensagem ainda.</p>
        )}
        {!locked && messages.map((m) => {
          const isMe = m.sender_id === user?.id;
          const isSystem = m.sender_role === "system";
          const isAdmin = m.sender_role === "admin";
          if (isSystem) {
            return <div key={m.id} className="text-center text-[11px] font-medium text-muted-foreground bg-muted/50 rounded-lg py-1.5 px-3 self-center max-w-[90%]">{m.body}</div>;
          }
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] px-4 py-2 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : isAdmin ? "bg-accent text-accent-foreground rounded-bl-md" : "bg-secondary text-foreground rounded-bl-md"}`}>
                {isAdmin && !isMe && <p className="text-[10px] font-bold mb-0.5 opacity-80">👮 Admin</p>}
                {m.image_path ? (
                  <img src={m.image_path} alt="" className="max-w-full max-h-48 rounded-lg cursor-pointer" onClick={() => window.open(m.image_path!, "_blank")} />
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                )}
                <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      {!locked && (
        <div className="glass-card p-2 flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && sendImage(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={sending} className="p-2 hover:bg-muted rounded-xl"><ImageIcon className="w-4 h-4 text-muted-foreground" /></button>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Digite sua mensagem..." className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground" />
          <button onClick={send} disabled={sending || !text.trim()} className="btn-gradient w-9 h-9 flex items-center justify-center rounded-xl disabled:opacity-50">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {canMarkDelivered && (
          <button onClick={markDelivered} className="flex-1 bg-success text-success-foreground py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" /> Marcar como entregue
          </button>
        )}
        {canOpenDispute && (
          <button onClick={() => setShowDispute(true)} className="flex-1 bg-destructive/10 text-destructive py-2.5 rounded-xl font-bold text-sm">
            <ShieldAlert className="w-4 h-4 inline" /> Abrir disputa
          </button>
        )}
        {canRefund && (
          <button onClick={() => setShowRefund(true)} className="flex-1 bg-muted text-foreground py-2.5 rounded-xl font-bold text-sm">
            Reembolsar comprador
          </button>
        )}
      </div>

      {/* Dispute modal */}
      {showDispute && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-foreground/50 backdrop-blur-sm" onClick={() => setShowDispute(false)}>
          <div className="glass-card w-full max-w-md p-6 bg-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3"><h3 className="font-bold text-foreground">Abrir disputa</h3><button onClick={() => setShowDispute(false)}><X className="w-5 h-5" /></button></div>
            <p className="text-xs text-muted-foreground mb-3">Descreva o problema. O outro lado tem 5 min para responder; depois o admin entra.</p>
            <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} rows={4} placeholder="O que aconteceu?" className="w-full p-3 rounded-xl bg-muted text-foreground text-sm outline-none mb-3 resize-none" />
            <button onClick={openDispute} className="w-full bg-destructive text-destructive-foreground py-2.5 rounded-xl font-bold text-sm">Abrir disputa</button>
          </div>
        </div>
      )}

      {/* Refund modal */}
      {showRefund && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-foreground/50 backdrop-blur-sm" onClick={() => setShowRefund(false)}>
          <div className="glass-card w-full max-w-md p-6 bg-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3"><h3 className="font-bold text-foreground">Reembolsar pedido</h3><button onClick={() => setShowRefund(false)}><X className="w-5 h-5" /></button></div>
            <p className="text-xs text-muted-foreground mb-3">O valor será debitado do seu saldo {myRole === "admin" ? "(vendedor)" : ""} e o comprador notificado.</p>
            <textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} rows={3} placeholder="Motivo do reembolso" className="w-full p-3 rounded-xl bg-muted text-foreground text-sm outline-none mb-3 resize-none" />
            <button onClick={refund} className="w-full bg-destructive text-destructive-foreground py-2.5 rounded-xl font-bold text-sm">Confirmar reembolso</button>
          </div>
        </div>
      )}
    </div>
  );
}
