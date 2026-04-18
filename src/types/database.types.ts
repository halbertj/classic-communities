/**
 * Placeholder for Supabase-generated database types.
 *
 * Regenerate with:
 *   npm run types:generate
 *
 * The CLI command wired up in package.json writes the real, fully-typed
 * schema to this file. Until then we ship a minimal shape that matches
 * the example `todos` table used on the home page so the app type-checks
 * out of the box.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      todos: {
        Row: {
          id: string;
          title: string;
          is_complete: boolean;
          inserted_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          is_complete?: boolean;
          inserted_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          is_complete?: boolean;
          inserted_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
