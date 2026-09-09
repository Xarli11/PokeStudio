/**
 * Hand-maintained subset of the generated Supabase `Database` type,
 * matching `supabase/migrations/*.sql`.
 *
 * Once the local database runs, regenerate the full type with:
 *   supabase gen types typescript --local > src/generated-database-types.ts
 * and replace this file's contents with the generated output.
 *
 * `Relationships: []` on every table is required structurally by
 * `@supabase/supabase-js`'s generic `GenericTable` shape even though this
 * hand-written subset doesn't declare real foreign-key relationship
 * metadata — omitting it silently degrades query builder results to `never`.
 */
export interface Database {
  public: {
    Tables: {
      data_sources: {
        Row: {
          source_id: string;
          source_url: string;
          license: string;
          fetched_at: string;
          importer_version: string;
        };
        Insert: {
          source_id: string;
          source_url: string;
          license: string;
          fetched_at: string;
          importer_version: string;
        };
        Update: Partial<Database['public']['Tables']['data_sources']['Insert']>;
        Relationships: [];
      };
      species: {
        Row: {
          id: string;
          slug: string;
          national_dex_number: number;
          name_en: string;
          name_es: string;
          source_id: string;
          external_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          national_dex_number: number;
          name_en: string;
          name_es: string;
          source_id: string;
          external_id: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['species']['Insert']>;
        Relationships: [];
      };
      pokemon_form: {
        Row: {
          id: string;
          species_id: string;
          slug: string;
          name_en: string;
          name_es: string;
          is_default: boolean;
          form_category: string;
          types: string[];
          base_stats: Record<string, number>;
          source_id: string;
          external_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          species_id: string;
          slug: string;
          name_en: string;
          name_es: string;
          is_default?: boolean;
          form_category: string;
          types: string[];
          base_stats: Record<string, number>;
          source_id: string;
          external_id: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['pokemon_form']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
