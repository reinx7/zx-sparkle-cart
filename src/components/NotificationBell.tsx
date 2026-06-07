import React, { useEffect, useRef, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useNotifications, requestBrowserNotificationPermission } from "@/hooks/useNotifications";
import { Bell, Check, BellRing } from "lucide-react";
import { toast } from "sonner";

export default function NotificationBell() {
  const { userId } = useAuthUser();
  const { items, unread, markRead, markAllRead } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission>(typeof Notification !== "undefined" ? Notification.permission : "default");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!userId) return null;

  const enablePush = async () => {
    const r = await requestBrowserNotificationPermission();
    setPerm(r);
    if (r === "granted") toast.success("Notificações do navegador ativadas!");
    else if (r === "denied") toast.error("Permissão negada. Ative manualmente no navegador.");
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="p-2 rounded-xl hover:bg-muted transition relative" title="Notificações">
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] min-h-[18px] flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-black rounded-full border-2 border-card">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 sm:w-96 glass-card bg-card p-0 overflow-hidden z-[100] animate-fade-in-up shadow-xl">
          <div className="flex items-center justify-between p-3 border-b border-border/40">
            <p className="font-bold text-foreground text-sm">Notificações</p>
            {items.length > 0 && unread > 0 && (
              <button onClick={markAllRead} className="text-[11px] text-primary font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Marcar todas</button>
            )}
          </div>

          {perm !== "granted" && (
            <button onClick={enablePush} className="w-full p-3 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center justify-center gap-2 border-b border-border/40">
              <BellRing className="w-4 h-4" /> Ativar notificações do navegador
            </button>
          )}

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-10">Sem notificações.</p>
            ) : items.map((n) => (
              <button key={n.id} onClick={() => markRead(n.id)} className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/50 border-b border-border/20 transition ${!n.read ? "bg-primary/5" : ""}`}>
                {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">{n.title}</p>
                  {n.body && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
