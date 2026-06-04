import React, { useState } from "react";
import { useDbProducts, type DbProduct } from "@/hooks/useDbProducts";
import { useAuthUser } from "@/hooks/useAuthUser";
import { StarEmoji, FireEmoji, RocketEmoji, ShieldEmoji } from "@/components/CustomEmojis";
import { Search, X, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import EvopayCheckoutModal from "@/components/EvopayCheckoutModal";

export default function StoreView() {
  const { products, categories, loading } = useDbProducts();
  const { user } = useAuthUser();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [selected, setSelected] = useState<DbProduct | null>(null);
  const [variationIndex, setVariationIndex] = useState<number | undefined>(undefined);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);

  const filtered = products.filter((p) => {
    const ms = p.name.toLowerCase().includes(search.toLowerCase());
    const mc = categoryId === "all" || p.category_id === categoryId;
    return ms && mc;
  });

  // Load questions when modal opens
  React.useEffect(() => {
    if (!selected) return;
    setVariationIndex(undefined);
    supabase.from("product_questions").select("*").eq("product_id", selected.id).order("created_at", { ascending: false })
      .then(({ data }) => setQuestions(data || []));
  }, [selected]);

  const handleBuy = () => {
    if (!user) return toast.error("Faça login para comprar");
    if (!selected) return;
    if (selected.seller_id === user.id) return toast.error("Você não pode comprar o próprio produto");
    setCheckoutOpen(true);
  };

  const sendQuestion = async () => {
    if (!user || !selected || !question.trim()) return;
    const { data, error } = await supabase.from("product_questions").insert({
      product_id: selected.id, user_id: user.id, question: question.trim(),
    }).select().single();
    if (error) return toast.error(error.message);
    setQuestions([data, ...questions]);
    setQuestion("");
    toast.success("Pergunta enviada!");
  };

  const variations: Array<{ name: string; price: number }> = Array.isArray(selected?.variations) ? (selected!.variations as any) : [];
  const currentPrice = (selected && typeof variationIndex === "number" && variations[variationIndex])
    ? variations[variationIndex].price
    : selected ? Number(selected.price) : 0;

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl md:text-4xl font-black text-foreground">Descobrir</h1>
          <RocketEmoji className="w-8 h-8" />
        </div>
        <p className="text-muted-foreground">Produtos digitais com entrega rápida via Pix.</p>
      </div>

      <div className="flex items-center bg-card rounded-2xl px-4 py-3 mb-6 border border-border/40">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produtos..."
          className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-2 text-foreground placeholder:text-muted-foreground" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide">
        <button onClick={() => setCategoryId("all")} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${categoryId === "all" ? "btn-gradient" : "bg-card border border-border/40 text-muted-foreground"}`}>Todos</button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => setCategoryId(c.id)} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${categoryId === c.id ? "btn-gradient" : "bg-card border border-border/40 text-muted-foreground"}`}>
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-2xl mb-2">🏜️</p>
          <p className="text-muted-foreground font-medium">Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p, i) => (
            <div key={p.id} onClick={() => setSelected(p)} className="glass-card overflow-hidden group cursor-pointer animate-fade-in-up" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="relative h-44 overflow-hidden bg-muted">
                {p.image_url && <img src={p.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} />}
                {(p as any).category_name && <div className="absolute top-3 right-3 bg-card/90 backdrop-blur px-3 py-1 rounded-full text-[11px] font-bold">{(p as any).category_name}</div>}
                {p.sales_count > 20 && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 bg-destructive/90 px-2 py-1 rounded-full">
                    <FireEmoji className="w-3.5 h-3.5" /><span className="text-[10px] font-bold text-destructive-foreground">HOT</span>
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-bold text-foreground leading-tight mb-1">{p.name}</h3>
                <p className="text-xs text-muted-foreground mb-1">por <span className="text-primary font-semibold">{(p as any).seller_name}</span>
                  {(p as any).seller_public_id && <span className="ml-1 text-[10px] font-mono">{(p as any).seller_public_id}</span>}
                </p>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.description}</p>
                <div className="flex items-end justify-between">
                  <p className="text-xl font-black text-foreground">R$ {Number(p.price).toFixed(2)}</p>
                  <span className="btn-gradient px-4 py-2 text-xs">Ver</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product modal */}
      {selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-foreground/50 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="glass-card w-full max-w-2xl bg-card animate-fade-in-up overflow-hidden max-h-[90vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} className="absolute top-3 right-3 z-10 bg-card/90 backdrop-blur p-2 rounded-full shadow-lg"><X className="w-5 h-5" /></button>

            <div className="relative h-44 sm:h-60 bg-muted">
              {selected.image_url && <img src={selected.image_url} className="w-full h-full object-cover" alt={selected.name} />}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card/95 to-transparent p-5 pt-14">
                <h2 className="text-xl sm:text-2xl font-black text-foreground">{selected.name}</h2>
                <p className="text-xs text-muted-foreground mt-1">{(selected as any).category_name}</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {(selected as any).seller_verified && (
                  <div className="flex items-center gap-1.5 bg-success/10 text-success px-3 py-1.5 rounded-full text-xs font-bold">
                    <CheckCircle className="w-3.5 h-3.5" /> Vendedor Verificado
                  </div>
                )}
                <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold">
                  <ShieldEmoji className="w-3.5 h-3.5" /> Entrega Garantida
                </div>
                {selected.delivery_type === "auto" && (
                  <div className="flex items-center gap-1.5 bg-accent/10 text-accent-foreground px-3 py-1.5 rounded-full text-xs font-bold">
                    <RocketEmoji className="w-3.5 h-3.5" /> Entrega Automática
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Descrição</h4>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selected.description}</p>
              </div>

              {variations.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Escolha a variação</h4>
                  <div className="flex flex-wrap gap-2">
                    {variations.map((v, i) => (
                      <button key={i} onClick={() => setVariationIndex(i)}
                        className={`px-3 py-2 rounded-full text-xs font-semibold border ${variationIndex === i ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-foreground border-transparent"}`}>
                        {v.name} — R$ {Number(v.price).toFixed(2)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Questions */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Perguntas ({questions.length})</h4>
                {questions.length > 0 && (
                  <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                    {questions.map((q) => (
                      <div key={q.id} className="bg-muted rounded-xl p-3">
                        <p className="text-xs text-foreground">{q.question}</p>
                        {q.answer && (
                          <div className="mt-2 pl-3 border-l-2 border-primary/40">
                            <p className="text-[10px] font-bold text-primary mb-0.5">Vendedor:</p>
                            <p className="text-xs text-foreground">{q.answer}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {user ? (
                  <div className="flex gap-2">
                    <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Pergunte ao vendedor..."
                      className="flex-1 p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
                    <button onClick={sendQuestion} className="btn-gradient px-4 py-2 text-sm">Enviar</button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground"><AlertTriangle className="w-3 h-3 inline mr-1" />Faça login para perguntar.</p>
                )}
              </div>

              <div className="flex items-center justify-between bg-muted rounded-2xl p-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total</p>
                  <p className="text-2xl sm:text-3xl font-black text-foreground">R$ {currentPrice.toFixed(2)}</p>
                </div>
                <button onClick={handleBuy} className="btn-gradient px-6 sm:px-8 py-3 text-sm sm:text-base font-black rounded-2xl shadow-lg hover:scale-105 transition-transform">
                  COMPRAR COM PIX
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && selected && (
        <EvopayCheckoutModal
          productId={selected.id}
          variationIndex={variationIndex}
          onClose={() => setCheckoutOpen(false)}
          onPaid={() => { setSelected(null); }}
        />
      )}
    </div>
  );
}
