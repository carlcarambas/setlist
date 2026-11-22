// Supabase database types.
//
// GENERATED FILE: regenerate with `npm run db:types` after every migration.
// This first version was written by hand to match supabase/migrations/20261122000000_foundation.sql
// because the local Supabase stack (Docker) wasn't running when Milestone 0 was built.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      app_settings: {
        Row: {
          church_name: string;
          id: boolean;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          church_name?: string;
          id?: boolean;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          church_name?: string;
          id?: boolean;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
