/**
 * Hand-maintained subset of the generated Supabase `Database` type,
 * matching `supabase/migrations/20260908000001_reference_schema.sql`.
 *
 * Once the local database runs, regenerate the full type with:
 *   supabase gen types typescript --local > src/generated-database-types.ts
 * and replace this file's contents with the generated output.
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
      };
      species: {
        Row: {
          id: string;
          national_dex_number: number;
          name_en: string;
          name_es: string;
          types: string[];
          base_stats: Record<string, number>;
          introduced_in_generation: number;
          source_id: string;
          created_at: string;
        };
        Insert: {
          id: string;
          national_dex_number: number;
          name_en: string;
          name_es: string;
          types: string[];
          base_stats: Record<string, number>;
          introduced_in_generation: number;
          source_id: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['species']['Insert']>;
      };
    };
  };
}
