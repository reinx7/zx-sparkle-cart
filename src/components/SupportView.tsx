import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import { HeadsetEmoji } from "@/components/CustomEmojis";
import { Send, Loader2, ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";

type TicketMessage = { from: "user" | "admin"; text: string; date: string };
type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  priority: number;
  status: "open" | "waiting_user" | "waiting_admin" | "resolved" | "closed";
  messages: TicketMessage[];
  created_at: string;
  updated_at: string;
};

const CATEGORIES = ["Compra", "Venda", "Pagamento", "Saque", "Produto", "Denúncia", "Conta", "Verificação", "Outro"];

export default function SupportView() {
  const { user, userId } = useAuthUser();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setTickets([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from("support_tickets")
      .select("*").eq("user_id", userId).order("updated_at", { ascending: false });
    if (error) toast.error("Erro ao carregar tickets");
    setTickets(((data as any) || []).map((t: any) => ({ ...t, messages: Array.isArray(t.messages) ? t.messages : [] })));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Keep selected ticket in sync with list
  useEffect(() => {
    if (!selected) return;
    const fresh = tickets.find(t => t.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [tickets]); // eslint-disable-line

  if (!user) return <div className="p-8 text-center text-muted-foreground">Faça login para acessar o suporte.</div>;
  if (loading) return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  if (creating) {
    return <CreateTicket userId={userId!} onDone={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} />;
  }

  if (selected) {
    return <TicketChat ticket={selected} userId={userId!} onBack={() => { setSelected(null); load(); }} onUpdated={load} />;
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <h1 className="text-3xl md:text-4xl font-black text-foreground">Suporte</h1>
          <HeadsetEmoji className="w-8 h-8" />
        </div>
        <p className="text-muted-foreground">Estamos aqui para ajudar.</p>
      </div>

      <button onClick={() => setCreating(true)} className="btn-gradient w-full py-3 mb-5 flex items-center justify-center gap-2 font-bold">
        <Plus className="w-5 h-5" /> Abrir novo ticket
      </button>

      {tickets.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <p>Você ainda não abriu nenhum ticket.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="font-bold text-foreground text-sm">Meus tickets</h3>
          {tickets.map((t) => (
            <button key={t.id} onClick={() => setSelected(t)} className="w-full glass-card p-4 flex justify-between items-start text-left hover:ring-2 hover:ring-primary/30">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-foreground text-sm truncate">{t.subject}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.category} • {t.messages.length} mensagem{t.messages.length === 1 ? "" : "s"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Atualizado {new Date(t.updated_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <StatusPill s={t.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTicket({ userId, onDone, onCancel }: { userId: string; onDone: () => void; onCancel: () => void }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const subj = subject.trim();
    const msg = message.trim();
    if (!subj) return toast.error("Informe um assunto.");
    if (!msg) return toast.error("Descreva seu problema.");
    if (subj.length > 200) return toast.error("Assunto muito longo.");
    if (msg.length > 4000) return toast.error("Mensagem muito longa.");

    setBusy(true);
    const first: TicketMessage = { from: "user", text: msg, date: new Date().toISOString() };
    const { error } = await supabase.from("support_tickets").insert({
      user_id: userId,
      subject: subj,
      category,
      priority,
      status: "waiting_admin" as any,
      messages: [first] as any,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Ticket aberto!");
    onDone();
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <button onClick={onCancel} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <div className="glass-card p-6">
        <h3 className="font-bold text-foreground mb-4 text-lg">Novo ticket</h3>
        <label className="text-xs font-bold text-muted-foreground uppercase">Assunto</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200}
          placeholder="Ex: Não recebi meu produto"
          className="w-full mt-1 mb-3 p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" />

        <label className="text-xs font-bold text-muted-foreground uppercase">Categoria</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="w-full mt-1 mb-3 p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <label className="text-xs font-bold text-muted-foreground uppercase">Prioridade</label>
        <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}
          className="w-full mt-1 mb-3 p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm">
          <option value={0}>Baixa</option>
          <option value={1}>Normal</option>
          <option value={2}>Alta</option>
          <option value={3}>Urgente</option>
        </select>

        <label className="text-xs font-bold text-muted-foreground uppercase">Mensagem</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} rows={5}
          placeholder="Descreva seu problema com detalhes..."
          className="w-full mt-1 mb-4 p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm resize-none" />

        <button onClick={submit} disabled={busy} className="btn-gradient w-full py-3 font-bold disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Abrir ticket"}
        </button>
      </div>
    </div>
  );
}

function TicketChat({ ticket, userId, onBack, onUpdated }: { ticket: Ticket; userId: string; onBack: () => void; onUpdated: () => void }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = reply.trim();
    if (!text) return;
    if (text.length > 4000) return toast.error("Mensagem muito longa.");
    if (ticket.status === "closed") return toast.error("Ticket fechado.");
    setBusy(true);
    const newMsg: TicketMessage = { from: "user", text, date: new Date().toISOString() };
    const nextMessages = [...ticket.messages, newMsg];
    const { error } = await supabase.from("support_tickets")
      .update({ messages: nextMessages as any, status: "waiting_admin" as any, updated_at: new Date().toISOString() })
      .eq("id", ticket.id).eq("user_id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    setReply("");
    onUpdated();
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <div className="glass-card p-6">
        <div className="flex justify-between items-start mb-1 gap-3">
          <h3 className="font-bold text-foreground flex-1 min-w-0 truncate">{ticket.subject}</h3>
          <StatusPill s={ticket.status} />
        </div>
        <p className="text-xs text-muted-foreground mb-4">{ticket.category}</p>

        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto pr-1">
          {ticket.messages.map((m, i) => {
            const mine = m.from === "user";
            return (
              <div key={i} className={`p-3 rounded-2xl text-sm ${mine ? "bg-primary/10 text-foreground ml-6" : "bg-muted text-foreground mr-6"}`}>
                <p className="text-[10px] text-muted-foreground mb-1 font-semibold">
                  {mine ? "Você" : "Suporte"} • {new Date(m.date).toLocaleString("pt-BR")}
                </p>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            );
          })}
        </div>

        {ticket.status !== "closed" ? (
          <div className="flex gap-2">
            <input value={reply} onChange={(e) => setReply(e.target.value)}
              placeholder="Sua mensagem..."
              maxLength={4000}
              className="flex-1 p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm"
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()} />
            <button onClick={send} disabled={busy} className="btn-gradient p-3 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">Este ticket foi fechado.</p>
        )}
      </div>
    </div>
  );
}

function StatusPill({ s }: { s: Ticket["status"] }) {
  const map: Record<Ticket["status"], { l: string; c: string }> = {
    open: { l: "Aberto", c: "bg-primary/20 text-primary border-primary/30" },
    waiting_admin: { l: "Aguardando suporte", c: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30" },
    waiting_user: { l: "Aguardando você", c: "bg-blue-500/20 text-blue-600 border-blue-500/30" },
    resolved: { l: "Resolvido", c: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" },
    closed: { l: "Fechado", c: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[s] || map.open;
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${m.c}`}>{m.l}</span>;
}
