export const EXPECTED_PAYSTACK_PENDING_SOURCES = [
  {
    repositoryPath:
      'supabase/migrations/20260811100000_manual_paystack_partial_reconciliation.sql',
    sha256: 'e9a10beaff84817e25b0f185d1aa672636ffcb052b8d19d678081cbaa9c5f09a',
  },
  {
    repositoryPath:
      'supabase/migrations/20260811110000_serialize_paystack_reference_claims.sql',
    sha256: '5967815ed18d787bc5f2a8d7036f7dbed4c603178454a9e418e5afb7be74b735',
  },
  {
    repositoryPath:
      'supabase/migrations/20260811120000_allow_reviewed_paystack_email_mismatch.sql',
    sha256: 'c92072e6b472fad64a64d22d9539f00422a6404a745e8a5febbeccebe478018a',
  },
  {
    repositoryPath:
      'supabase/migrations/20260811130000_serialize_wallet_paystack_reference_claims.sql',
    sha256: 'd938d44c8af908a099fb0d83bb292838d888738eeed5eabec90a288a091c1484',
  },
  {
    repositoryPath:
      'supabase/migrations/20260811130001_reapply_paystack_email_mismatch.sql',
    sha256: 'c92072e6b472fad64a64d22d9539f00422a6404a745e8a5febbeccebe478018a',
  },
  {
    repositoryPath:
      'supabase/migrations/20260811135000_harden_paystack_chat_order_relationship.sql',
    sha256: '210c24070e7295dcdec19e10d33dd456a1dbc24891812cc74b4bfddeff808456',
  },
  {
    repositoryPath:
      'supabase/migrations/20260811140000_harden_paystack_manual_reconciliation_review_contracts.sql',
    sha256: '4ed01fb7657a37530a4bdb5de152b4bf869e4b2ddaf7bc04c29f7ca131207408',
  },
  {
    repositoryPath:
      'supabase/migrations/20260811150000_idempotent_paystack_reconciliation_retries.sql',
    sha256: '7cf4ca2faa5d170a6a1f4a0eb0e8cec10aee99a9e728fedbc906dfa288f0e195',
  },
  {
    repositoryPath:
      'supabase/migrations/20260811160000_index_paystack_reconciliation_retry_lookup.sql',
    sha256: 'c1c5724d6af11208bbb2880038676304cf5c1854cdaa9757b907866dc11e7466',
  },
  {
    repositoryPath:
      'supabase/migrations/20260811170000_require_paystack_reconciliation_operator_access.sql',
    sha256: '95f7ddb1c12eea9d152a99c137d20f73694d5d719eda63b72d4861fe6a99bfb4',
  },
  {
    repositoryPath:
      'supabase/migrations/20260811180000_fix_paystack_reconciliation_retry_balance.sql',
    sha256: '1ccd752c588696be6c221c46e4e0b5338046844ccad9d4a7076efe81ab659348',
  },
  {
    repositoryPath:
      'supabase/migrations/20260812100000_revoke_paystack_reconciliation_internal_versions.sql',
    sha256: 'd174bd434d72e16bbce09b2f146f3ffbdfe32cd22737ddc09f583d7aae007e02',
  },
  {
    repositoryPath:
      'supabase/migrations/20260812110000_harden_paystack_reconciliation_retry_scope.sql',
    sha256: 'bc70151fb7f1ebd60ce66cd620ab26d8422ab3eeb74f916c66dd4f3d77a4a6b3',
  },
  {
    repositoryPath:
      'supabase/migrations/20260813090000_reapply_paystack_email_mismatch.sql',
    sha256: 'c92072e6b472fad64a64d22d9539f00422a6404a745e8a5febbeccebe478018a',
  },
] as const;
