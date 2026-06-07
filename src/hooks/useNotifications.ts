import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DbNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function useNotifications(userId: string | null | undefined) {
  const [items, setItems] = useState<DbNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setItems([]); setLoading(false); return; }
    const { data } = await supabase.from("notifications").select("*")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    setItems((data as any) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`notifs-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as any;
          setItems((cur) => [n, ...cur].slice(0, 50));
          // Browser push notification (if allowed)
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try { new Notification(n.title, { body: n.body || "", icon: "/favicon.ico", tag: n.id }); } catch {}
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setItems((cur) => cur.map((x) => x.id === id ? { ...x, read: true } : x));
  };
  const markAllRead = async () => {
    if (!userId) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    setItems((cur) => cur.map((x) => ({ ...x, read: true })));
  };

  return { items, loading, reload: load, markRead, markAllRead, unread: items.filter((i) => !i.read).length };
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}
