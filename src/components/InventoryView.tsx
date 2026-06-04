import React, { useState, useRef } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useDbProducts, uploadProductImage } from "@/hooks/useDbProducts";
import { useUserData } from "@/hooks/useUserData";
import { PackageEmoji } from "@/components/CustomEmojis";
import { Plus, X, Trash2, Upload, Loader2, Image as ImageIcon, Wallet, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import WithdrawDialog from "@/components/WithdrawDialog";

interface Variation { name: string; price: string; }

export default function InventoryView() {
  const { userId } = useAuthUser();
  const { products, categories, reload } = useDbProducts({ onlyMine: true, userId });
  const { wallet, profile, reload: reloadUser } = useUserData(userId);
  const [showForm, setShowForm] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "", category_id: "", description: "", price: "",
    delivery_type: "manual" as "auto" | "manual", delivery_content: "",
  });
  const [variations, setVariations] = useState<Variation[]>([]);

  React.useEffect(() => {
    if (categories.length && !form.category_id) {
      setForm((f) => ({ ...f, category_id: categories[0].id }));
    }
  }, [categories, form.category_id]);

  const resetForm = () => {
    setForm({ name: "", category_id: categories[0]?.id ?? "", description: "", price: "", delivery_type: "manual", delivery_content: "" });
    setVariations([]);
    setImageUrl("");
  };

  const handleFile = async (file: File) => {
    if (!userId) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem máx. 5MB");
    if (!file.type.startsWith("image/")) return toast.error("Apenas imagens");
    setUploading(true);
    const url = await uploadProductImage(userId, file);
    setUploading(false);
    if (!url) return toast.error("Falha no upload");
    setImageUrl(url);
    toast.success("Imagem enviada!");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return toast.error("Faça login");
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    if (!form.price || parseFloat(form.price) <= 0) return toast.error("Preço inválido");
    if (!form.category_id) return toast.error("Escolha uma categoria");
    if (!imageUrl) return toast.error("Envie uma imagem do produto");
    if (form.delivery_type === "auto" && !form.delivery_content.trim()) {
      return toast.error("Conteúdo de entrega automática obrigatório");
    }

    const parsedVariations = variations
      .filter((v) => v.name && v.price)
      .map((v) => ({ name: v.name, price: parseFloat(v.price) }));

    setSaving(true);
    const { error } = await supabase.from("products").insert({
      seller_id: userId,
      category_id: form.category_id,
      name: form.name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price),
      image_url: imageUrl,
      delivery_type: form.delivery_type,
      delivery_content: form.delivery_content.trim() || null,
      variations: parsedVariations,
      status: "pending",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Produto enviado! Aguardando aprovação.");
    setShowForm(false);
    resetForm();
    reload();
  };

  if (!userId) return <div className="p-8 text-center text-muted-foreground">Faça login</div>;

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      approved: "bg-success/10 text-success",
      pending: "bg-primary/10 text-primary",
      rejected: "bg-destructive/10 text-destructive",
      paused: "bg-muted text-muted-foreground",
      draft: "bg-muted text-muted-foreground",
    };
    const labels: Record<string, string> = {
      approved: "Aprovado", pending: "Em análise", rejected: "Rejeitado", paused: "Pausado", draft: "Rascunho",
    };
    return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${map[s] || ""}`}>{labels[s] || s}</span>;
  };

  return (
    <div className="animate-fade-in-up">
      <div className="flex justify-between items-end mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-black text-foreground">Meus Anúncios</h1>
            <PackageEmoji className="w-8 h-8" />
          </div>
          {profile && (
            <p className="text-xs text-muted-foreground">ID público: <span className="font-mono font-bold text-foreground">{profile.public_id}</span></p>
          )}
        </div>
        <button onClick={() => setShowForm(true)} className="btn-gradient px-5 py-3 text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      {/* Wallet card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-success" />
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Saldo disponível</p></div>
          <p className="text-2xl font-black text-foreground">R$ {Number(wallet?.available_balance ?? 0).toFixed(2)}</p>
          <button onClick={() => setShowWithdraw(true)} disabled={!wallet?.available_balance || Number(wallet.available_balance) <= 0}
            className="mt-2 btn-gradient px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-50">
            <ArrowDownToLine className="w-3 h-3" /> Sacar
          </button>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Saldo pendente</p>
          <p className="text-2xl font-black text-primary">R$ {Number(wallet?.pending_balance ?? 0).toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Liberado após 7 dias</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Total ganho</p>
          <p className="text-2xl font-black text-foreground">R$ {Number(wallet?.total_earned ?? 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-foreground/50 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card w-full max-w-lg p-6 bg-card animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-foreground">Criar Produto</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 hover:bg-muted rounded-xl"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              {/* Image */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Imagem principal *</label>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                {imageUrl ? (
                  <div className="relative rounded-xl overflow-hidden h-40 bg-muted">
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => fileRef.current?.click()} className="absolute bottom-2 right-2 bg-card/90 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                      <Upload className="w-3 h-3" /> Trocar
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full h-40 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/30 disabled:opacity-60">
                    {uploading ? <Loader2 className="w-6 h-6 animate-spin mb-2" /> : <ImageIcon className="w-6 h-6 mb-2" />}
                    <span className="text-xs font-bold">{uploading ? "Enviando..." : "Clique para enviar imagem"}</span>
                    <span className="text-[10px] mt-1">JPG/PNG até 5MB</span>
                  </button>
                )}
              </div>

              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome do produto *"
                className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" />

              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm">
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição detalhada" rows={3}
                className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm resize-none" />

              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                type="number" step="0.01" placeholder="Preço (R$) *"
                className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" />

              <div className="border border-border/40 rounded-xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Variações</p>
                  <button type="button" onClick={() => setVariations([...variations, { name: "", price: "" }])} className="text-primary text-xs font-bold">+ Adicionar</button>
                </div>
                {variations.map((v, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input value={v.name} onChange={(e) => { const nv = [...variations]; nv[i].name = e.target.value; setVariations(nv); }} placeholder="Nome" className="flex-1 p-2 rounded-lg bg-muted text-foreground text-xs border-none outline-none" />
                    <input value={v.price} onChange={(e) => { const nv = [...variations]; nv[i].price = e.target.value; setVariations(nv); }} placeholder="Preço" type="number" step="0.01" className="w-24 p-2 rounded-lg bg-muted text-foreground text-xs border-none outline-none" />
                    <button type="button" onClick={() => setVariations(variations.filter((_, j) => j !== i))} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="radio" name="dt" checked={form.delivery_type === "manual"} onChange={() => setForm({ ...form, delivery_type: "manual" })} /> Manual
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="radio" name="dt" checked={form.delivery_type === "auto"} onChange={() => setForm({ ...form, delivery_type: "auto" })} /> Automática
                </label>
              </div>
              {form.delivery_type === "auto" && (
                <textarea value={form.delivery_content} onChange={(e) => setForm({ ...form, delivery_content: e.target.value })}
                  placeholder="Conteúdo enviado ao comprador (chave, link, login...)" rows={3}
                  className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm resize-none" />
              )}

              <button type="submit" disabled={saving || uploading} className="w-full btn-gradient p-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar para aprovação
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Products list */}
      {products.length === 0 ? (
        <div className="bg-card rounded-3xl p-12 text-center border-2 border-dashed border-border">
          <PackageEmoji className="w-12 h-12 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground">Nenhum anúncio</h3>
          <p className="text-muted-foreground mt-2">Crie seu primeiro produto.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {products.map((p) => (
            <div key={p.id} className="glass-card p-4 flex items-center gap-4">
              {p.image_url ? (
                <img src={p.image_url} className="w-16 h-16 rounded-xl object-cover" alt={p.name} />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center"><ImageIcon className="w-6 h-6 text-muted-foreground" /></div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-foreground truncate">{p.name}</h4>
                <p className="text-xs text-muted-foreground">{(p as any).category_name || "—"} · {p.sales_count} vendas</p>
                {p.status === "rejected" && p.rejection_reason && (
                  <p className="text-[10px] text-destructive mt-1">Motivo: {p.rejection_reason}</p>
                )}
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">R$ {Number(p.price).toFixed(2)}</p>
                {statusBadge(p.status)}
              </div>
            </div>
          ))}
        </div>
      )}

      {showWithdraw && wallet && (
        <WithdrawDialog
          available={Number(wallet.available_balance)}
          defaultPixKey={profile?.pix_key}
          defaultPixType={profile?.pix_type}
          onClose={() => setShowWithdraw(false)}
          onDone={() => reloadUser()}
        />
      )}
    </div>
  );
}
