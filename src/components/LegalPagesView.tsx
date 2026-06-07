import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Shield, HelpCircle, BookOpen, Loader2 } from "lucide-react";

type Section = "rules" | "terms" | "privacy" | "faq";

export default function LegalPagesView() {
  const [cfg, setCfg] = useState<any | null>(null);
  const [section, setSection] = useState<Section>("rules");

  useEffect(() => {
    supabase.from("app_config").select("terms_text, privacy_text, faq_text, rules_text").eq("id", 1).maybeSingle()
      .then(({ data }) => setCfg(data));
  }, []);

  if (!cfg) return <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  const tabs: { k: Section; label: string; icon: React.ReactNode; key: keyof typeof cfg }[] = [
    { k: "rules", label: "Regras", icon: <BookOpen className="w-4 h-4" />, key: "rules_text" },
    { k: "terms", label: "Termos", icon: <FileText className="w-4 h-4" />, key: "terms_text" },
    { k: "privacy", label: "Privacidade", icon: <Shield className="w-4 h-4" />, key: "privacy_text" },
    { k: "faq", label: "FAQ", icon: <HelpCircle className="w-4 h-4" />, key: "faq_text" },
  ];

  const current = tabs.find((t) => t.k === section)!;

  return (
    <div className="animate-fade-in-up max-w-3xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-black text-foreground mb-1">Central de Informações</h1>
      <p className="text-muted-foreground mb-6 text-sm">Regras, termos, privacidade e dúvidas frequentes.</p>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-5">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setSection(t.k)} className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${section === t.k ? "btn-gradient" : "bg-card border border-border/40 text-muted-foreground"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="glass-card p-6">
        <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{cfg[current.key] || "Conteúdo em breve."}</pre>
      </div>
    </div>
  );
}
