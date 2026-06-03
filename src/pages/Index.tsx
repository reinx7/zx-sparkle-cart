import React, { useEffect, useState } from "react";
import { useStore, StoreProvider } from "@/store/StoreContext";
import { supabase } from "@/integrations/supabase/client";
import AuthScreen from "@/components/AuthScreen";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ProfileModal from "@/components/ProfileModal";
import StoreView from "@/components/StoreView";
import InventoryView from "@/components/InventoryView";
import SupportView from "@/components/SupportView";
import AdminView from "@/components/AdminView";
import MyPurchasesView from "@/components/MyPurchasesView";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "profile";

function SessionBridge() {
  const { state, login, logout } = useStore();

  useEffect(() => {
    // Listen first, then check existing session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const meta: any = session.user.user_metadata ?? {};
        const name = meta.name || meta.full_name || session.user.email?.split("@")[0] || "Usuário";
        login(session.user.email ?? "", name);
      } else {
        logout();
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user && !state.currentUser) {
        const meta: any = data.session.user.user_metadata ?? {};
        const name = meta.name || meta.full_name || data.session.user.email?.split("@")[0] || "Usuário";
        login(data.session.user.email ?? "", name);
      }
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function Dashboard() {
  const { state } = useStore();
  const [view, setView] = useState<View>(() => (state.currentUser?.isAdmin ? "admin" : "store"));
  const [profileOpen, setProfileOpen] = useState(false);

  if (!state.currentUser) return <AuthScreen />;

  return (
    <div className="bg-gradient-page min-h-screen pb-24">
      {state.config.globalNotice && state.config.globalNotice.trim() && (
        <div className="bg-primary text-primary-foreground text-center text-xs sm:text-sm py-2 px-4 font-medium flex items-center justify-center gap-2">
          <span>{state.config.globalNotice}</span>
        </div>
      )}

      <Header onProfileClick={() => setProfileOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {view === "store" && <StoreView />}
        {view === "inventory" && <InventoryView />}
        {view === "purchases" && <MyPurchasesView />}
        {view === "support" && <SupportView />}
        {view === "admin" && state.currentUser.isAdmin && <AdminView />}
      </main>

      <BottomNav current={view} onChange={setView} />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}

export default function Index() {
  return (
    <StoreProvider>
      <SessionBridge />
      <Dashboard />
    </StoreProvider>
  );
}
