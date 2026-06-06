import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import { ShieldEmoji } from "@/components/CustomEmojis";
import { Eye, X, Search, Loader2, Check, Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Tab = "config" | "products" | "withdrawals" | "users" | "categories" | "reports";

export default function AdminView() {
  const { user } = useAuthUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("products");

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  if (isAdmin === null) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Acesso restrito a administradores.</div>;

  const tabs: { k: Tab; label: string }[] = [
    { k: "products", label: "Produtos" },
    { k: "withdrawals", label: "Saques" },
    { k: "users", label: "Usuários" },
    { k: "reports", label: "Denúncias" },
    { k: "categories", label: "Categorias" },
    { k: "config", label: "Config" },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-3xl md:text-4xl font-black text-foreground">Painel Admin</h1>
        <ShieldEmoji className="w-8 h-8" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-5 scrollbar-hide">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold ${tab === t.k ? "btn-gradient" : "bg-card border border-border/40 text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductsTab />}
      {tab === "withdrawals" && <WithdrawalsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "config" && <ConfigTab />}
    </div>
  );
}

/* ============== PRODUCTS ============== */
function ProductsTab() {
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [items, setItems] = useState<any[]>([]);
  const [preview, setPreview] = useState<any | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    const productCols = "id, seller_id, category_id, name, description, price, image_url, banner_url, gallery, delivery_type, variations, stock, sales_count, status, rejection_reason, created_at, updated_at";
    const { data: prods } = await supabase.from("products").select(`${productCols}, categories(name)`).order("created_at", { ascending: false });
    let rows: any[] = prods || [];
    if (rows.length) {
      const ids = [...new Set(rows.map((p) => p.seller_id))];
      const { data: profs } = await supabase.from("profiles").select("id, name, public_id").in("id", ids);
      const map = new Map((profs || []).map((p) => [p.id, p]));
      rows = rows.map((p) => ({ ...p, profiles: map.get(p.seller_id) }));
    }
    if (filter !== "all") rows = rows.filter((p) => p.status === filter);
    setItems(rows);
  };
  useEffect(() => { load(); }, [filter]);

  const approve = async (id: string) => {
    const { error } = await supabase.from("products").update({ status: "approved", rejection_reason: null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Produto aprovado");
    load();
  };
  const reject = async () => {
    if (!rejectId) return;
    const { error } = await supabase.from("products").update({ status: "rejected", rejection_reason: reason }).eq("id", rejectId);
    if (error) return toast.error(error.message);
    toast.success("Produto rejeitado");
    setRejectId(null); setReason(""); load();
  };

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {f === "pending" ? "Pendentes" : f === "approved" ? "Aprovados" : f === "rejected" ? "Rejeitados" : "Todos"}
          </button>
        ))}
      </div>
      <div className="glass-card overflow-hidden">
        {items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum produto.</p>
        ) : (
          <div className="divide-y divide-border/20">
            {items.map((p) => (
              <div key={p.id} className="p-4 flex items-center gap-3">
                {p.image_url ? <img src={p.image_url} className="w-12 h-12 rounded-xl object-cover" alt="" /> : <div className="w-12 h-12 rounded-xl bg-muted" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{p.profiles?.name || "—"} · {p.profiles?.public_id || ""} · {p.categories?.name || "—"}</p>
                </div>
                <p className="font-bold text-foreground text-sm">R$ {Number(p.price).toFixed(2)}</p>
                <button onClick={() => setPreview(p)} className="p-1.5 rounded-lg hover:bg-muted"><Eye className="w-4 h-4" /></button>
                {p.status === "pending" && (
                  <>
                    <button onClick={() => approve(p.id)} className="text-success font-bold text-xs">Aprovar</button>
                    <button onClick={() => setRejectId(p.id)} className="text-destructive font-bold text-xs">Rejeitar</button>
                  </>
                )}
                {p.status === "approved" && <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">Ativo</span>}
                {p.status === "rejected" && <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">Rejeitado</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {preview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-foreground/50 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="glass-card w-full max-w-xl p-0 bg-card overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {preview.image_url && <img src={preview.image_url} className="w-full h-56 object-cover" alt="" />}
            <div className="p-5">
              <h3 className="text-xl font-black text-foreground mb-1">{preview.name}</h3>
              <p className="text-xs text-muted-foreground mb-3">R$ {Number(preview.price).toFixed(2)} · {preview.delivery_type}</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{preview.description}</p>
              {preview.delivery_type === "auto" && (
                <DeliveryContentPreview productId={preview.id} />
              )}
              <button onClick={() => setPreview(null)} className="mt-4 w-full btn-gradient p-2 text-sm">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {rejectId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-foreground/50 backdrop-blur-sm" onClick={() => setRejectId(null)}>
          <div className="glass-card w-full max-w-sm p-6 bg-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-foreground mb-3">Motivo da rejeição</h3>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary resize-none mb-3" />
            <div className="flex gap-2">
              <button onClick={reject} className="flex-1 bg-destructive text-destructive-foreground py-2.5 rounded-xl font-bold text-sm">Rejeitar</button>
              <button onClick={() => setRejectId(null)} className="flex-1 border border-border py-2.5 rounded-xl font-bold text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============== WITHDRAWALS ============== */
function WithdrawalsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("withdraw_requests").select("*").order("created_at", { ascending: false });
    let rows: any[] = data || [];
    if (rows.length) {
      const ids = [...new Set(rows.map((w) => w.user_id))];
      const { data: profs } = await supabase.from("profiles").select("id, name, public_id, email").in("id", ids);
      const map = new Map((profs || []).map((p) => [p.id, p]));
      rows = rows.map((w) => ({ ...w, profiles: map.get(w.user_id) }));
    }
    setItems(rows);
  };
  useEffect(() => { load(); }, []);

  const act = async (id: string, action: "approve" | "reject", note?: string) => {
    setBusy(id);
    const { data, error } = await supabase.functions.invoke("admin-approve-withdraw", { body: { withdraw_id: id, action, note } });
    setBusy(null);
    if (error || data?.error) return toast.error(data?.error || error?.message || "Erro");
    toast.success(action === "approve" ? "Saque enviado para o gateway" : "Saque rejeitado e valor devolvido");
    load();
  };

  return (
    <div className="glass-card overflow-hidden">
      {items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Sem solicitações.</p> : (
        <div className="divide-y divide-border/20">
          {items.map((w) => (
            <div key={w.id} className="p-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{w.profiles?.name || w.user_id}</p>
                <p className="text-[11px] text-muted-foreground">{w.profiles?.public_id} · {w.pix_type}: <span className="font-mono">{w.pix_key}</span></p>
                <p className="text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <p className="font-bold text-foreground text-sm">R$ {Number(w.amount).toFixed(2)}</p>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${w.status === "pending" ? "bg-primary/10 text-primary" : w.status === "completed" ? "bg-success/10 text-success" : w.status === "processing" ? "bg-accent/10 text-accent-foreground" : "bg-destructive/10 text-destructive"}`}>{w.status}</span>
              {w.status === "pending" && (
                <div className="flex gap-2">
                  <button disabled={busy === w.id} onClick={() => act(w.id, "approve")} className="text-success font-bold text-xs disabled:opacity-50">{busy === w.id ? "..." : "Aprovar"}</button>
                  <button disabled={busy === w.id} onClick={() => { const n = prompt("Motivo?"); if (n !== null) act(w.id, "reject", n); }} className="text-destructive font-bold text-xs disabled:opacity-50">Rejeitar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============== USERS ============== */
function UsersTab() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [banScope, setBanScope] = useState<"full" | "sell" | "buy" | "withdraw">("full");
  const [banReason, setBanReason] = useState("");
  const [activeBans, setActiveBans] = useState<any[]>([]);
  const { user } = useAuthUser();

  const search = async () => {
    if (!q.trim()) return;
    const term = q.trim();
    const { data } = await supabase.from("profiles")
      .select("id, public_id, name, email, status, kyc_status, is_verified_seller")
      .or(`public_id.ilike.%${term}%,email.ilike.%${term}%,name.ilike.%${term}%`)
      .limit(20);
    setResults(data || []);
  };

  const loadBans = async (uid: string) => {
    const { data } = await supabase.from("bans").select("*").eq("user_id", uid).eq("active", true);
    setActiveBans(data || []);
  };

  const openUser = async (u: any) => {
    setSelected(u);
    loadBans(u.id);
  };

  const ban = async () => {
    if (!selected || !banReason.trim() || !user) return;
    const { error } = await supabase.from("bans").insert({
      user_id: selected.id, scope: banScope, reason: banReason, admin_id: user.id, active: true,
    });
    if (error) return toast.error(error.message);
    await supabase.from("admin_logs").insert({ admin_id: user.id, action: "ban", target_type: "user", target_id: selected.id, meta: { scope: banScope, reason: banReason } });
    toast.success("Banimento aplicado");
    setBanReason(""); loadBans(selected.id);
  };

  const unban = async (id: string) => {
    await supabase.from("bans").update({ active: false }).eq("id", id);
    if (user) await supabase.from("admin_logs").insert({ admin_id: user.id, action: "unban", target_type: "ban", target_id: id });
    toast.success("Banimento removido");
    if (selected) loadBans(selected.id);
  };

  const setVerified = async (v: boolean) => {
    if (!selected) return;
    await supabase.from("profiles").update({ is_verified_seller: v }).eq("id", selected.id);
    setSelected({ ...selected, is_verified_seller: v });
    toast.success(v ? "Vendedor verificado" : "Verificação removida");
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Buscar por ID público (ZX-XXXXXX), email ou nome..."
          className="flex-1 p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
        <button onClick={search} className="btn-gradient px-4 py-2 text-sm flex items-center gap-1"><Search className="w-4 h-4" /></button>
      </div>

      <div className="glass-card overflow-hidden">
        {results.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Busque para começar.</p> : (
          <div className="divide-y divide-border/20">
            {results.map((u) => (
              <button key={u.id} onClick={() => openUser(u)} className="w-full p-3 flex items-center gap-3 hover:bg-muted/30 text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{u.name} <span className="text-[10px] font-mono text-muted-foreground">{u.public_id}</span></p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                {u.is_verified_seller && <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">Verificado</span>}
                {u.status !== "active" && <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">{u.status}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-foreground/50 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="glass-card w-full max-w-lg p-6 bg-card max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-black text-foreground">{selected.name}</h3>
                <p className="text-xs text-muted-foreground font-mono">{selected.public_id}</p>
                <p className="text-xs text-muted-foreground">{selected.email}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-muted rounded-xl"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex gap-2 mb-4">
              <button onClick={() => setVerified(!selected.is_verified_seller)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${selected.is_verified_seller ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                {selected.is_verified_seller ? "Remover verificação" : "Marcar como verificado"}
              </button>
            </div>

            <div className="border border-border/40 rounded-xl p-3 mb-3">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Banimentos ativos</p>
              {activeBans.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum.</p> : activeBans.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-xs py-1">
                  <div><b>{b.scope}</b> · {b.reason}</div>
                  <button onClick={() => unban(b.id)} className="text-primary font-bold text-[11px]">Remover</button>
                </div>
              ))}
            </div>

            <div className="border border-border/40 rounded-xl p-3">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><Ban className="w-3 h-3" /> Aplicar banimento</p>
              <select value={banScope} onChange={(e) => setBanScope(e.target.value as any)} className="w-full p-2 rounded-lg bg-muted text-foreground text-xs border-none outline-none mb-2">
                <option value="full">Conta inteira (full)</option>
                <option value="sell">Bloquear vendas</option>
                <option value="buy">Bloquear compras</option>
                <option value="withdraw">Bloquear saques</option>
              </select>
              <textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Motivo do banimento" rows={2} className="w-full p-2 rounded-lg bg-muted text-foreground text-xs border-none outline-none mb-2 resize-none" />
              <button onClick={ban} className="w-full bg-destructive text-destructive-foreground py-2 rounded-lg font-bold text-xs">Aplicar banimento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============== REPORTS ============== */
function ReportsTab() {
  const [items, setItems] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);
  const setStatus = async (id: string, status: "open" | "reviewing" | "resolved" | "dismissed") => {
    await supabase.from("reports").update({ status }).eq("id", id);
    toast.success("Status atualizado"); load();
  };
  return (
    <div className="glass-card overflow-hidden">
      {items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Sem denúncias.</p> : (
        <div className="divide-y divide-border/20">
          {items.map((r) => (
            <div key={r.id} className="p-4">
              <div className="flex justify-between items-start mb-1">
                <p className="text-sm font-bold text-foreground">{r.category}</p>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${r.status === "open" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{r.status}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{r.description}</p>
              {Array.isArray(r.evidence_urls) && r.evidence_urls.length > 0 && (
                <p className="text-[10px] text-muted-foreground">{r.evidence_urls.length} anexo(s)</p>
              )}
              <div className="flex gap-2 mt-2">
                <button onClick={() => setStatus(r.id, "reviewing")} className="text-primary text-xs font-bold">Em análise</button>
                <button onClick={() => setStatus(r.id, "resolved")} className="text-success text-xs font-bold">Resolver</button>
                <button onClick={() => setStatus(r.id, "dismissed")} className="text-muted-foreground text-xs font-bold">Descartar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============== CATEGORIES ============== */
function CategoriesTab() {
  const [cats, setCats] = useState<any[]>([]);
  const [name, setName] = useState("");
  const load = async () => {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setCats(data || []);
  };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!name.trim()) return;
    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { error } = await supabase.from("categories").insert({ name: name.trim(), slug, active: true });
    if (error) return toast.error(error.message);
    setName(""); load();
  };
  const toggle = async (c: any) => { await supabase.from("categories").update({ active: !c.active }).eq("id", c.id); load(); };
  return (
    <div className="glass-card p-5">
      <div className="flex gap-2 mb-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria" className="flex-1 p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
        <button onClick={add} className="btn-gradient px-4 py-2 text-sm">Adicionar</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <button key={c.id} onClick={() => toggle(c)} className={`px-3 py-1.5 rounded-full text-xs font-bold ${c.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {c.name}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-3">Clique para ativar/desativar.</p>
    </div>
  );
}

/* ============== CONFIG ============== */
function ConfigTab() {
  const [cfg, setCfg] = useState<any | null>(null);
  const [authS, setAuthS] = useState<any | null>(null);
  const load = async () => {
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from("app_config").select("*").eq("id", 1).maybeSingle(),
      supabase.from("auth_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    setCfg(c); setAuthS(a);
  };
  useEffect(() => { load(); }, []);
  const saveCfg = async () => {
    const { error } = await supabase.from("app_config").update({
      site_name: cfg.site_name, platform_fee_percent: cfg.platform_fee_percent,
      balance_release_days: cfg.balance_release_days, withdraw_processing_days_min: cfg.withdraw_processing_days_min,
      withdraw_processing_days_max: cfg.withdraw_processing_days_max, global_notice: cfg.global_notice,
      discord_link: cfg.discord_link, maintenance_mode: cfg.maintenance_mode,
    }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
  };
  const saveAuth = async () => {
    const { error } = await supabase.from("auth_settings").update({
      email_enabled: authS.email_enabled, google_enabled: authS.google_enabled,
      discord_enabled: authS.discord_enabled, registration_enabled: authS.registration_enabled,
    }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Login atualizado");
  };

  if (!cfg || !authS) return <Loader2 className="w-6 h-6 animate-spin mx-auto" />;

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <h3 className="font-bold text-foreground mb-3">Geral</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nome do site"><input value={cfg.site_name} onChange={(e) => setCfg({ ...cfg, site_name: e.target.value })} className={fieldCls} /></Field>
          <Field label="Comissão (%)"><input type="number" value={cfg.platform_fee_percent} onChange={(e) => setCfg({ ...cfg, platform_fee_percent: +e.target.value })} className={fieldCls} /></Field>
          <Field label="Liberar saldo após (dias)"><input type="number" value={cfg.balance_release_days} onChange={(e) => setCfg({ ...cfg, balance_release_days: +e.target.value })} className={fieldCls} /></Field>
          <Field label="Saque mínimo (dias úteis)"><input type="number" value={cfg.withdraw_processing_days_min} onChange={(e) => setCfg({ ...cfg, withdraw_processing_days_min: +e.target.value })} className={fieldCls} /></Field>
          <Field label="Saque máximo (dias úteis)"><input type="number" value={cfg.withdraw_processing_days_max} onChange={(e) => setCfg({ ...cfg, withdraw_processing_days_max: +e.target.value })} className={fieldCls} /></Field>
          <Field label="Link Discord"><input value={cfg.discord_link || ""} onChange={(e) => setCfg({ ...cfg, discord_link: e.target.value })} className={fieldCls} /></Field>
          <Field label="Aviso global"><input value={cfg.global_notice || ""} onChange={(e) => setCfg({ ...cfg, global_notice: e.target.value })} className={fieldCls} /></Field>
          <Field label="Modo manutenção">
            <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={cfg.maintenance_mode} onChange={(e) => setCfg({ ...cfg, maintenance_mode: e.target.checked })} /> Ativar</label>
          </Field>
        </div>
        <button onClick={saveCfg} className="btn-gradient px-5 py-2.5 text-sm mt-4">Salvar</button>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-bold text-foreground mb-3">Métodos de login</h3>
        {(["email_enabled", "google_enabled", "discord_enabled", "registration_enabled"] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm text-foreground py-1">
            <input type="checkbox" checked={authS[k]} onChange={(e) => setAuthS({ ...authS, [k]: e.target.checked })} />
            {k === "email_enabled" ? "E-mail/Senha" : k === "google_enabled" ? "Google" : k === "discord_enabled" ? "Discord (requer configuração)" : "Permitir novos cadastros"}
          </label>
        ))}
        <button onClick={saveAuth} className="btn-gradient px-5 py-2.5 text-sm mt-4">Salvar</button>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-bold text-foreground mb-2">Gateway Evopay</h3>
        <div className="bg-success/10 border border-success/30 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-success" />
          <p className="text-xs text-foreground">Evopay ativo · token armazenado de forma segura no backend (EVOPAY_API_TOKEN).</p>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Para trocar o token, peça no chat. Endpoint usado: <span className="font-mono">https://api.evopay.cash/v1</span></p>
      </div>
    </div>
  );
}

const fieldCls = "w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">{label}</label>{children}</div>;
}
