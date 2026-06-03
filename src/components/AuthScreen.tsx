import React, { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Mail, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { RocketEmoji } from "@/components/CustomEmojis";

type AuthSettings = {
  email_enabled: boolean;
  google_enabled: boolean;
  discord_enabled: boolean;
  registration_enabled: boolean;
};

const defaultSettings: AuthSettings = {
  email_enabled: true,
  google_enabled: true,
  discord_enabled: false,
  registration_enabled: true,
};

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<AuthSettings>(defaultSettings);

  useEffect(() => {
    supabase
      .from("auth_settings")
      .select("email_enabled,google_enabled,discord_enabled,registration_enabled")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings(data as AuthSettings);
      });
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!email || (mode !== "forgot" && !password)) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
      } else if (mode === "register") {
        if (!settings.registration_enabled) {
          toast.error("Novos cadastros estão temporariamente fechados.");
          return;
        }
        if (password.length < 6) {
          toast.error("A senha precisa ter ao menos 6 caracteres.");
          return;
        }
        if (password !== confirmPassword) {
          toast.error("As senhas não coincidem.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um e-mail para redefinir sua senha.");
        setMode("login");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível concluir a operação.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Falha ao entrar com Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gradient-page overflow-y-auto">
      <div className="glass-card w-full max-w-md p-6 sm:p-8 relative z-10 bg-card my-4 animate-fade-in-up">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-black tracking-tighter text-foreground">
            ZX<span className="text-primary">MAX</span>
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <RocketEmoji className="w-5 h-5" />
            <p className="text-muted-foreground text-sm">O futuro do comércio digital</p>
          </div>
        </div>

        {mode !== "forgot" && (
          <div className="flex gap-1 mb-5 p-1 bg-muted rounded-2xl">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${mode === "login" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              disabled={!settings.registration_enabled}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${mode === "register" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"}`}
            >
              Criar Conta
            </button>
          </div>
        )}

        {mode === "register" && !settings.registration_enabled && (
          <p className="mb-4 text-sm text-destructive text-center font-medium">
            Novos cadastros estão temporariamente fechados.
          </p>
        )}

        {settings.email_enabled && (
          <form onSubmit={handleEmailAuth} className="space-y-3" autoComplete="on">
            {mode === "register" && (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
                autoComplete="name"
                className="w-full p-4 rounded-2xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground placeholder:text-muted-foreground text-sm"
              />
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              autoComplete="email"
              required
              className="w-full p-4 rounded-2xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground placeholder:text-muted-foreground text-sm"
            />
            {mode !== "forgot" && (
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  className="w-full p-4 pr-12 rounded-2xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground placeholder:text-muted-foreground text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-2"
                  tabIndex={-1}
                  aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}
            {mode === "register" && (
              <input
                type={showPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmar senha"
                autoComplete="new-password"
                className="w-full p-4 rounded-2xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground placeholder:text-muted-foreground text-sm"
              />
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gradient p-4 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === "forgot" ? (
                <Mail className="w-5 h-5" />
              ) : (
                <KeyRound className="w-5 h-5" />
              )}
              {mode === "login" && "Acessar plataforma"}
              {mode === "register" && "Criar conta"}
              {mode === "forgot" && "Enviar link de recuperação"}
            </button>

            <div className="flex justify-between text-xs pt-1">
              {mode === "login" ? (
                <button type="button" onClick={() => setMode("forgot")} className="text-primary hover:underline">
                  Esqueci minha senha
                </button>
              ) : (
                <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
                  Voltar para login
                </button>
              )}
            </div>
          </form>
        )}

        {(settings.google_enabled || settings.discord_enabled) && mode !== "forgot" && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-2">
              {settings.google_enabled && (
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 p-3 border border-border rounded-2xl hover:bg-muted transition text-sm font-semibold text-foreground disabled:opacity-60"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Entrar com Google
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
