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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      paid_traffic_reports: {
        Row: {
          active_leads: number | null
          awaiting_response: number | null
          concierge_name: string | null
          created_at: string
          created_by: string
          id: string
          in_progress: number | null
          leads_outside_brasilia: number | null
          no_contact_after_attempts: number | null
          no_continuity: number | null
          not_scheduled: number | null
          pdf_file_name: string | null
          pdf_file_path: string | null
          period_end: string | null
          period_start: string | null
          platform: string
          raw_data: Json | null
          report_date: string
          scheduled_appointments: number | null
          total_leads: number | null
          updated_at: string
        }
        Insert: {
          active_leads?: number | null
          awaiting_response?: number | null
          concierge_name?: string | null
          created_at?: string
          created_by: string
          id?: string
          in_progress?: number | null
          leads_outside_brasilia?: number | null
          no_contact_after_attempts?: number | null
          no_continuity?: number | null
          not_scheduled?: number | null
          pdf_file_name?: string | null
          pdf_file_path?: string | null
          period_end?: string | null
          period_start?: string | null
          platform: string
          raw_data?: Json | null
          report_date: string
          scheduled_appointments?: number | null
          total_leads?: number | null
          updated_at?: string
        }
        Update: {
          active_leads?: number | null
          awaiting_response?: number | null
          concierge_name?: string | null
          created_at?: string
          created_by?: string
          id?: string
          in_progress?: number | null
          leads_outside_brasilia?: number | null
          no_contact_after_attempts?: number | null
          no_continuity?: number | null
          not_scheduled?: number | null
          pdf_file_name?: string | null
          pdf_file_path?: string | null
          period_end?: string | null
          period_start?: string | null
          platform?: string
          raw_data?: Json | null
          report_date?: string
          scheduled_appointments?: number | null
          total_leads?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      patient_feedbacks: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          feedback_type: string
          id: string
          image_name: string
          image_path: string
          patient_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          feedback_type: string
          id?: string
          image_name: string
          image_path: string
          patient_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          feedback_type?: string
          id?: string
          image_name?: string
          image_path?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_feedbacks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_files: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          patient_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          patient_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          patient_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_files_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_history: {
        Row: {
          changed_by: string
          created_at: string
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          patient_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          patient_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string
          id: string
          patient_id: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date: string
          id?: string
          patient_id: string
          task_type: string
          title: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string
          id?: string
          patient_id?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          authorization_date: string | null
          birth_date: string | null
          contact_date: string | null
          cpf: string | null
          created_at: string
          created_by: string
          email: string | null
          exams_checklist: string[] | null
          gender: string | null
          guide_validity_date: string | null
          hospital: string | null
          id: string
          insurance: string | null
          insurance_number: string | null
          name: string
          notes: string | null
          origem: string | null
          phone: string | null
          procedure: string
          status: Database["public"]["Enums"]["patient_status"]
          surgery_date: string | null
          updated_at: string
        }
        Insert: {
          authorization_date?: string | null
          birth_date?: string | null
          contact_date?: string | null
          cpf?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          exams_checklist?: string[] | null
          gender?: string | null
          guide_validity_date?: string | null
          hospital?: string | null
          id?: string
          insurance?: string | null
          insurance_number?: string | null
          name: string
          notes?: string | null
          origem?: string | null
          phone?: string | null
          procedure: string
          status?: Database["public"]["Enums"]["patient_status"]
          surgery_date?: string | null
          updated_at?: string
        }
        Update: {
          authorization_date?: string | null
          birth_date?: string | null
          contact_date?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          exams_checklist?: string[] | null
          gender?: string | null
          guide_validity_date?: string | null
          hospital?: string | null
          id?: string
          insurance?: string | null
          insurance_number?: string | null
          name?: string
          notes?: string | null
          origem?: string | null
          phone?: string | null
          procedure?: string
          status?: Database["public"]["Enums"]["patient_status"]
          surgery_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_type: string | null
          username: string | null
        }
        Insert: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
          user_type?: string | null
          username?: string | null
        }
        Update: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_type?: string | null
          username?: string | null
        }
        Relationships: []
      }
      system_activities: {
        Row: {
          activity_type: string
          created_at: string
          created_by: string
          description: string
          id: string
          metadata: Json | null
          patient_id: string | null
          patient_name: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          metadata?: Json | null
          patient_id?: string | null
          patient_name?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          metadata?: Json | null
          patient_id?: string | null
          patient_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_activities_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_user_with_username: {
        Args: { _full_name?: string; _password: string; _username: string }
        Returns: Json
      }
      get_email_by_username: { Args: { _username: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated_user: { Args: never; Returns: boolean }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      patient_status:
        | "awaiting_authorization"
        | "authorized"
        | "pending_scheduling"
        | "surgery_scheduled"
        | "surgery_completed"
        | "cancelled"
        | "completed"
        | "awaiting_consultation"
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
      app_role: ["admin", "user"],
      patient_status: [
        "awaiting_authorization",
        "authorized",
        "pending_scheduling",
        "surgery_scheduled",
        "surgery_completed",
        "cancelled",
        "completed",
        "awaiting_consultation",
      ],
    },
  },
} as const
