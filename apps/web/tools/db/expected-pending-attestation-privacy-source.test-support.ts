export const ATTESTATION_PRIVACY_PENDING_SOURCES = [
  {
    repositoryPath:
      'supabase/migrations/20260801110000_harden_product_description_attestation_privacy.sql',
    sha256: '32ff115b4bd5446d1f43e722d2bb4bbf2fbe9c9f7bea438a6f16a2f13d7c09ec',
  },
] as const;

export const ATTESTATION_ISSUANCE_PENDING_SOURCES = [
  {
    repositoryPath:
      'supabase/migrations/20260801130000_bound_product_description_attestation_issuance.sql',
    sha256: '5300601becce1f02d916d7393fe7690b19aee1b581ec4d81adff33256d504109',
  },
  {
    repositoryPath:
      'supabase/migrations/20260801150000_scope_product_description_attestation_operation_ids.sql',
    sha256: '9ee272d54fa52ea6a736d3579e65a5dede6f97047aacbbf6cb53b389188185ce',
  },
] as const;
