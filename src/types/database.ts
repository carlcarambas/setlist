
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_settings": {
                  Row: {
                    "church_name": string,"id": boolean,"timezone": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "church_name"?: string,"id"?: boolean,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "church_name"?: string,"id"?: boolean,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "app_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"arrangements": {
                  Row: {
                    "bpm": number | null,"content_sha256": string | null,"created_at": string,"file_size_bytes": number,"id": string,"instrument_notes": string | null,"mime_type": string,"music_piece_id": string,"musical_key": string | null,"original_filename": string,"status": Database["public"]['Enums']["arrangement_status"],"storage_path": string,"title": string,"updated_at": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bpm"?: number | null,"content_sha256"?: string | null,"created_at"?: string,"file_size_bytes": number,"id"?: string,"instrument_notes"?: string | null,"mime_type": string,"music_piece_id": string,"musical_key"?: string | null,"original_filename": string,"status"?: Database["public"]['Enums']["arrangement_status"],"storage_path": string,"title": string,"updated_at"?: string,"uploaded_by"?: string
                  }
                  Update: {
                    "bpm"?: number | null,"content_sha256"?: string | null,"created_at"?: string,"file_size_bytes"?: number,"id"?: string,"instrument_notes"?: string | null,"mime_type"?: string,"music_piece_id"?: string,"musical_key"?: string | null,"original_filename"?: string,"status"?: Database["public"]['Enums']["arrangement_status"],"storage_path"?: string,"title"?: string,"updated_at"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "arrangements_music_piece_id_fkey"
      columns: ["music_piece_id"]
isOneToOne: false
      referencedRelation: "music_pieces"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "arrangements_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_plans": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"plan_id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"plan_id": string,"position"?: number
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"plan_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_plans_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_plans_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "created_at": string,"created_by": string,"description": string | null,"event_date": string,"id": string,"start_time": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"description"?: string | null,"event_date": string,"id"?: string,"start_time"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"description"?: string | null,"event_date"?: string,"id"?: string,"start_time"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"music_pieces": {
                  Row: {
                    "category": string | null,"composer": string | null,"created_at": string,"created_by": string,"description": string | null,"id": string,"status": Database["public"]['Enums']["content_status"],"tags": (string)[],"title": string,"updated_at": string,"updated_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"composer"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["content_status"],"tags"?: (string)[],"title": string,"updated_at"?: string,"updated_by"?: string
                  }
                  Update: {
                    "category"?: string | null,"composer"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"id"?: string,"status"?: Database["public"]['Enums']["content_status"],"tags"?: (string)[],"title"?: string,"updated_at"?: string,"updated_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "music_pieces_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "music_pieces_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_activities": {
                  Row: {
                    "action": string,"created_at": string,"id": string,"metadata": Json | null,"plan_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"id"?: string,"metadata"?: Json | null,"plan_id": string,"user_id"?: string
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"id"?: string,"metadata"?: Json | null,"plan_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_activities_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_activities_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_items": {
                  Row: {
                    "added_by": string,"arrangement_id": string,"created_at": string,"id": string,"notes": string | null,"plan_id": string,"position": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string,"arrangement_id": string,"created_at"?: string,"id"?: string,"notes"?: string | null,"plan_id": string,"position": number,"updated_at"?: string
                  }
                  Update: {
                    "added_by"?: string,"arrangement_id"?: string,"created_at"?: string,"id"?: string,"notes"?: string | null,"plan_id"?: string,"position"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_items_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_items_arrangement_id_fkey"
      columns: ["arrangement_id"]
isOneToOne: false
      referencedRelation: "arrangements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_items_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_links": {
                  Row: {
                    "created_at": string,"created_by": string,"expires_at": string | null,"id": string,"permission": Database["public"]['Enums']["share_permission"],"plan_id": string,"revoked_at": string | null,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string | null,"id"?: string,"permission"?: Database["public"]['Enums']["share_permission"],"plan_id": string,"revoked_at"?: string | null,"token_hash": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string | null,"id"?: string,"permission"?: Database["public"]['Enums']["share_permission"],"plan_id"?: string,"revoked_at"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_links_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_links_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_shares": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"permission": Database["public"]['Enums']["share_permission"],"plan_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"permission": Database["public"]['Enums']["share_permission"],"plan_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"permission"?: Database["public"]['Enums']["share_permission"],"plan_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_shares_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_shares_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_shares_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"owner_id": string,"status": Database["public"]['Enums']["plan_status"],"title": string,"updated_at": string,"updated_by": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"owner_id"?: string,"status"?: Database["public"]['Enums']["plan_status"],"title": string,"updated_at"?: string,"updated_by"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"owner_id"?: string,"status"?: Database["public"]['Enums']["plan_status"],"title"?: string,"updated_at"?: string,"updated_by"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "plans_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plans_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"email": string,"id": string,"role": Database["public"]['Enums']["member_role"],"status": Database["public"]['Enums']["member_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"email": string,"id": string,"role"?: Database["public"]['Enums']["member_role"],"status"?: Database["public"]['Enums']["member_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"email"?: string,"id"?: string,"role"?: Database["public"]['Enums']["member_role"],"status"?: Database["public"]['Enums']["member_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_plan_item":
{ Args: { "p_arrangement_id": string,"p_plan_id": string }; Returns: Json
                           },
"bump_plan_version":
{ Args: { "p_expected_version": number,"p_plan_id": string }; Returns: number
                           },
"can_edit_plan":
{ Args: { "p_plan_id": string }; Returns: boolean
                           },
"can_upload_sheet":
{ Args: { "p_name": string }; Returns: boolean
                           },
"can_view_plan":
{ Args: { "p_plan_id": string }; Returns: boolean
                           },
"complete_invitation":
{ Args: { "p_display_name": string }; Returns: undefined
                           },
"create_plan":
{ Args: { "p_description"?: string,"p_title": string }; Returns: string
                           },
"create_plan_link":
{ Args: { "p_expires_at"?: string,"p_plan_id": string,"p_token_hash": string }; Returns: string
                           },
"duplicate_plan":
{ Args: { "p_plan_id": string }; Returns: string
                           },
"find_possible_duplicates":
{ Args: { "p_sha256": string,"p_title": string }; Returns: {
              "music_piece_id": string,"reason": string,"title": string
            }[]
                           },
"get_shared_plan":
{ Args: { "p_token_hash": string }; Returns: Json
                           },
"is_active_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_plan_owner":
{ Args: { "p_plan_id": string }; Returns: boolean
                           },
"music_categories":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"remove_plan_item":
{ Args: { "p_item_id": string }; Returns: number
                           },
"reorder_plan_items":
{ Args: { "p_expected_version": number,"p_item_ids": (string)[],"p_plan_id": string }; Returns: number
                           },
"revoke_plan_link":
{ Args: { "p_link_id": string }; Returns: undefined
                           },
"revoke_plan_share":
{ Args: { "p_share_id": string }; Returns: undefined
                           },
"set_member_status":
{ Args: { "p_status": Database["public"]['Enums']["member_status"],"p_user_id": string }; Returns: undefined
                           },
"set_plan_status":
{ Args: { "p_plan_id": string,"p_status": Database["public"]['Enums']["plan_status"] }; Returns: number
                           },
"share_plan":
{ Args: { "p_permission": Database["public"]['Enums']["share_permission"],"p_plan_id": string,"p_user_id": string }; Returns: string
                           },
"shared_plan_sheet":
{ Args: { "p_arrangement_id": string,"p_token_hash": string }; Returns: {
              "original_filename": string,"storage_path": string
            }[]
                           },
"update_plan_details":
{ Args: { "p_description": string,"p_expected_version": number,"p_plan_id": string,"p_title": string }; Returns: number
                           },
"update_plan_item_notes":
{ Args: { "p_expected_version": number,"p_item_id": string,"p_notes": string }; Returns: number
                           },
"valid_link_plan":
{ Args: { "p_token_hash": string }; Returns: string
                           }
          }
          Enums: {
            "arrangement_status": "pending"|"active"|"archived","content_status": "active"|"archived","member_role": "member"|"admin","member_status": "invited"|"active"|"inactive","plan_status": "draft"|"published"|"archived","share_permission": "viewer"|"editor"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "arrangement_status": ["pending", "active", "archived"],"content_status": ["active", "archived"],"member_role": ["member", "admin"],"member_status": ["invited", "active", "inactive"],"plan_status": ["draft", "published", "archived"],"share_permission": ["viewer", "editor"]
          }
        }
} as const
