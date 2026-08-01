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
    sha256: 'c6709d5d648860231a2b0c2487d31d9ce90e3b7d36a33a1567c109cca59a367e',
  },
  {
    repositoryPath:
      'supabase/migrations/20260801170000_redefine_product_description_attestation_grant.sql',
    sha256: 'd72c65385b7d37c5e4ba0344e7a8eda97ddfbf423bddf686663654f878276eec',
  },
  {
    repositoryPath:
      'supabase/migrations/20260801180000_harden_product_description_attestation_indexes.sql',
    sha256: '61743616a53b433da87eee5276a8ebd0d44ad6000e4dd23afbff23b6425dd587',
  },
] as const;
