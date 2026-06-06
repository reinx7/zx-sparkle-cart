export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          meta: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          meta?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          meta?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          balance_release_days: number
          discord_link: string | null
          global_notice: string | null
          id: number
          logo_url: string | null
          maintenance_mode: boolean
          platform_fee_percent: number
          privacy_url: string | null
          site_name: string
          terms_url: string | null
          updated_at: string
          withdraw_processing_days_max: number
          withdraw_processing_days_min: number
        }
        Insert: {
          balance_release_days?: number
          discord_link?: string | null
          global_notice?: string | null
          id?: number
          logo_url?: string | null
          maintenance_mode?: boolean
          platform_fee_percent?: number
          privacy_url?: string | null
          site_name?: string
          terms_url?: string | null
          updated_at?: string
          withdraw_processing_days_max?: number
          withdraw_processing_days_min?: number
        }
        Update: {
          balance_release_days?: number
          discord_link?: string | null
          global_notice?: string | null
          id?: number
          logo_url?: string | null
          maintenance_mode?: boolean
          platform_fee_percent?: number
          privacy_url?: string | null
          site_name?: string
          terms_url?: string | null
          updated_at?: string
          withdraw_processing_days_max?: number
          withdraw_processing_days_min?: number
        }
        Relationships: []
      }
      auth_settings: {
        Row: {
          discord_enabled: boolean
          email_enabled: boolean
          google_enabled: boolean
          id: number
          registration_enabled: boolean
          updated_at: string
        }
        Insert: {
          discord_enabled?: boolean
          email_enabled?: boolean
          google_enabled?: boolean
          id?: number
          registration_enabled?: boolean
          updated_at?: string
        }
        Update: {
          discord_enabled?: boolean
          email_enabled?: boolean
          google_enabled?: boolean
          id?: number
          registration_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      bans: {
        Row: {
          active: boolean
          admin_id: string
          admin_note: string | null
          created_at: string
          expires_at: string | null
          id: string
          reason: string
          scope: Database["public"]["Enums"]["ban_scope"]
          user_id: string
        }
        Insert: {
          active?: boolean
          admin_id: string
          admin_note?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          reason: string
          scope?: Database["public"]["Enums"]["ban_scope"]
          user_id: string
        }
        Update: {
          active?: boolean
          admin_id?: string
          admin_note?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string
          scope?: Database["public"]["Enums"]["ban_scope"]
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      disputes: {
        Row: {
          created_at: string
          id: string
          messages: Json
          opened_by: string
          order_id: string
          reason: string
          resolution: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          opened_by: string
          order_id: string
          reason: string
          resolution?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          opened_by?: string
          order_id?: string
          reason?: string
          resolution?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_settings: {
        Row: {
          base_url: string
          enabled: boolean
          environment: string
          id: number
          provider: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          base_url?: string
          enabled?: boolean
          environment?: string
          id?: number
          provider?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          base_url?: string
          enabled?: boolean
          environment?: string
          id?: number
          provider?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          delivered_content: string | null
          id: string
          platform_fee: number
          product_id: string
          release_at: string | null
          released: boolean
          seller_amount: number
          seller_id: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          variation: Json | null
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          delivered_content?: string | null
          id?: string
          platform_fee?: number
          product_id: string
          release_at?: string | null
          released?: boolean
          seller_amount?: number
          seller_id: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          variation?: Json | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          delivered_content?: string | null
          id?: string
          platform_fee?: number
          product_id?: string
          release_at?: string | null
          released?: boolean
          seller_amount?: number
          seller_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          variation?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          paid_at: string | null
          provider: string
          provider_payment_id: string | null
          qr_code_text: string | null
          qr_code_url: string | null
          raw: Json | null
          service_fee: number | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id: string
          paid_at?: string | null
          provider?: string
          provider_payment_id?: string | null
          qr_code_text?: string | null
          qr_code_url?: string | null
          raw?: Json | null
          service_fee?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          provider?: string
          provider_payment_id?: string | null
          qr_code_text?: string | null
          qr_code_url?: string | null
          raw?: Json | null
          service_fee?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          created_at: string
          id: string
          product_id: string
          question: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          created_at?: string
          id?: string
          product_id: string
          question: string
          user_id: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          created_at?: string
          id?: string
          product_id?: string
          question?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          banner_url: string | null
          category_id: string | null
          created_at: string
          delivery_content: string | null
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          description: string
          gallery: Json
          id: string
          image_url: string | null
          name: string
          price: number
          rejection_reason: string | null
          sales_count: number
          seller_id: string
          status: Database["public"]["Enums"]["product_status"]
          stock: number | null
          updated_at: string
          variations: Json
        }
        Insert: {
          banner_url?: string | null
          category_id?: string | null
          created_at?: string
          delivery_content?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          description?: string
          gallery?: Json
          id?: string
          image_url?: string | null
          name: string
          price: number
          rejection_reason?: string | null
          sales_count?: number
          seller_id: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number | null
          updated_at?: string
          variations?: Json
        }
        Update: {
          banner_url?: string | null
          category_id?: string | null
          created_at?: string
          delivery_content?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          description?: string
          gallery?: Json
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          rejection_reason?: string | null
          sales_count?: number
          seller_id?: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number | null
          updated_at?: string
          variations?: Json
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_provider: string | null
          avatar_url: string | null
          banned_at: string | null
          banned_reason: string | null
          created_at: string
          email: string | null
          id: string
          is_verified_seller: boolean
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          last_login_at: string | null
          name: string
          phone: string | null
          pix_key: string | null
          pix_type: string | null
          public_id: string
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          auth_provider?: string | null
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          created_at?: string
          email?: string | null
          id: string
          is_verified_seller?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          last_login_at?: string | null
          name?: string
          phone?: string | null
          pix_key?: string | null
          pix_type?: string | null
          public_id: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          auth_provider?: string | null
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_verified_seller?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          last_login_at?: string | null
          name?: string
          phone?: string | null
          pix_key?: string | null
          pix_type?: string | null
          public_id?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_note: string | null
          category: string
          created_at: string
          description: string
          evidence_urls: Json
          id: string
          priority: number
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          target_product_id: string | null
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          category: string
          created_at?: string
          description: string
          evidence_urls?: Json
          id?: string
          priority?: number
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          target_product_id?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          category?: string
          created_at?: string
          description?: string
          evidence_urls?: Json
          id?: string
          priority?: number
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          target_product_id?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string | null
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          product_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_documents: {
        Row: {
          admin_note: string | null
          created_at: string
          doc_back_path: string | null
          doc_front_path: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string | null
          status: Database["public"]["Enums"]["kyc_doc_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          doc_back_path?: string | null
          doc_front_path?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          status?: Database["public"]["Enums"]["kyc_doc_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          doc_back_path?: string | null
          doc_front_path?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          status?: Database["public"]["Enums"]["kyc_doc_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          id: string
          messages: Json
          priority: number
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          messages?: Json
          priority?: number
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          messages?: Json
          priority?: number
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          available_balance: number
          pending_balance: number
          total_earned: number
          total_spent: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          pending_balance?: number
          total_earned?: number
          total_spent?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          pending_balance?: number
          total_earned?: number
          total_spent?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdraw_requests: {
        Row: {
          admin_id: string | null
          admin_note: string | null
          amount: number
          created_at: string
          estimated_release_at: string | null
          id: string
          pix_key: string
          pix_type: string
          processed_at: string | null
          provider_withdraw_id: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["withdraw_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          admin_note?: string | null
          amount: number
          created_at?: string
          estimated_release_at?: string | null
          id?: string
          pix_key: string
          pix_type: string
          processed_at?: string | null
          provider_withdraw_id?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["withdraw_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          admin_note?: string | null
          amount?: number
          created_at?: string
          estimated_release_at?: string | null
          id?: string
          pix_key?: string
          pix_type?: string
          processed_at?: string | null
          provider_withdraw_id?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["withdraw_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_public_id: { Args: never; Returns: string }
      get_product_delivery_content: { Args: { _id: string }; Returns: string }
      get_public_profiles: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          id: string
          is_verified_seller: boolean
          name: string
          public_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_banned: {
        Args: {
          _scope?: Database["public"]["Enums"]["ban_scope"]
          _user_id: string
        }
        Returns: boolean
      }
      storage_object_in_approved_product: {
        Args: { _name: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "seller" | "admin"
      ban_scope: "full" | "sell" | "buy" | "withdraw"
      delivery_type: "auto" | "manual"
      dispute_status:
        | "open"
        | "seller_response"
        | "admin_review"
        | "resolved_buyer"
        | "resolved_seller"
      kyc_doc_status: "pending" | "approved" | "rejected"
      kyc_status: "not_submitted" | "in_review" | "approved" | "rejected"
      order_status:
        | "pending"
        | "paid"
        | "delivered"
        | "disputed"
        | "refunded"
        | "canceled"
      payment_status:
        | "PENDING"
        | "COMPLETED"
        | "CANCELED"
        | "WAITING_FOR_REFUND"
        | "REFUNDED"
        | "EXPIRED"
        | "ERROR"
      product_status: "draft" | "pending" | "approved" | "rejected" | "paused"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      ticket_status: "open" | "answered" | "closed"
      user_status: "active" | "suspended" | "banned" | "pending_review"
      withdraw_status:
        | "pending"
        | "approved"
        | "processing"
        | "completed"
        | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "seller", "admin"],
      ban_scope: ["full", "sell", "buy", "withdraw"],
      delivery_type: ["auto", "manual"],
      dispute_status: [
        "open",
        "seller_response",
        "admin_review",
        "resolved_buyer",
        "resolved_seller",
      ],
      kyc_doc_status: ["pending", "approved", "rejected"],
      kyc_status: ["not_submitted", "in_review", "approved", "rejected"],
      order_status: [
        "pending",
        "paid",
        "delivered",
        "disputed",
        "refunded",
        "canceled",
      ],
      payment_status: [
        "PENDING",
        "COMPLETED",
        "CANCELED",
        "WAITING_FOR_REFUND",
        "REFUNDED",
        "EXPIRED",
        "ERROR",
      ],
      product_status: ["draft", "pending", "approved", "rejected", "paused"],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      ticket_status: ["open", "answered", "closed"],
      user_status: ["active", "suspended", "banned", "pending_review"],
      withdraw_status: [
        "pending",
        "approved",
        "processing",
        "completed",
        "rejected",
      ],
    },
  },
} as const
