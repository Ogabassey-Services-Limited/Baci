import type { Database, Json } from './supabase';

export interface StorefrontMerchantSnapshotRow {
  custom_domain: string | null;
  feature_settings: Json | null;
  merchant_data: Json | null;
  resolution_status: string;
}

interface StorefrontPdpCoreSnapshotRow {
  product_data: Json | null;
  resolution_status: string;
}

interface StorefrontPdpSemanticEnrichmentRow {
  cluster_guide_data: Json | null;
  inventory_data: Json | null;
  product_guide_data: Json | null;
  resolution_status: string;
}

type StorefrontSnapshotFunctions = Database['public']['Functions'] & {
  get_storefront_pdp_core_v2: {
    Args: {
      p_branch_id?: string | null;
      p_merchant_id: string;
      p_product_slug: string;
    };
    Returns: StorefrontPdpCoreSnapshotRow[];
  };
  get_storefront_pdp_semantic_enrichment_v1: {
    Args: {
      p_category_slug: string;
      p_cluster_guide_limit?: number;
      p_cluster_rules: Json;
      p_include_guides?: boolean;
      p_inventory_limit?: number;
      p_merchant_id: string;
      p_product_guide_limit?: number;
      p_product_id: string;
      p_search_query: string;
    };
    Returns: StorefrontPdpSemanticEnrichmentRow[];
  };
  resolve_storefront_public_snapshot_v2: {
    Args: { p_identifier: string };
    Returns: StorefrontMerchantSnapshotRow[];
  };
};

export type StorefrontDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: StorefrontSnapshotFunctions;
  };
};
