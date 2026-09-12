export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ability: {
        Row: {
          created_at: string
          effect_en: string | null
          effect_es: string | null
          external_id: string
          id: string
          name_en: string
          name_es: string | null
          slug: string
          source_id: string
        }
        Insert: {
          created_at?: string
          effect_en?: string | null
          effect_es?: string | null
          external_id: string
          id?: string
          name_en: string
          name_es?: string | null
          slug: string
          source_id: string
        }
        Update: {
          created_at?: string
          effect_en?: string | null
          effect_es?: string | null
          external_id?: string
          id?: string
          name_en?: string
          name_es?: string | null
          slug?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ability_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["source_id"]
          },
        ]
      }
      data_sources: {
        Row: {
          fetched_at: string
          importer_version: string
          license: string
          source_id: string
          source_url: string
        }
        Insert: {
          fetched_at: string
          importer_version: string
          license: string
          source_id: string
          source_url: string
        }
        Update: {
          fetched_at?: string
          importer_version?: string
          license?: string
          source_id?: string
          source_url?: string
        }
        Relationships: []
      }
      machine: {
        Row: {
          created_at: string
          external_id: string
          id: string
          item_slug: string
          move_id: string
          source_id: string
          version_group_id: string
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          item_slug: string
          move_id: string
          source_id: string
          version_group_id: string
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          item_slug?: string
          move_id?: string
          source_id?: string
          version_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "move"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "machine_version_group_id_fkey"
            columns: ["version_group_id"]
            isOneToOne: false
            referencedRelation: "version_group"
            referencedColumns: ["id"]
          },
        ]
      }
      move: {
        Row: {
          accuracy: number | null
          ailment: string | null
          ailment_chance: number
          category: string | null
          created_at: string
          crit_rate: number
          damage_class: string
          drain: number
          effect_chance: number | null
          effect_en: string | null
          effect_es: string | null
          external_id: string
          flinch_chance: number
          generation: number
          healing: number
          id: string
          max_hits: number | null
          max_turns: number | null
          min_hits: number | null
          min_turns: number | null
          name_en: string
          name_es: string | null
          power: number | null
          pp: number
          priority: number
          slug: string
          source_id: string
          stat_chance: number
          target: string
          type: string
        }
        Insert: {
          accuracy?: number | null
          ailment?: string | null
          ailment_chance?: number
          category?: string | null
          created_at?: string
          crit_rate?: number
          damage_class: string
          drain?: number
          effect_chance?: number | null
          effect_en?: string | null
          effect_es?: string | null
          external_id: string
          flinch_chance?: number
          generation: number
          healing?: number
          id?: string
          max_hits?: number | null
          max_turns?: number | null
          min_hits?: number | null
          min_turns?: number | null
          name_en: string
          name_es?: string | null
          power?: number | null
          pp: number
          priority: number
          slug: string
          source_id: string
          stat_chance?: number
          target: string
          type: string
        }
        Update: {
          accuracy?: number | null
          ailment?: string | null
          ailment_chance?: number
          category?: string | null
          created_at?: string
          crit_rate?: number
          damage_class?: string
          drain?: number
          effect_chance?: number | null
          effect_en?: string | null
          effect_es?: string | null
          external_id?: string
          flinch_chance?: number
          generation?: number
          healing?: number
          id?: string
          max_hits?: number | null
          max_turns?: number | null
          min_hits?: number | null
          min_turns?: number | null
          name_en?: string
          name_es?: string | null
          power?: number | null
          pp?: number
          priority?: number
          slug?: string
          source_id?: string
          stat_chance?: number
          target?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["source_id"]
          },
        ]
      }
      move_learn_method: {
        Row: {
          created_at: string
          external_id: string
          slug: string
          source_id: string
        }
        Insert: {
          created_at?: string
          external_id: string
          slug: string
          source_id: string
        }
        Update: {
          created_at?: string
          external_id?: string
          slug?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_learn_method_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["source_id"]
          },
        ]
      }
      pokemon_form: {
        Row: {
          base_stats: Json
          created_at: string
          external_id: string
          form_category: string
          id: string
          is_default: boolean
          name_en: string
          name_es: string
          slug: string
          source_id: string
          species_id: string
          types: string[]
        }
        Insert: {
          base_stats: Json
          created_at?: string
          external_id: string
          form_category: string
          id?: string
          is_default?: boolean
          name_en: string
          name_es: string
          slug: string
          source_id: string
          species_id: string
          types: string[]
        }
        Update: {
          base_stats?: Json
          created_at?: string
          external_id?: string
          form_category?: string
          id?: string
          is_default?: boolean
          name_en?: string
          name_es?: string
          slug?: string
          source_id?: string
          species_id?: string
          types?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "pokemon_form_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "pokemon_form_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      pokemon_form_ability: {
        Row: {
          ability_id: string
          created_at: string
          id: string
          is_hidden: boolean
          pokemon_form_id: string
          slot: number
          source_id: string
        }
        Insert: {
          ability_id: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          pokemon_form_id: string
          slot: number
          source_id: string
        }
        Update: {
          ability_id?: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          pokemon_form_id?: string
          slot?: number
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pokemon_form_ability_ability_id_fkey"
            columns: ["ability_id"]
            isOneToOne: false
            referencedRelation: "ability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pokemon_form_ability_pokemon_form_id_fkey"
            columns: ["pokemon_form_id"]
            isOneToOne: false
            referencedRelation: "pokemon_form"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pokemon_form_ability_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["source_id"]
          },
        ]
      }
      pokemon_form_move: {
        Row: {
          created_at: string
          id: string
          learn_method: string
          level: number
          move_id: string
          pokemon_form_id: string
          sort_order: number | null
          source_id: string
          version_group_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          learn_method: string
          level?: number
          move_id: string
          pokemon_form_id: string
          sort_order?: number | null
          source_id: string
          version_group_id: string
        }
        Update: {
          created_at?: string
          id?: string
          learn_method?: string
          level?: number
          move_id?: string
          pokemon_form_id?: string
          sort_order?: number | null
          source_id?: string
          version_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pokemon_form_move_learn_method_fkey"
            columns: ["learn_method"]
            isOneToOne: false
            referencedRelation: "move_learn_method"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "pokemon_form_move_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "move"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pokemon_form_move_pokemon_form_id_fkey"
            columns: ["pokemon_form_id"]
            isOneToOne: false
            referencedRelation: "pokemon_form"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pokemon_form_move_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "pokemon_form_move_version_group_id_fkey"
            columns: ["version_group_id"]
            isOneToOne: false
            referencedRelation: "version_group"
            referencedColumns: ["id"]
          },
        ]
      }
      species: {
        Row: {
          created_at: string
          external_id: string
          id: string
          name_en: string
          name_es: string
          national_dex_number: number
          slug: string
          source_id: string
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          name_en: string
          name_es: string
          national_dex_number: number
          slug: string
          source_id: string
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          name_en?: string
          name_es?: string
          national_dex_number?: number
          slug?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "species_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["source_id"]
          },
        ]
      }
      species_evolution: {
        Row: {
          created_at: string
          evolution_chain_external_id: string
          from_species_id: string
          gender: number | null
          held_item_slug: string | null
          id: string
          item_slug: string | null
          known_move_slug: string | null
          known_move_type_slug: string | null
          location_slug: string | null
          min_affection: number | null
          min_beauty: number | null
          min_happiness: number | null
          min_level: number | null
          needs_overworld_rain: boolean
          party_species_slug: string | null
          party_type_slug: string | null
          raw_condition: Json
          relative_physical_stats: number | null
          source_id: string
          time_of_day: string | null
          to_species_id: string
          trade_species_slug: string | null
          trigger: string
          turn_upside_down: boolean
        }
        Insert: {
          created_at?: string
          evolution_chain_external_id: string
          from_species_id: string
          gender?: number | null
          held_item_slug?: string | null
          id?: string
          item_slug?: string | null
          known_move_slug?: string | null
          known_move_type_slug?: string | null
          location_slug?: string | null
          min_affection?: number | null
          min_beauty?: number | null
          min_happiness?: number | null
          min_level?: number | null
          needs_overworld_rain?: boolean
          party_species_slug?: string | null
          party_type_slug?: string | null
          raw_condition?: Json
          relative_physical_stats?: number | null
          source_id: string
          time_of_day?: string | null
          to_species_id: string
          trade_species_slug?: string | null
          trigger: string
          turn_upside_down?: boolean
        }
        Update: {
          created_at?: string
          evolution_chain_external_id?: string
          from_species_id?: string
          gender?: number | null
          held_item_slug?: string | null
          id?: string
          item_slug?: string | null
          known_move_slug?: string | null
          known_move_type_slug?: string | null
          location_slug?: string | null
          min_affection?: number | null
          min_beauty?: number | null
          min_happiness?: number | null
          min_level?: number | null
          needs_overworld_rain?: boolean
          party_species_slug?: string | null
          party_type_slug?: string | null
          raw_condition?: Json
          relative_physical_stats?: number | null
          source_id?: string
          time_of_day?: string | null
          to_species_id?: string
          trade_species_slug?: string | null
          trigger?: string
          turn_upside_down?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "species_evolution_from_species_id_fkey"
            columns: ["from_species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "species_evolution_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "species_evolution_to_species_id_fkey"
            columns: ["to_species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      version_group: {
        Row: {
          created_at: string
          display_order: number
          external_id: string
          generation: number
          id: string
          slug: string
          source_id: string
        }
        Insert: {
          created_at?: string
          display_order: number
          external_id: string
          generation: number
          id?: string
          slug: string
          source_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          external_id?: string
          generation?: number
          id?: string
          slug?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "version_group_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["source_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

