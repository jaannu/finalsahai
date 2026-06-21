export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      attendance: {
        Row: {
          confidence: number | null;
          created_at: string;
          date: string;
          id: string;
          marked_by: string | null;
          school_id: string;
          source: Database["public"]["Enums"]["extraction_source"];
          status: Database["public"]["Enums"]["attendance_status"];
          student_id: string;
        };
        Insert: {
          confidence?: number | null;
          created_at?: string;
          date: string;
          id?: string;
          marked_by?: string | null;
          school_id: string;
          source?: Database["public"]["Enums"]["extraction_source"];
          status: Database["public"]["Enums"]["attendance_status"];
          student_id: string;
        };
        Update: {
          confidence?: number | null;
          created_at?: string;
          date?: string;
          id?: string;
          marked_by?: string | null;
          school_id?: string;
          source?: Database["public"]["Enums"]["extraction_source"];
          status?: Database["public"]["Enums"]["attendance_status"];
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json | null;
          entity: string | null;
          entity_id: string | null;
          id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json | null;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json | null;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      briefings: {
        Row: {
          created_at: string;
          date: string;
          generated_by: string | null;
          high_risk_count: number;
          id: string;
          payload: Json | null;
          school_id: string;
          summary_text: string;
          used_real_ai: boolean;
        };
        Insert: {
          created_at?: string;
          date: string;
          generated_by?: string | null;
          high_risk_count?: number;
          id?: string;
          payload?: Json | null;
          school_id: string;
          summary_text: string;
          used_real_ai?: boolean;
        };
        Update: {
          created_at?: string;
          date?: string;
          generated_by?: string | null;
          high_risk_count?: number;
          id?: string;
          payload?: Json | null;
          school_id?: string;
          summary_text?: string;
          used_real_ai?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "briefings_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      extractions: {
        Row: {
          avg_confidence: number | null;
          created_at: string;
          created_by: string;
          date: string;
          flagged_reasons: Json | null;
          grade: string | null;
          id: string;
          payload: Json;
          photo_url: string | null;
          school_id: string;
          section: string | null;
          source: Database["public"]["Enums"]["extraction_source"];
          status: Database["public"]["Enums"]["extraction_status"];
          used_real_ai: boolean;
          verified_at: string | null;
        };
        Insert: {
          avg_confidence?: number | null;
          created_at?: string;
          created_by: string;
          date: string;
          flagged_reasons?: Json | null;
          grade?: string | null;
          id?: string;
          payload: Json;
          photo_url?: string | null;
          school_id: string;
          section?: string | null;
          source: Database["public"]["Enums"]["extraction_source"];
          status?: Database["public"]["Enums"]["extraction_status"];
          used_real_ai?: boolean;
          verified_at?: string | null;
        };
        Update: {
          avg_confidence?: number | null;
          created_at?: string;
          created_by?: string;
          date?: string;
          flagged_reasons?: Json | null;
          grade?: string | null;
          id?: string;
          payload?: Json;
          photo_url?: string | null;
          school_id?: string;
          section?: string | null;
          source?: Database["public"]["Enums"]["extraction_source"];
          status?: Database["public"]["Enums"]["extraction_status"];
          used_real_ai?: boolean;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "extractions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          email: string | null;
          id: string;
          language: string;
          school_id: string | null;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          email?: string | null;
          id: string;
          language?: string;
          school_id?: string | null;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          email?: string | null;
          id?: string;
          language?: string;
          school_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      risk_scores: {
        Row: {
          computed_at: string;
          id: string;
          level: Database["public"]["Enums"]["risk_level"];
          reasons: Json;
          recommended_actions: Json;
          school_id: string;
          score: number;
          student_id: string;
        };
        Insert: {
          computed_at?: string;
          id?: string;
          level: Database["public"]["Enums"]["risk_level"];
          reasons?: Json;
          recommended_actions?: Json;
          school_id: string;
          score: number;
          student_id: string;
        };
        Update: {
          computed_at?: string;
          id?: string;
          level?: Database["public"]["Enums"]["risk_level"];
          reasons?: Json;
          recommended_actions?: Json;
          school_id?: string;
          score?: number;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "risk_scores_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "risk_scores_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      schools: {
        Row: {
          created_at: string;
          district: string | null;
          id: string;
          name: string;
          state: string | null;
          udise_code: string | null;
        };
        Insert: {
          created_at?: string;
          district?: string | null;
          id?: string;
          name: string;
          state?: string | null;
          udise_code?: string | null;
        };
        Update: {
          created_at?: string;
          district?: string | null;
          id?: string;
          name?: string;
          state?: string | null;
          udise_code?: string | null;
        };
        Relationships: [];
      };
      students: {
        Row: {
          created_at: string;
          full_name: string;
          gender: string | null;
          grade: string;
          guardian_phone: string | null;
          id: string;
          school_id: string;
          section: string | null;
        };
        Insert: {
          created_at?: string;
          full_name: string;
          gender?: string | null;
          grade: string;
          guardian_phone?: string | null;
          id?: string;
          school_id: string;
          section?: string | null;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          gender?: string | null;
          grade?: string;
          guardian_phone?: string | null;
          id?: string;
          school_id?: string;
          section?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          school_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          school_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          school_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "teacher" | "principal" | "counsellor" | "education_officer" | "district_admin";
      attendance_status: "present" | "absent" | "late";
      extraction_source: "photo" | "voice" | "csv" | "manual" | "ivr";
      extraction_status: "pending" | "verified" | "rejected";
      risk_level: "low" | "medium" | "high";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["teacher", "principal", "counsellor", "education_officer", "district_admin"],
      attendance_status: ["present", "absent", "late"],
      extraction_source: ["photo", "voice", "csv", "manual", "ivr"],
      extraction_status: ["pending", "verified", "rejected"],
      risk_level: ["low", "medium", "high"],
    },
  },
} as const;
