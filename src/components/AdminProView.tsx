import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import AdminView from "@/components/AdminView";
import OrderChat from "@/components/OrderChat";
import { ShieldEmoji } from "@/components/CustomEmojis";
import { Bell, CreditCard, Loader2, MessageCircle, Search, ShieldAlert, ShoppingBag, Users, X } from "lucide-react";
import { toast } from "sonner";

type Tab = "resumo" | "classico