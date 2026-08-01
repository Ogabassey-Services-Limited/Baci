import {
  PRODUCT_PROVENANCE_FOLLOWUP_PENDING_SOURCES,
  PRODUCT_PROVENANCE_FOUNDATION_PENDING_SOURCES,
} from './expected-pending-product-provenance-sources.test-support';

export const PAYMENT_INGRESS_AND_PROVENANCE_PENDING_SOURCES = [
  ...PRODUCT_PROVENANCE_FOUNDATION_PENDING_SOURCES.slice(0, 2),
  {
    repositoryPath:
      'supabase/migrations/20260731140000_payment_ingress_contract_generation_foundation.sql',
    sha256: '1a390474d12890e9f641c72f743b35669798eee56a887a87720f4bd8b53a1705',
  },
  ...PRODUCT_PROVENANCE_FOUNDATION_PENDING_SOURCES.slice(2),
  ...PRODUCT_PROVENANCE_FOLLOWUP_PENDING_SOURCES.slice(0, 3),
  {
    repositoryPath:
      'supabase/migrations/20260801140000_payment_ingress_contract_companion.sql',
    sha256: '55c1efce71726e1f1e0f9fa2b035cd52f040bae5ab1693ee6442e0e2e25ff70f',
  },
  ...PRODUCT_PROVENANCE_FOLLOWUP_PENDING_SOURCES.slice(3),
] as const;
