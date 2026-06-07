import React, { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  available: number;
  defaultPixKey?: string | null;
  defaultPixType?: string | null;
  onClose: () => void;
  onDone?: () => void;
}

export default function WithdrawDialog({ available, defaultPixKey, defaultPixType, onClose, onDone }: Props) {
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState(defaultPixKey || "");
  const [pixType, setPixType] = useState(defaultPixType || "cpf");
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState<{ min: number; feePct: number; dMin: number; dMax: number }>({ min: 10, feePct: 0, dMin: 5, dMax: 7 });

  useEffect(() => {
    supabase.from("app_config").select("min_withdraw_amount, withdraw_fee_percent, withdraw_processing_days_min, withdraw_processing_days_max").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setCfg({
        min: Number((data as any).min_withdraw_amount ?? 10),
        feePct: Number((data as any).withdraw_fee_percent ?? 0),
        dMin: (data as any).withdraw_processing_days_min ?? 5,
        dMax: (data as any).withdraw_processing_days_max ?? 7,
      });
    });
  }, []);

  const val = parseFloat(amount) || 0;
  const fee = +(val * cfg.feePct / 100).toFixed(2);
  const net = +(val - fee).toFixed(2);

  const submit = async () => {
    if (!val || val <= 0) return toast.error("Valor inválido");
    if (val < cfg.min) return toast.error(`Saque mínimo: R$ ${cfg.min.toFixed(2)}`);
    if (val > available) return toast.error("Valor maior que saldo disponível");
    if (!pixKey) return toast.error("Informe a chave Pix");
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("request-withdraw", { body: { amount: val, pix_key: pixKey, pix_type: pixType } });
    setLoading(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error?.message || "Erro");
    toast.success(`Saque solicitado! Líquido R$ ${net.toFixed(2)} em ${cfg.dMin}–${cfg.dMax} dias úteis.`);
    onDone?.(); onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 bg-foreground/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card w-full max-w-md bg-card p-6 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-foreground">Solicitar saque</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-1">Saldo disponível: <span className="font-bold text-foreground">R$ {available.toFixed(2)}</span></p>
        <p className="text-[11px] text-muted-foreground mb-4">Mínimo R$ {cfg.min.toFixed(2)}{cfg.feePct > 0 ? ` · Taxa ${cfg.feePct}%` : " · Sem taxa"}</p>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Valor bruto (R$)</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-3 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 ring-primary" />
            {val > 0 && cfg.feePct > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">Você receberá <b className="text-foreground">R$ {net.toFixed(2)}</b> (taxa R$ {fee.toFixed(2)})</p>
            )}
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Tipo de chave</label>
            <select value={pixType} onChange={(e) => setPixType(e.target.value)} className="w-full p-3 rounded-xl bg-muted text-foreground text-sm outline-none">
              <option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option><option value="phone">Telefone</option><option value="random">Aleatória</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Chave Pix</label>
            <input value={pixKey} onChange={(e) => setPixKey(e.target.value)} className="w-full p-3 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 ring-primary" />
          </div>
        </div>

        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 mt-4">
          <p className="text-[11px] text-foreground">Saques são processados manualmente em <b>{cfg.dMin} a {cfg.dMax} dias úteis</b>. Não existe saque instantâneo.</p>
        </div>

        <button disabled={loading} onClick={submit} className="w-full btn-gradient p-3 text-sm mt-4 flex items-center justify-center gap-2 disabled:opacity-60">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar solicitação
        </button>
      </div>
    </div>
  );
}
