export const EXPECTED_PENDING_TAIL_SOURCES = {
  identity: [
    {
      repositoryPath:
        'supabase/migrations/20260729195913_guard_merchant_identity_updates.sql',
      sha256:
        '12c758bd0bfd54643076b0d5e4c2b48092808493b2c0fb7caed9c16eb35db185',
    },
    {
      repositoryPath:
        'supabase/migrations/20260729195914_update_merchant_identity_settings.sql',
      sha256:
        '6e63f92629949491d21c2a5ca2e47367d91e398c061fa3d1419e2a7a0c3ff61b',
    },
  ],
  paymentIngressCompanion: [
    {
      repositoryPath:
        'supabase/migrations/20260801140000_payment_ingress_contract_companion.sql',
      sha256:
        '55c1efce71726e1f1e0f9fa2b035cd52f040bae5ab1693ee6442e0e2e25ff70f',
    },
  ],
  paymentWebhookEvidence: [
    {
      repositoryPath:
        'supabase/migrations/20260801150000_payment_webhook_evidence_foundation.sql',
      sha256:
        '640f72cd35c32b489409ffce05b76bf71730b9ec365bfb93989181e2ba85c2bc',
    },
  ],
  paymentIngressFoundation: [
    {
      repositoryPath:
        'supabase/migrations/20260731140000_payment_ingress_contract_generation_foundation.sql',
      sha256:
        '1a390474d12890e9f641c72f743b35669798eee56a887a87720f4bd8b53a1705',
    },
  ],
  storefrontSearchReadiness: [
    {
      repositoryPath:
        'supabase/migrations/20260804000800_extend_merchant_identity_settings_storefront_profile.sql',
      sha256:
        '5b7a2d4e2d5788601abcb60aa9ba4d91d17fb2affb53ce0841bbd8126b45301a',
    },
    {
      repositoryPath:
        'supabase/migrations/20260804000900_add_agentic_catalog_category_read_policy.sql',
      sha256:
        '227b17a420e0f9ebea6d5dd1d8f993a9b3b68da9f50888918126321557f360b6',
    },
  ],
} as const;
