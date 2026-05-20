export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ReadonlyTableDefinition<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      // Canonical generated-type shim for the legacy generate-all-product-faqs
      // script. Replace this file with `supabase gen types typescript` output
      // before using it for writes or broader table coverage.
      // TODO(owner: Baci platform, target: 2026-09-30): replace this shim with generated Supabase types before the next schema expansion.
      merchants: ReadonlyTableDefinition<{
        business_name: string | null;
        id: string;
        slug: string | null;
      }>;
      products: ReadonlyTableDefinition<{
        category: string | null;
        description: string | null;
        faqs: Json | null;
        id: string;
        merchant_id: string | null;
        name: string;
        price: number | null;
        specifications: Json | null;
        status: string | null;
      }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
