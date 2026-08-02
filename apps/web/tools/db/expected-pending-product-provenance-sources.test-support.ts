import {
  ATTESTATION_ISSUANCE_PENDING_SOURCES,
  ATTESTATION_PRIVACY_PENDING_SOURCES,
} from './expected-pending-attestation-privacy-source.test-support';
import { OPERATION_ID_PENDING_SOURCES } from './expected-pending-operation-id-source.test-support';

export const PRODUCT_PROVENANCE_FOUNDATION_PENDING_SOURCES = [
  {
    repositoryPath:
      'supabase/migrations/20260731090000_add_product_description_provenance.sql',
    sha256: 'c403c8bd47d7fbfa6eb3ef80a3f6e11f7455350d37cf12b40c34f345012d9d9b',
  },
  {
    repositoryPath:
      'supabase/migrations/20260731100000_harden_product_description_attestation_grants.sql',
    sha256: '1247e7e4969a371ff266a773dbc882f778cfb20d155bf0201b3d04e223140d7e',
  },
  {
    repositoryPath:
      'supabase/migrations/20260801090000_harden_product_description_provenance_retention.sql',
    sha256: '9bc6d7703a7e8c32248ce024d651a157965365f4fcffc0f6eb43e3fa07b3babd',
  },
] as const;

export const PRODUCT_PROVENANCE_FOLLOWUP_PENDING_SOURCES = [
  ...OPERATION_ID_PENDING_SOURCES,
  ...ATTESTATION_PRIVACY_PENDING_SOURCES,
  ...ATTESTATION_ISSUANCE_PENDING_SOURCES,
] as const;
