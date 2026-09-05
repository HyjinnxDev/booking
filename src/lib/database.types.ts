// Generated: supabase gen types typescript --project-id bxocbyohmuiocedqavfs
// Regenerate after every schema migration. See §5 of the 2026-09-03 review —
// broad adoption (SupabaseClient<Database> everywhere, dropping the `any` casts)
// is still pending; this file exists so new code can `import type { Database }`.

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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          meta: Json
          org_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          org_id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      availability: {
        Row: {
          coach_id: string
          end_time: string
          id: string
          org_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          coach_id: string
          end_time: string
          id?: string
          org_id?: string
          start_time: string
          weekday: number
        }
        Update: {
          coach_id?: string
          end_time?: string
          id?: string
          org_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          class_occurrence_id: string | null
          client_id: string
          coach_id: string
          created_at: string
          end_at: string
          ics_sequence: number
          id: string
          intake: Json | null
          notes: string | null
          org_id: string
          pass_id: string | null
          payment_status: string
          price_cents: number
          reminded_at: string | null
          resource_id: string | null
          session_variant_id: string | null
          start_at: string
          status: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          class_occurrence_id?: string | null
          client_id: string
          coach_id: string
          created_at?: string
          end_at: string
          ics_sequence?: number
          id?: string
          intake?: Json | null
          notes?: string | null
          org_id?: string
          pass_id?: string | null
          payment_status?: string
          price_cents?: number
          reminded_at?: string | null
          resource_id?: string | null
          session_variant_id?: string | null
          start_at: string
          status?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          class_occurrence_id?: string | null
          client_id?: string
          coach_id?: string
          created_at?: string
          end_at?: string
          ics_sequence?: number
          id?: string
          intake?: Json | null
          notes?: string | null
          org_id?: string
          pass_id?: string | null
          payment_status?: string
          price_cents?: number
          reminded_at?: string | null
          resource_id?: string | null
          session_variant_id?: string | null
          start_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_class_occurrence_id_fkey"
            columns: ["class_occurrence_id"]
            isOneToOne: false
            referencedRelation: "class_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: false
            referencedRelation: "passes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_session_variant_id_fkey"
            columns: ["session_variant_id"]
            isOneToOne: false
            referencedRelation: "session_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      class_occurrences: {
        Row: {
          capacity: number
          coach_id: string
          created_at: string
          end_at: string
          id: string
          org_id: string
          resource_id: string | null
          series_id: string | null
          session_variant_id: string
          start_at: string
          status: string
        }
        Insert: {
          capacity: number
          coach_id: string
          created_at?: string
          end_at: string
          id?: string
          org_id?: string
          resource_id?: string | null
          series_id?: string | null
          session_variant_id: string
          start_at: string
          status?: string
        }
        Update: {
          capacity?: number
          coach_id?: string
          created_at?: string
          end_at?: string
          id?: string
          org_id?: string
          resource_id?: string | null
          series_id?: string | null
          session_variant_id?: string
          start_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_occurrences_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_occurrences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_occurrences_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_occurrences_session_variant_id_fkey"
            columns: ["session_variant_id"]
            isOneToOne: false
            referencedRelation: "session_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          author_id: string | null
          body: string
          client_id: string
          created_at: string
          id: string
          org_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          client_id: string
          created_at?: string
          id?: string
          org_id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          name: string
          org_id: string
          sort: number
          timezone: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name: string
          org_id?: string
          sort?: number
          timezone?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          sort?: number
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      passes: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          name: string
          org_id: string
          price_cents: number
          session_type_id: string | null
          status: string
          total: number
          used: number
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          name: string
          org_id?: string
          price_cents?: number
          session_type_id?: string | null
          status?: string
          total: number
          used?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          name?: string
          org_id?: string
          price_cents?: number
          session_type_id?: string | null
          status?: string
          total?: number
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "passes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passes_session_type_id_fkey"
            columns: ["session_type_id"]
            isOneToOne: false
            referencedRelation: "session_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          bio: string | null
          cal_token: string
          created_at: string
          email: string
          id: string
          name: string
          org_id: string
          phone: string | null
          role: string
        }
        Insert: {
          active?: boolean
          bio?: string | null
          cal_token?: string
          created_at?: string
          email?: string
          id: string
          name?: string
          org_id?: string
          phone?: string | null
          role?: string
        }
        Update: {
          active?: boolean
          bio?: string | null
          cal_token?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          org_id?: string
          phone?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          active: boolean
          created_at: string
          id: string
          location_id: string
          name: string
          org_id: string
          sort: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          location_id: string
          name: string
          org_id?: string
          sort?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          location_id?: string
          name?: string
          org_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "resources_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      session_types: {
        Row: {
          active: boolean
          blurb: string | null
          cancel_cutoff_hours: number
          coach_id: string
          created_at: string
          id: string
          intake_fields: Json
          kind: string
          location_id: string
          name: string
          org_id: string
          sort: number
        }
        Insert: {
          active?: boolean
          blurb?: string | null
          cancel_cutoff_hours?: number
          coach_id: string
          created_at?: string
          id?: string
          intake_fields?: Json
          kind: string
          location_id?: string
          name: string
          org_id?: string
          sort?: number
        }
        Update: {
          active?: boolean
          blurb?: string | null
          cancel_cutoff_hours?: number
          coach_id?: string
          created_at?: string
          id?: string
          intake_fields?: Json
          kind?: string
          location_id?: string
          name?: string
          org_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_types_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_types_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      session_variants: {
        Row: {
          active: boolean
          capacity: number
          duration_min: number
          id: string
          name: string
          org_id: string
          price_cents: number
          session_type_id: string
          sort: number
        }
        Insert: {
          active?: boolean
          capacity?: number
          duration_min: number
          id?: string
          name: string
          org_id?: string
          price_cents?: number
          session_type_id: string
          sort?: number
        }
        Update: {
          active?: boolean
          capacity?: number
          duration_min?: number
          id?: string
          name?: string
          org_id?: string
          price_cents?: number
          session_type_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_variants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_variants_session_type_id_fkey"
            columns: ["session_type_id"]
            isOneToOne: false
            referencedRelation: "session_types"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          booking_window_days: number
          brand: string | null
          min_notice_min: number
          org_id: string
          series_weeks: number
          slot_step_min: number
          updated_at: string
        }
        Insert: {
          booking_window_days?: number
          brand?: string | null
          min_notice_min?: number
          org_id?: string
          series_weeks?: number
          slot_step_min?: number
          updated_at?: string
        }
        Update: {
          booking_window_days?: number
          brand?: string | null
          min_notice_min?: number
          org_id?: string
          series_weeks?: number
          slot_step_min?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_locations: {
        Row: {
          location_id: string
          org_id: string
          staff_id: string
        }
        Insert: {
          location_id: string
          org_id?: string
          staff_id: string
        }
        Update: {
          location_id?: string
          org_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_locations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off: {
        Row: {
          coach_id: string
          created_at: string
          end_at: string
          id: string
          org_id: string
          reason: string | null
          start_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          end_at: string
          id?: string
          org_id?: string
          reason?: string | null
          start_at: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          end_at?: string
          id?: string
          org_id?: string
          reason?: string | null
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          class_occurrence_id: string
          client_id: string
          created_at: string
          id: string
          notified_at: string | null
          org_id: string
        }
        Insert: {
          class_occurrence_id: string
          client_id: string
          created_at?: string
          id?: string
          notified_at?: string | null
          org_id?: string
        }
        Update: {
          class_occurrence_id?: string
          client_id?: string
          created_at?: string
          id?: string
          notified_at?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_class_occurrence_id_fkey"
            columns: ["class_occurrence_id"]
            isOneToOne: false
            referencedRelation: "class_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_org_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
