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
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      orgs: {
        Row: { created_at: string; id: string; name: string; slug: string }
        Insert: { created_at?: string; id?: string; name: string; slug: string }
        Update: { created_at?: string; id?: string; name?: string; slug?: string }
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
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
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
          cal_token?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          org_id?: string
          phone?: string | null
          role?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      staff_locations: {
        Row: { location_id: string; org_id: string; staff_id: string }
        Insert: { location_id: string; org_id?: string; staff_id: string }
        Update: { location_id?: string; org_id?: string; staff_id?: string }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      current_org_id: { Args: Record<string, never>; Returns: string }
      is_admin: { Args: Record<string, never>; Returns: boolean }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
