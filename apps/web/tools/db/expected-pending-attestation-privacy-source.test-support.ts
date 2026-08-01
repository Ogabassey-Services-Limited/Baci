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
      'supabase/migrations/20260801160000_scope_product_description_attestation_operation_ids.sql',
    sha256: 'afbc9fed8e7ec792805fc9907992fd4ef1b97558cf1131e7ae026d43372f1869',
  },
  {
    repositoryPath:
      'supabase/migrations/20260801170000_redefine_product_description_attestation_grant.sql',
    sha256: '521e49e07c1439de3e7167e0b6390d6ee913b954f66423dc1d2f9dce1f65986a',
  },
  {
    repositoryPath:
      'supabase/migrations/20260801180000_harden_product_description_attestation_indexes.sql',
    sha256: '7a89d48d43b6b565880f83be92689c32459395289fe9ef2158545b69b300a34c',
  },
] as const;
